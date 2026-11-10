import fs from "node:fs";

const reportPath = process.argv[2];
if (!reportPath) {
  throw new Error(
    "Pass the Gradle universalReleaseRuntimeClasspath report path.",
  );
}
const report = fs.readFileSync(reportPath, "utf8");
if (
  !report.includes("universalReleaseRuntimeClasspath") ||
  !report.includes("BUILD SUCCESSFUL")
) {
  throw new Error(
    "Expected a successful universalReleaseRuntimeClasspath report.",
  );
}
const coordinates = new Set();
for (const match of report.matchAll(
  /--- ([\w.-]+):([\w.-]+):([^\s]+)(?: -> ([^\s]+))?/g,
)) {
  const [, group, artifact, requested, selected] = match;
  coordinates.add(
    selected?.includes(":")
      ? selected
      : `${group}:${artifact}:${selected || requested}`,
  );
}
if (!coordinates.size) throw new Error("No resolved dependencies found.");
const notices = fs
  .readFileSync("third-party/android-notices.txt", "utf8")
  .replaceAll("\r\n", "\n");
const missing = [...coordinates].filter(
  (coordinate) => !notices.includes(`\n${coordinate}\n`),
);
if (missing.length)
  throw new Error(`Missing Android runtime notices:\n${missing.join("\n")}`);
console.log(
  `Verified notices for ${coordinates.size} resolved Android runtime coordinates (including BOM metadata).`,
);
