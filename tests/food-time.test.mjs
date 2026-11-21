import assert from "node:assert/strict";
import {
  foodRecordDateTime,
  setFoodRecordDateTime,
  lifeRecordDay,
} from "../src/features/workspace/life-tracking-model.js";
import { proposedSnapshot } from "../src/features/workspace/changes.js";
import { assistantContext } from "../src/features/workspace/assistant.js";

const data = {
  version: 32,
  nextId: 2,
  selectedDate: "2026-11-20",
  projects: [],
  tasks: [],
  events: [],
  trainingGoals: [],
  workouts: [],
  lifePreferences: { personalDay: { enabled: true, start: "05:00" } },
  foodLogs: [
    {
      id: 1,
      date: "2026-11-20",
      occurredAt: new Date("2026-11-20T05:15:00").getTime(),
      name: "Куриная грудка",
      calories: 330,
      protein: 60,
      fat: 7,
      carbs: 0,
    },
  ],
};
const change = (fields) =>
  proposedSnapshot({ data, covers: [] }, [
    {
      operation: "upsert",
      collection: "foodLogs",
      id: 1,
      data: JSON.stringify(fields),
    },
  ]);
const moved = change({ time: "03:00" });
assert.equal(moved.data.foodLogs.length, 1);
assert.equal(moved.data.foodLogs[0].date, "2026-11-19");
assert.equal(
  lifeRecordDay(moved.data.foodLogs[0], data, "foodLogs"),
  "2026-11-19",
);
assert.deepEqual(foodRecordDateTime(moved.data.foodLogs[0]), {
  date: "2026-11-20",
  time: "03:00",
});
assert.equal(moved.data.foodLogs[0].calories, 330);
assert.equal(data.foodLogs[0].date, "2026-11-20");
for (const [date, time, expected] of [
  ["2026-11-20", "04:59", "2026-11-19"],
  ["2026-11-20", "05:00", "2026-11-20"],
  ["2027-01-01", "00:00", "2026-12-31"],
  ["2024-03-01", "03:00", "2024-02-29"],
]) {
  const row = setFoodRecordDateTime({ id: 1 }, date, time, data);
  assert.equal(row.date, expected);
  assert.deepEqual(foodRecordDateTime(row), { date, time });
  assert.deepEqual(foodRecordDateTime(JSON.parse(JSON.stringify(row))), {
    date,
    time,
  });
  assert.equal(change({ date, time }).data.foodLogs[0].date, expected);
}
const unchanged = change({ name: "Грудка" }).data.foodLogs[0];
assert.equal(unchanged.occurredAt, data.foodLogs[0].occurredAt);
assert.equal(
  change({ date: "2026-11-18" }).data.foodLogs[0].date,
  "2026-11-18",
);
assert.deepEqual(foodRecordDateTime({ date: "2026-11-19" }), {
  date: "2026-11-19",
  time: "",
});
assert.deepEqual(
  foodRecordDateTime({
    date: "2026-11-20",
    loggedAt: new Date("2026-11-20T03:00:00").getTime(),
  }),
  { date: "2026-11-20", time: "03:00" },
);
const cleared = setFoodRecordDateTime(
  { ...moved.data.foodLogs[0] },
  "2026-11-19",
  "",
  data,
);
assert.equal(cleared.occurredAt, undefined);
assert.equal(lifeRecordDay(cleared, data, "foodLogs"), "2026-11-19");
for (const time of ["25:00", "03:90", "invalid"])
  assert.throws(() => change({ time }));
const context = assistantContext(data, { foodLogs: [1] }, Date.now());
assert.equal(context.foodLogs[0].calendarDate, "2026-11-20");
assert.equal(context.foodLogs[0].time, "05:15");
console.log(
  "Food time edits, personal-day boundaries, legacy records and assistant proposals passed.",
);
