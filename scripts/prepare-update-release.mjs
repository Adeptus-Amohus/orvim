import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const [folder, repository = "Adeptus-Amohus/orvim-updates"] =
  process.argv.slice(2);
if (!folder || !/^[\w.-]+\/[\w.-]+$/.test(repository))
  throw Error("Specify a release folder and GitHub owner/repository.");
const root = path.resolve(folder);
const info = JSON.parse(
  fs.readFileSync(path.join(root, "build-info.json"), "utf8"),
);
if (!/^\d+\.\d+\.\d+$/.test(info.version))
  throw Error("Invalid release version.");
const platforms = {};
for (const [platform, file] of [
  ["windows-x86_64", `Orvim-${info.version}-setup.exe`],
  ["android-aarch64", `Orvim-${info.version}-arm64.apk`],
]) {
  const bytes = fs.readFileSync(path.join(root, file));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const record = info.files.find((row) => row.file === file);
  if (
    !record ||
    record.sha256.toLowerCase() !== sha256 ||
    record.bytes !== bytes.length
  )
    throw Error(`Release package changed after verification: ${file}`);
  platforms[platform] = {
    url: `https://github.com/${repository}/releases/download/v${info.version}/${file}`,
    sha256,
    size: bytes.length,
  };
}
const manifest = {
  manifest_version: 1,
  releases: [
    {
      version: info.version,
      notes: fs.readFileSync(path.join(root, "Release-notes.md"), "utf8"),
      schema_min: 3,
      schema_max: 3,
      workspace_max: 32,
      platforms,
    },
  ],
};
fs.writeFileSync(
  path.join(root, "orvim-updates.unsigned.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Verified release manifest prepared for ${repository}; nothing published.`,
);
