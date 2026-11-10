// Fetch missing notices from the exact Cargo source commit or npm gitHead.
// These are public license texts; no credentials or user records are read.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const output = "third-party/notices";
fs.mkdirSync(output, { recursive: true });
const licenseFiles = (root) =>
  fs
    .readdirSync(root)
    .filter(
      (file) =>
        /^(LICEN[SC]E|COPYING|NOTICE|OFL)([._-]|$)/i.test(file) &&
        fs.statSync(path.join(root, file)).isFile(),
    );
const packages = [];
function npm(root) {
  for (const name of fs.readdirSync(root)) {
    if (name.startsWith(".")) continue;
    const folder = path.join(root, name);
    if (!fs.statSync(folder).isDirectory()) continue;
    if (name.startsWith("@")) {
      npm(folder);
      continue;
    }
    if (fs.existsSync(path.join(folder, "package.json"))) {
      const p = JSON.parse(fs.readFileSync(path.join(folder, "package.json")));
      packages.push({ ...p, root: folder, kind: "npm" });
    }
    if (fs.existsSync(path.join(folder, "node_modules")))
      npm(path.join(folder, "node_modules"));
  }
}
npm("node_modules");
const cargo = JSON.parse(
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
packages.push(
  ...cargo.packages
    .filter((p) => p.source)
    .map((p) => ({ ...p, root: path.dirname(p.manifest_path), kind: "cargo" })),
);
const missing = packages.filter((p) => !licenseFiles(p.root).length),
  failures = [];
async function collect(p) {
  const name = p.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
    dest = path.join(output, name + "-" + p.version + ".txt");
  if (fs.existsSync(dest)) return;
  let repository =
    typeof p.repository === "object" ? p.repository?.url : p.repository;
  repository = (repository || "")
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git:\/\//, "https://");
  let commit = p.gitHead || "";
  let prefix = "";
  if (p.kind === "cargo") {
    const vcs = path.join(p.root, ".cargo_vcs_info.json");
    if (fs.existsSync(vcs)) {
      const info = JSON.parse(fs.readFileSync(vcs));
      commit = info.git?.sha1 || "";
      prefix = info.path_in_vcs || "";
    }
  }
  if (p.kind === "npm" && !commit) {
    const info = await fetch(
      "https://registry.npmjs.org/" + p.name + "/" + p.version,
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    commit = info?.gitHead || "";
  }
  const repo = /github\.com[/:]([^/]+\/[^/#?]+)/.exec(repository || "")?.[1];
  if (!repo || !commit) {
    failures.push({
      name: p.name,
      version: p.version,
      repository,
      reason: "No exact source commit",
    });
    return;
  }
  const paths = [
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "LICENSE-MIT",
    "LICENSE-MIT.txt",
    "LICENSE-APACHE",
    "LICENSE-APACHE.txt",
    "LICENSE_MIT",
    "LICENSE_APACHE-2.0",
    "COPYING",
    "COPYING.txt",
    "NOTICE",
  ];
  const bases = prefix ? [prefix.replace(/\/$/, "") + "/", ""] : [""];
  const notices = [];
  for (const base of bases) {
    const fetched = await Promise.all(
      paths.map(async (file) => {
        const url =
          "https://raw.githubusercontent.com/" +
          repo +
          "/" +
          commit +
          "/" +
          base +
          file;
        try {
          const r = await fetch(url);
          if (r.ok) {
            const text = await r.text();
            if (text.length > 60 && !text.startsWith("<")) return { url, text };
          }
        } catch {}
        return null;
      }),
    );
    notices.push(...fetched.filter(Boolean));
    if (notices.length) break;
  }
  if (!notices.length) {
    failures.push({
      name: p.name,
      version: p.version,
      repository,
      commit,
      reason: "License path missing",
    });
    return;
  }
  fs.writeFileSync(
    dest,
    `${p.name} ${p.version}\nDeclared license: ${p.license}\n` +
      notices.map((n) => `\nSource: ${n.url}\n\n${n.text}`).join("\n"),
  );
}
for (let i = 0; i < missing.length; i += 5)
  await Promise.all(missing.slice(i, i + 5).map(collect));
fs.mkdirSync(".artifacts", { recursive: true });
fs.writeFileSync(
  ".artifacts/license-missing.json",
  JSON.stringify(failures, null, 2),
);
console.log(
  JSON.stringify(
    {
      missing: missing.length,
      collected: missing.length - failures.length,
      remaining: failures,
    },
    null,
    2,
  ),
);
