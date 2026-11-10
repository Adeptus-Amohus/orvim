import assert from "node:assert/strict";
import { test } from "node:test";
import { widgetSnapshot } from "../src/features/workspace/widget-model.js";
const now = new Date("2026-11-05T02:00:00").valueOf();
const data = {
  languageMode: "ru",
  foodTarget: 2200,
  lifePreferences: { personalDay: { enabled: true, start: "06:00" } },
  tasks: [
    { id: 1, title: "No project", createdDate: "2026-11-05", done: false },
    {
      id: 2,
      title: "Project undated",
      createdDate: "2026-11-05",
      context: "Site",
    },
    { id: 3, title: "Future", date: "2026-11-06", time: "18:00" },
  ],
  events: [
    {
      id: 5,
      title: "Workout",
      date: "2026-11-05",
      start: "18:00",
      end: "18:45",
    },
  ],
  foodLogs: [{ date: "2026-11-05", occurredAt: now, calories: 150 }],
  connectionSettings: { apiKey: "must not leave" },
  thoughts: [{ id: 42, body: "private thought text" }],
};
test("widget keeps home task/date rules and schedule boundaries", () => {
  const result = widgetSnapshot({ data }, now);
  const today = result.days.find((d) => d.date === "2026-11-05");
  assert.deepEqual(
    today.items.map((r) => r.id),
    [5, 1],
  );
  assert.equal(today.items[0].end, "18:45");
  assert.equal(result.days.find((d) => d.date === "2026-11-06").items[0].id, 3);
});
test("nutrition respects personal day before midnight boundary", () => {
  const result = widgetSnapshot({ data }, now);
  assert.equal(result.dayStartMinutes, 360);
  assert.equal(result.days.find((d) => d.date === "2026-11-04").calories, 150);
  assert.equal(result.days.find((d) => d.date === "2026-11-05").calories, 0);
});
test("cache projection never includes API keys or unrelated private records", () => {
  const serialized = JSON.stringify(widgetSnapshot({ data }, now));
  assert.ok(!serialized.includes("must not leave"));
  assert.ok(!serialized.includes("private thought text"));
});
test("day rollover drops old task date and locales resolve", () => {
  const later = widgetSnapshot(
    { data: { ...data, languageMode: "system" } },
    new Date("2026-11-07T07:00:00").valueOf(),
    "en-US",
  );
  assert.equal(later.language, "en");
  assert.equal(later.days.find((d) => d.date === "2026-11-07").items.length, 0);
});
test("widgets carry all appearance settings and reject invalid colors", () => {
  for (const palette of ["sun", "pine", "scarlet", "winter", "custom"]) {
    for (const appearance of ["light", "dark", "system"]) {
      const result = widgetSnapshot(
        { data: { ...data, palette, appearance, customColor: "#ab1234" } },
        now,
      );
      assert.equal(result.palette, palette);
      assert.equal(result.appearance, appearance);
      assert.equal(result.customColor, "#ab1234");
    }
  }
  assert.equal(
    widgetSnapshot(
      { data: { ...data, palette: "invalid", customColor: "url(x)" } },
      now,
    ).palette,
    "sun",
  );
  assert.equal(
    widgetSnapshot({ data: { ...data, customColor: "url(x)" } }, now)
      .customColor,
    "#8c6ad8",
  );
});
