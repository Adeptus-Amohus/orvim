import { spawnSync } from "node:child_process";
for (const name of [
  "actions",
  "features",
  "checkin",
  "regression",
  "removal",
  "upgrades",
  "ui-0.4.18",
  "workout-rest.test",
  "mobile-ux",
  "current-fixes",
  "ux-0.4.22",
  "audit-fixes",
]) {
  const result = spawnSync(process.execPath, [`tests/${name}.cjs`], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const persistence = spawnSync(process.execPath, ["tests/persistence.mjs"], {
  stdio: "inherit",
});
if (persistence.status !== 0) process.exit(persistence.status ?? 1);
const changes = spawnSync(process.execPath, ["tests/changes.mjs"], {
  stdio: "inherit",
});
if (changes.status !== 0) process.exit(changes.status ?? 1);
for (const file of [
  "performance.test.mjs",
  "window-close.test.mjs",
  "widgets.test.mjs",
  "english-labels.test.mjs",
  "collection-settings.test.mjs",
  "notifications.test.mjs",
  "wellbeing.test.mjs",
  "lan.test.mjs",
  "pairing.test.mjs",
  "today.test.mjs",
  "assistant.test.mjs",
  "security.test.mjs",
  "completion-icon.test.mjs",
  "scroll-chain.test.mjs",
  "interactions.test.mjs",
  "database-cover.test.mjs",
  "current-fixes.test.mjs",
  "life-statistics.test.mjs",
  "life-tracking.test.mjs",
  "import-review.test.mjs",
  "audit-fixes.test.mjs",
]) {
  const result = spawnSync(process.execPath, [`tests/${file}`], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
