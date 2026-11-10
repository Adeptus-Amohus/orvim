import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { pathToFileURL } from "node:url";
import {
  financialSummary,
  importRows,
  mergeImport,
  proposedSnapshot,
  ratingParts,
} from "../src/features/workspace/changes.js";
const module = ts
  .transpileModule(
    fs.readFileSync("src/features/workspace/reminders.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ESNext } },
  )
  .outputText.replace(
    "./wellbeing.js",
    pathToFileURL(process.cwd() + "/src/features/workspace/wellbeing.js").href,
  );
const { reminderPlan } = await import(
  "data:text/javascript;base64," + Buffer.from(module).toString("base64")
);
let count = 0;
const check = (value, message) => {
  assert.ok(value, message);
  count++;
};
const data = {
  version: 30,
  nextId: 1,
  tasks: [],
  events: [],
  projects: [],
  thoughts: [],
  archiveItems: [],
  archiveCategories: [],
  financeLogs: [],
  foodLogs: [],
  waterLogs: [],
  workouts: [],
  trainingGoals: [],
  exercises: [],
  sleepLogs: [],
  checkins: [],
  languageMode: "ru",
};
let snapshot = { data, covers: [] };
check(ratingParts(4.5).join() === "1,1,1,1,0.5", "Half stars");
let summary = financialSummary(
  [
    { date: "2026-10-05", currency: "KZT", type: "income", amount: 0.3 },
    {
      date: "2026-10-05",
      currency: "KZT",
      type: "expense",
      category: "A",
      amount: 0.1,
    },
    { date: "2026-10-05", currency: "USD", type: "income", amount: 100 },
  ],
  "2026-10",
  "KZT",
);
check(summary.balance === 0.2, "Integer cents and isolated currencies");
const payload = {
  items: [
    {
      id: "remote1",
      summary: "Встреча",
      start: { dateTime: "2026-10-06T12:00:00+05:00" },
      end: { dateTime: "2026-10-06T13:00:00+05:00" },
    },
  ],
};
let rows = importRows(payload, "events", "google", "primary");
let merged = mergeImport(snapshot, rows);
check(merged.counts.added === 1, "Import added");
snapshot = merged.snapshot;
merged = mergeImport(snapshot, rows);
check(merged.snapshot.data.events.length === 1, "Repeat import deduplicated");
snapshot.data.events[0].title = "Моя правка";
merged = mergeImport(snapshot, rows);
check(
  merged.counts.conflicts === 1 &&
    merged.snapshot.data.events[0].title === "Моя правка",
  "Local conflict retained",
);
let cancelled = importRows(
  { items: [{ id: "remote1", status: "cancelled" }] },
  "events",
  "google",
  "primary",
);
check(
  mergeImport(snapshot, cancelled).counts.conflicts === 1,
  "Remote removal does not delete local edits",
);
snapshot = mergeImport(
  { data: structuredClone(data), covers: [] },
  rows,
).snapshot;
check(
  mergeImport(snapshot, cancelled).snapshot.data.events.length === 0,
  "Unedited remote removal applied",
);
rows = importRows(
  {
    items: [
      {
        id: "allDay",
        summary: "Целый день",
        start: { date: "2026-10-06" },
        end: { date: "2026-10-07" },
      },
    ],
  },
  "events",
  "google",
  "primary",
);
check(rows[0].kind === "tasks", "All-day event becomes task");
check(
  importRows([{ name: "Без ID" }], "tasks", "json", "url")[0].skip,
  "Missing stable IDs reported",
);
rows = importRows(
  [
    {
      id: "a",
      title: "Ночью",
      start: { dateTime: "2026-10-06T23:00:00" },
      end: { dateTime: "2026-10-07T02:00:00" },
    },
  ],
  "events",
  "json",
  "url",
);
check(
  rows.length === 2 && rows.every((row) => row.record.source.multiDay),
  "Multiday calendar preserves both days",
);
rows = importRows(
  [{ id: "a", title: "Со временем", date: "2026-10-06", time: "12:00" }],
  "tasks",
  "json",
  "url",
);
check(rows[0].kind === "events", "Timed import is scheduled");
snapshot = { data: structuredClone(data), covers: [] };
const changes = [
  {
    operation: "upsert",
    collection: "projects",
    id: null,
    data: '{"name":"Поездка","description":"","tone":"pine"}',
  },
  {
    operation: "upsert",
    collection: "tasks",
    id: null,
    data: '{"title":"Билеты","context":"Поездка","date":"2026-10-06","done":false}',
  },
];
let proposed = proposedSnapshot(snapshot, changes);
check(
  proposed.data.tasks.length === 1 && snapshot.data.tasks.length === 0,
  "Atomic proposals do not mutate original",
);
proposed = proposedSnapshot(proposed, [
  {
    operation: "upsert",
    collection: "projects",
    id: 1,
    data: '{"name":"Лето"}',
  },
]);
check(proposed.data.tasks[0].context === "Лето", "Project rename propagates");
assert.throws(() =>
  proposedSnapshot(snapshot, [
    {
      operation: "upsert",
      collection: "tasks",
      id: null,
      data: '{"source":{"id":"spoof"}}',
    },
  ]),
);
count++;
assert.throws(() =>
  proposedSnapshot(snapshot, [
    { operation: "delete", collection: "tasks", id: 999, data: null },
  ]),
);
count++;
const now = new Date("2026-10-05T10:00:00").valueOf();
data.notificationSettings = { enabled: true, anchor: now };
data.events = [
  { id: 1, date: "2026-10-05", start: "11:00", title: "Встреча" },
  { id: 2, date: "2026-10-05", start: "12:00", title: "Готово", done: true },
];
data.tasks = [{ id: 3, date: "2026-10-05", title: "Без времени" }];
let plan = reminderPlan({ data, covers: [] }, now);
check(plan.items.length === 1, "Only unfinished scheduled events notified");
check(
  plan.items[0].at === new Date("2026-10-05T10:55:00").valueOf(),
  "Exactly 5 minutes before",
);
check(plan.wellbeingAt === now + 5 * 3600_000, "Afternoon wellbeing at 15:00");
data.checkins = [{ at: now + 3600_000 }];
plan = reminderPlan({ data, covers: [] }, now + 2 * 3600_000);
check(
  plan.wellbeingAt === now + 5 * 3600_000,
  "Morning check-in does not shift the afternoon reminder",
);
data.notificationSettings.enabled = false;
check(
  !reminderPlan({ data, covers: [] }, now).enabled,
  "Notifications disabled",
);
console.log(
  `New data transformations and reminder planner: ${count} assertions passed.`,
);
