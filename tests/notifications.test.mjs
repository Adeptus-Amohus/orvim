import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { pathToFileURL } from "node:url";

let source = ts
  .transpileModule(
    fs.readFileSync("src/features/workspace/reminders.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ESNext } },
  )
  .outputText.replace(
    "./wellbeing.js",
    pathToFileURL(process.cwd() + "/src/features/workspace/wellbeing.js").href,
  );
const { reminderPlan } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const now = new Date("2026-10-07T10:00:00").valueOf();
const data = {
  languageMode: "ru",
  notificationSettings: { anchor: now },
  checkins: [],
  tasks: [{ id: 99, date: "2026-10-07", title: "Без времени" }],
  events: [
    { id: 1, date: "2026-10-07", start: "11:00", title: "Встреча" },
    { id: 2, date: "2026-10-07", start: "12:00", title: "Готово", done: true },
    { id: 3, date: "2026-10-07", start: "09:00", title: "Прошло" },
    { id: 4, date: "2026-10-07", start: "25:00", title: "Неверное время" },
  ],
};
let checks = 0;
function check(condition, description) {
  assert.ok(condition, description);
  checks++;
}
const plan = (settings = {}, checkins = []) =>
  reminderPlan(
    {
      data: {
        ...data,
        notificationSettings: { ...data.notificationSettings, ...settings },
        checkins,
      },
      covers: [],
    },
    now,
  );

const legacy = plan();
check(legacy.enabled, "Old settings keep reminders enabled");
check(legacy.wellbeingEnabled, "Old settings enable wellbeing");
check(legacy.scheduleEnabled, "Old settings enable schedule");
check(legacy.soundEnabled, "Selected sounds are enabled by default");
check(legacy.items.length === 1, "Only future unfinished events are notified");
check(legacy.items[0].kind === "event", "Timed tasks use event notifications");
check(
  legacy.items[0].at === now + 55 * 60000,
  "Schedule stays five minutes early",
);
check(
  legacy.wellbeingAt === new Date("2026-10-07T15:00:00").valueOf(),
  "Next wellbeing reminder is at 15:00",
);
check(legacy.wellbeingSlots.length === 3, "Default has three native slots");
check(
  plan({ wellbeingCount: 1 }).wellbeingSlots.length === 1,
  "One reminder reaches native plan",
);
check(
  plan({ wellbeingCount: 6 }).wellbeingSlots.length === 6,
  "Six reminders reach native plan",
);
const muted = plan({ soundEnabled: false });
check(!muted.soundEnabled, "Sound can be disabled");
check(muted.items.length === 1 && muted.enabled, "Muting keeps notifications");
check(
  muted.wellbeingAt === legacy.wellbeingAt,
  "Muting preserves check-in timing",
);
const scheduleOnly = plan({ wellbeingEnabled: false });
check(!scheduleOnly.wellbeingEnabled, "Wellbeing can be disabled separately");
check(
  scheduleOnly.enabled && scheduleOnly.items.length === 1,
  "Schedule stays enabled",
);
const wellbeingOnly = plan({ scheduleEnabled: false });
check(
  wellbeingOnly.items.length === 0,
  "Disabling schedule removes its reminders",
);
check(
  wellbeingOnly.enabled && wellbeingOnly.wellbeingEnabled,
  "Wellbeing stays enabled",
);
check(
  !plan({ wellbeingEnabled: false, scheduleEnabled: false }).enabled,
  "Both categories off disable native scheduling",
);
const disabled = plan({ enabled: false });
check(
  !disabled.enabled && disabled.items.length === 0,
  "Master switch cancels reminders",
);
check(
  disabled.wellbeingEnabled && disabled.scheduleEnabled,
  "Master switch preserves category preferences",
);
check(
  !plan({ enabled: false, soundEnabled: false }).soundEnabled,
  "Master switch preserves sound preference",
);
const checkedIn = plan({}, [{ at: now - 3600000 }, { at: now + 3600000 }]);
check(
  checkedIn.lastCheckinAt === now - 3600000,
  "Native plan identifies the latest real check-in for dismissing old reminders",
);
check(legacy.lastCheckinAt === 0, "Old data does not invent a check-in");
check(
  checkedIn.wellbeingAt === new Date("2026-10-07T15:00:00").valueOf(),
  "Future entries ignored and next period stays at 15:00",
);

const early = new Date("2026-10-07T08:00:00").valueOf();
const skip = reminderPlan(
  { data: { ...data, checkins: [{ at: early - 3600000 }] }, covers: [] },
  early,
);
check(
  skip.wellbeingAt === new Date("2026-10-07T15:00:00").valueOf(),
  "Morning check-in skips the 09:00 reminder",
);
const late = new Date("2026-10-07T22:00:00").valueOf();
check(
  reminderPlan({ data: { ...data, checkins: [] }, covers: [] }, late)
    .wellbeingAt === new Date("2026-10-08T09:00:00").valueOf(),
  "No overnight reminders",
);

for (const [production, candidate, raw, duration] of [
  ["wellbeing-compact", "short-03-compact", "life_wellbeing_compact", 1.05],
  ["schedule-warm", "velvet-01-warm", "life_schedule_warm", 1.9],
]) {
  const wav = fs.readFileSync(`public/sounds/notifications/${production}.wav`);
  check(
    wav.equals(fs.readFileSync(`public/sounds/candidates/v4/${candidate}.wav`)),
    `${production}: exact selected candidate`,
  );
  check(
    wav.equals(
      fs.readFileSync(`src-tauri/gen/android/app/src/main/res/raw/${raw}.wav`),
    ),
    `${production}: Android uses identical sound`,
  );
  check(
    wav.toString("ascii", 0, 4) === "RIFF" &&
      wav.toString("ascii", 8, 12) === "WAVE",
    `${production}: valid WAV container`,
  );
  check(
    wav.readUInt16LE(20) === 1 &&
      wav.readUInt16LE(22) === 2 &&
      wav.readUInt16LE(34) === 16,
    `${production}: stereo PCM16`,
  );
  check(wav.readUInt32LE(24) === 44100, `${production}: 44.1 kHz`);
  check(
    Math.abs(wav.readUInt32LE(40) / wav.readUInt32LE(28) - duration) < 0.001,
    `${production}: expected duration`,
  );
}
console.log(
  `Notification switches, timing and selected WAV assets: ${checks} assertions passed.`,
);
