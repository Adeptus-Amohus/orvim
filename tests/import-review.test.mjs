import assert from "node:assert/strict";
import { importRows, mergeImport } from "../src/features/workspace/changes.js";

const empty = () => ({
  data: {
    nextId: 1,
    tasks: [],
    events: [],
    projects: [],
    thoughts: [],
    archiveItems: [],
    archiveCategories: [],
  },
  covers: [],
});
const notion = {
  id: "page-id",
  properties: {
    Name: { type: "title", title: [{ plain_text: "Проект из Notion" }] },
    Notes: {
      type: "rich_text",
      rich_text: [{ text: { content: "Текст записи" } }],
    },
    Date: { type: "date", date: { start: "2026-11-02" } },
    Status: { type: "status", status: { name: "Done" } },
  },
};
let checks = 0;
function check(ok, label) {
  assert.ok(ok, label);
  checks++;
}
for (const kind of [
  "tasks",
  "events",
  "projects",
  "thoughts",
  "archiveItems",
]) {
  const rows = importRows({ results: [notion] }, kind, "notion", "source-id");
  const first = mergeImport(empty(), rows);
  const target = kind === "events" ? "tasks" : kind;
  check(first.snapshot.data[target].length === 1, kind + " imported");
  const again = mergeImport(
    first.snapshot,
    importRows(
      { results: [notion] },
      kind,
      "notion",
      "https://notion.so/another-link",
    ),
  );
  check(
    again.snapshot.data[target].length === 1,
    kind + " deduplicated across Notion links",
  );
  const removed = importRows(
    { results: [{ ...notion, in_trash: true }] },
    kind,
    "notion",
    "source-id",
  );
  check(
    mergeImport(again.snapshot, removed).snapshot.data[target].length === 0,
    kind + " removal respected",
  );
  const local = structuredClone(first.snapshot);
  const item = local.data[target][0];
  if (target === "archiveItems") item.review = "Моя правка";
  else if (target === "projects") item.description = "Моя правка";
  else item.title = "Моя правка";
  const protectedResult = mergeImport(local, removed);
  check(
    protectedResult.counts.conflicts === 1 &&
      protectedResult.snapshot.data[target].length === 1,
    kind + " local changes protected",
  );
}
for (const body of [
  [{ id: 0, title: "JSON", done: false }],
  { data: [{ id: 0, title: "JSON", done: "false" }] },
  { items: [{ id: 0, title: "JSON" }] },
  { results: [{ id: 0, title: "JSON" }] },
  { data: { tasks: [{ id: 0, title: "JSON" }] } },
]) {
  const rows = importRows(body, "tasks", "json", "https://example.test/api");
  check(
    rows[0].record.source.id === "0" && rows[0].record.done === false,
    "JSON envelope and zero ID",
  );
}
check(
  importRows({ results: [notion] }, "tasks", "notion", "source")[0].record.done,
  "Notion status is completed",
);
for (const payload of [null, "not-json", {}, { data: {} }])
  assert.throws(() => importRows(payload, "tasks", "json", "url"));
const timed = importRows(
  {
    items: [
      {
        id: "calendar",
        summary: "Встреча",
        // Import renders events in the device's local timezone. Construct a
        // local midnight crossing so this fixture also tests that path on UTC CI.
        start: { dateTime: new Date(2026, 10, 2, 23, 30).toISOString() },
        end: { dateTime: new Date(2026, 10, 3, 1, 0).toISOString() },
      },
    ],
  },
  "events",
  "google",
  "primary",
);
check(timed.length === 2, "calendar night crosses dates");
check(
  timed[0].record.date === "2026-11-02" &&
    timed[0].record.start === "23:30" &&
    timed[1].record.date === "2026-11-03" &&
    timed[1].record.end === "01:00",
  "calendar parts preserve the device's local dates and times",
);
const calendar = mergeImport(empty(), timed);
check(
  mergeImport(calendar.snapshot, timed).snapshot.data.events.length === 2,
  "calendar pages do not duplicate events",
);
const cancelled = importRows(
  { items: [{ id: "calendar", status: "cancelled" }] },
  "events",
  "google",
  "primary",
);
check(
  mergeImport(calendar.snapshot, cancelled).snapshot.data.events.length === 0,
  "cancelled calendar event removes all parts",
);
console.log(
  checks +
    " import checks passed (synthetic Notion, JSON API and Google Calendar records)",
);
