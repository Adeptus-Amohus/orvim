import assert from "node:assert/strict";
import { dueToday, localDay } from "../src/features/workspace/changes.js";
const now = new Date(2026, 9, 8, 23, 59),
  today = localDay(now);
const data = {
  tasks: [
    { id: 1, date: today, title: "Без времени" },
    {
      id: 2,
      date: today,
      time: "12:30",
      createdAt: "2026-09-01",
      title: "Заранее",
    },
    { id: 3, date: "2026-10-09", time: "10:00", title: "Завтра" },
    { id: 4, createdAt: today, time: "10:00", title: "Без назначенной даты" },
    { id: 5, date: today, time: "24:00", title: "Неверное время" },
  ],
  events: [{ id: 6, date: today, start: "08:00", end: "09:00" }],
};
assert.deepEqual(
  dueToday(data, now).map((row) => row.item.id),
  [6, 2],
);
assert.deepEqual(
  dueToday(data, new Date(2026, 9, 9, 0, 0)).map((row) => row.item.id),
  [3],
);
assert.deepEqual(
  data.tasks.map((row) => row.id),
  [1, 2, 3, 4, 5],
);
assert.equal(
  dueToday(
    { tasks: [{ id: 7, date: localDay(new Date(2026, 0, 1)), time: "00:00" }] },
    new Date(2026, 0, 1),
  ).length,
  1,
);
const mixed = {
  tasks: [
    {
      id: 8,
      title: "Завершённая задача",
      date: today,
      time: "07:00",
      done: true,
    },
    { id: 9, title: "Ещё сделать", date: today, time: "18:00", done: false },
  ],
  events: [
    { id: 10, title: "Тренировка", date: today, start: "08:00", done: true },
    { id: 11, title: "Встреча", date: today, start: "12:00", done: false },
  ],
};
assert.deepEqual(
  dueToday(mixed, now).map(({ item }) => item.id),
  [11, 9, 8, 10],
);
assert.deepEqual(
  mixed.tasks.map(({ id }) => id),
  [8, 9],
  "Sorting does not rewrite stored data",
);
mixed.tasks[1].done = true;
assert.deepEqual(
  dueToday(mixed, now).map(({ item }) => item.id),
  [11, 8, 10, 9],
);
mixed.events[0].done = false;
assert.deepEqual(
  dueToday(mixed, now).map(({ item }) => item.id),
  [10, 11, 8, 9],
);
assert.equal(
  mixed.events[0].title,
  "Тренировка",
  "Completion never renames a record",
);
console.log(
  "Today: 9 assertions passed (assigned time, local date, completed last, undo, stable titles, no data mutation).",
);
