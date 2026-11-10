import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { format } from "prettier";
const sections = [];
const inventory = [];
const checking = process.argv.includes("--check");
const project = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
function collect(root, name, version, license, source = "", ecosystem = "npm") {
  if (!license) throw new Error(`Missing declared license: ${name} ${version}`);
  if (ecosystem === "npm") {
    const location = path.relative(".", root).split(path.sep).join("/");
    if (lock.packages[location]?.version !== version)
      throw new Error(
        `Installed package differs from lockfile: ${location}; run npm ci.`,
      );
  }
  const files = fs
    .readdirSync(root)
    .filter(
      (file) =>
        /^(LICEN[SC]E|COPYING|NOTICE|OFL)([._-]|$)/i.test(file) &&
        fs.statSync(path.join(root, file)).isFile(),
    )
    .sort();
  const noticeFiles = [...files];
  sections.push(
    `\n${"=".repeat(72)}\n${name} ${version} — ${license || "License declared in upstream package"}\n${source ? "Unmodified source: " + source + "\n" : ""}` +
      files
        .map(
          (file) =>
            `\n${file}\n${fs.readFileSync(path.join(root, file), "utf8")}`,
        )
        .join("\n"),
  );
  if (!files.length) {
    const notice = path.join(
      "third-party/notices",
      name.replace(/[^a-zA-Z0-9._-]/g, "_") + "-" + version + ".txt",
    );
    if (!fs.existsSync(notice))
      throw new Error("Missing third-party notice: " + name + " " + version);
    sections.push(fs.readFileSync(notice, "utf8"));
    noticeFiles.push(notice.split(path.sep).join("/"));
  }
  inventory.push({ ecosystem, name, version, license, source, noticeFiles });
}
function packages(root) {
  for (const name of fs.readdirSync(root).sort()) {
    if (name.startsWith(".")) continue;
    const folder = path.join(root, name);
    if (!fs.statSync(folder).isDirectory()) continue;
    if (name.startsWith("@")) {
      packages(folder);
      continue;
    }
    const metadata = path.join(folder, "package.json");
    if (fs.existsSync(metadata)) {
      const info = JSON.parse(fs.readFileSync(metadata, "utf8"));
      collect(
        folder,
        info.name,
        info.version,
        info.license,
        `https://www.npmjs.com/package/${info.name}/v/${info.version}`,
      );
    }
    if (fs.existsSync(path.join(folder, "node_modules")))
      packages(path.join(folder, "node_modules"));
  }
}
packages("node_modules");
const metadata = JSON.parse(
  execFileSync(
    "cargo",
    [
      "metadata",
      "--locked",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--format-version",
      "1",
    ],
    { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
  ),
);
const shipped = new Set();
for (const target of ["x86_64-pc-windows-msvc", "aarch64-linux-android"]) {
  const filtered = JSON.parse(
    execFileSync(
      "cargo",
      [
        "metadata",
        "--locked",
        "--manifest-path",
        "src-tauri/Cargo.toml",
        "--format-version",
        "1",
        "--filter-platform",
        target,
      ],
      { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
    ),
  );
  const nodes = new Map(filtered.resolve.nodes.map((node) => [node.id, node]));
  // Visit each platform independently; a node already present may have
  // different active dependencies on the second platform.
  const visited = new Set();
  const scan = (id) => {
    if (visited.has(id)) return;
    visited.add(id);
    shipped.add(id);
    for (const dep of nodes.get(id)?.deps || []) scan(dep.pkg);
  };
  scan(filtered.resolve.root);
}
for (const info of metadata.packages.filter(
  (p) => p.source && shipped.has(p.id),
)) {
  collect(
    path.dirname(info.manifest_path),
    info.name,
    info.version,
    info.license,
    `https://crates.io/crates/${info.name}/${info.version}`,
    "cargo",
  );
}
// These native libraries are bundled inside Cargo crates; their licenses are
// distinct from the Rust wrappers and are not at the crate root.
const sqliteCrate = metadata.packages.find((p) => p.name === "libsqlite3-sys");
const opensslCrate = metadata.packages.find((p) => p.name === "openssl-src");
if (sqliteCrate && opensslCrate) {
  const sqlcipherRoot = path.join(
    path.dirname(sqliteCrate.manifest_path),
    "sqlcipher",
  );
  const source = fs.readFileSync(path.join(sqlcipherRoot, "sqlite3.c"), "utf8");
  const cipherVersion = source.match(
    /#define CIPHER_VERSION_NUMBER ([\d.]+)/,
  )?.[1];
  if (!cipherVersion) throw Error("Cannot identify bundled SQLCipher version");
  collect(
    sqlcipherRoot,
    "SQLCipher",
    cipherVersion,
    "BSD-3-Clause",
    "https://github.com/sqlcipher/sqlcipher",
    "native",
  );
  collect(
    path.join(path.dirname(opensslCrate.manifest_path), "openssl"),
    "OpenSSL",
    opensslCrate.version.split("+")[1],
    "Apache-2.0",
    "https://github.com/openssl/openssl",
    "native",
  );
}
sections.push(
  "\nAndroid libraries retain their individual licenses. desugar_jdk_libs uses GPL v2 with the Classpath Exception; it is not Apache-2.0. See Maven and supplemental notices below. Android SDK platform components are not redistributed with the APK. WebView2 is a separately installed Microsoft runtime.\n" +
    fs.readFileSync("src/assets/fonts/libron/COPYRIGHT.txt", "utf8") +
    "\n" +
    fs.readFileSync("src/assets/fonts/libron/LICENSE.txt", "utf8"),
);
const androidNotices = fs
  .readFileSync("third-party/android-notices.txt", "utf8")
  .replaceAll("\r\n", "\n");
if (!androidNotices.trim()) throw new Error("Android notices are empty.");
const androidDirectDependencies = [
  ...fs
    .readFileSync("src-tauri/gen/android/app/build.gradle.kts", "utf8")
    .matchAll(/^\s*(?:implementation|coreLibraryDesugaring)\("([^"]+)"\)/gm),
]
  .map((match) => match[1])
  .sort();
for (const coordinate of androidDirectDependencies) {
  if (!androidNotices.includes("\n" + coordinate + "\n"))
    throw new Error("Missing Android dependency notices: " + coordinate);
}
sections.push(androidNotices);
const androidSupplementalNotices = [];
for (const coordinate of androidDirectDependencies.filter((name) =>
  name.startsWith("com.android.tools:desugar_jdk_libs:"),
)) {
  const version = coordinate.split(":")[2];
  const file = `third-party/notices/desugar_jdk_libs-${version}.txt`;
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes(coordinate) || !/classpath/i.test(content))
    throw new Error("Invalid desugar_jdk_libs license notice: " + file);
  sections.push(content);
  androidSupplementalNotices.push({
    coordinate,
    file,
    license: "GPL-2.0-only WITH Classpath-exception-2.0",
  });
}
const text =
  "Orvim third-party licenses — generated from installed npm/Cargo packages\n" +
  sections.join("\n").replace(/[\t ]+$/gm, "");
const manifest = await format(
  JSON.stringify({
    schemaVersion: 1,
    application: { name: project.name, version: project.version },
    cargoTargets: ["x86_64-pc-windows-msvc", "aarch64-linux-android"],
    npmScope:
      "Installed lockfile-matched packages, including development tools and host-specific optional packages.",
    androidScope:
      "Direct dependencies checked; cached Maven notices may include extra versions. Audit releaseRuntimeClasspath separately.",
    androidDirectDependencies,
    androidSupplementalNotices,
    androidNoticesSha256: createHash("sha256")
      .update(androidNotices)
      .digest("hex"),
    additionalFont: {
      name: "Libron",
      license: "OFL-1.1",
      files: [
        "src/assets/fonts/libron/COPYRIGHT.txt",
        "src/assets/fonts/libron/LICENSE.txt",
      ],
    },
    packages: inventory,
  }),
  { parser: "json" },
);
const outputs = new Map([
  ["THIRD_PARTY_LICENSES.txt", text],
  ["public/third-party-licenses.txt", text],
  ["public/LICENSE.txt", fs.readFileSync("LICENSE", "utf8")],
  ["public/NOTICE.txt", fs.readFileSync("NOTICE", "utf8")],
  ["third-party/inventory.json", manifest],
]);
for (const [file, content] of outputs) {
  if (checking) {
    if (
      !fs.existsSync(file) ||
      fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n") !==
        content.replaceAll("\r\n", "\n")
    )
      throw new Error(
        `Stale license output: ${file}; run npm run licenses:generate.`,
      );
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
console.log(
  `${checking ? "Verified" : "Collected"} ${inventory.filter((p) => p.ecosystem === "npm").length} npm and ${inventory.filter((p) => p.ecosystem === "cargo").length} Cargo packages; ${androidDirectDependencies.length} direct Android dependencies.`,
);
