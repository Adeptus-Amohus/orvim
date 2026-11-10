import assert from "node:assert/strict";
import {
  assistantContext,
  suggestAssistantContext,
} from "../src/features/workspace/assistant.js";
import {
  workoutGroup,
  workoutBatchRows,
  removeWorkoutBatch,
  restoreWorkoutBatch,
} from "../src/features/workspace/workout-batch.js";
import { proposedSnapshot } from "../src/features/workspace/changes.js";
import { createDictation } from "../src/features/workspace/dictation.js";
let checks = 0;
const check = (value, label) => {
  assert.ok(value, label);
  checks++;
};
const now = new Date("2026-10-17T12:00:00"),
  data = {
    version: 31,
    nextId: 100,
    projects: [],
    tasks: [],
    events: [],
    thoughts: [],
    archiveItems: [
      {
        id: 1,
        _syncId: "book-1",
        name: "Камо грядеши",
        category: "Книги",
        date: "2026-10-17",
        rating: null,
        review: "",
      },
      { id: 2, name: "Другой фильм", category: "Фильмы" },
    ],
    archiveCategories: ["Книги", "Фильмы", "Игры"],
    foodLogs: [
      {
        id: 3,
        name: "Завтрак",
        date: "2026-10-17",
        calories: 600,
        protein: 20,
        fat: 10,
        carbs: 100,
        nutritionBasis: "100g",
        nutritionBase: {
          calories: 200,
          protein: 6.67,
          fat: 3.33,
          carbs: 33.33,
        },
        grams: 300,
      },
      { id: 4, name: "Обед", date: "2026-10-16", calories: 400 },
    ],
    sleepLogs: [],
    waterLogs: [],
    workouts: [],
    trainingGoals: [],
    financeLogs: [],
    exercises: [],
    uiPreferences: {
      databaseCollections: [{ name: "Книги", ratingMax: 10, statuses: [] }],
    },
  };
check(
  !assistantContext(data, {}, now).archiveItems,
  "Empty context never leaks database",
);
let suggested = suggestAssistantContext(
  data,
  {},
  "Поставь оценку камо грядеши 5",
  now,
);
check(
  suggested.length === 1 &&
    suggested[0].ids.length === 1 &&
    suggested[0].ids[0] === "book-1",
  "Locally matches database title and stable identity",
);
check(
  !Object.hasOwn(data.uiPreferences, "aiSelection"),
  "Suggestion does not grant access or mutate preferences",
);
check(
  !suggestAssistantContext(
    data,
    { archiveItems: ["book-1"] },
    "Поставь оценку книге Камо грядеши 5",
    now,
  ).length,
  "Already selected title does not trigger attaching unrelated records",
);
check(
  suggestAssistantContext(data, {}, "Какие книги есть в базе данных?", now)[0]
    .ids.length === 2,
  "Catalog request offers source explicitly",
);
check(
  !suggestAssistantContext(data, {}, "Привет", now).length,
  "Ordinary chat sends no personal data suggestions",
);
let context = assistantContext(data, { archiveItems: ["book-1"] }, now);
check(
  context.archiveItems.length === 1 &&
    context.databaseCollections[0].ratingMax === 10,
  "AI receives actual rating scale with selected record",
);
context.archiveItems[0].name = "Changed";
check(
  data.archiveItems[0].name === "Камо грядеши",
  "Context is detached from stored records",
);
context = assistantContext(data, { archiveItems: ["*"] }, now);
check(
  context.databaseCollections.some((c) => c.name === "Игры"),
  "Selecting entire database includes empty collection definitions",
);
suggested = suggestAssistantContext(
  data,
  {},
  "Убери лишние калории за вчера",
  now,
);
check(
  suggested[0].kind === "foodLogs" && suggested[0].ids.join() === "4",
  "Food context follows yesterday",
);
check(
  suggestAssistantContext(
    data,
    {},
    "Исправь калории 2026-10-17",
    now,
  )[0].ids.join() === "3",
  "Explicit nutrition date wins",
);
check(
  !suggestAssistantContext(data, { foodLogs: ["*"] }, "Исправь калории", now)
    .length,
  "Selected nutrition is not requested twice",
);
let proposed = proposedSnapshot({ data, covers: [] }, [
  {
    collection: "archiveItems",
    operation: "upsert",
    id: 1,
    data: '{"rating":5}',
  },
]);
check(
  proposed.data.archiveItems[0].rating === 5 &&
    data.archiveItems[0].rating === null,
  "Rating proposal targets original record without applying early",
);
proposed = proposedSnapshot({ data, covers: [] }, [
  {
    collection: "foodLogs",
    operation: "upsert",
    id: 3,
    data: '{"calories":450}',
  },
]);
check(
  proposed.data.foodLogs[0].calories === 450 &&
    proposed.data.foodLogs[0].nutritionBase.calories === 450 &&
    proposed.data.foodLogs[0].nutritionBasis === "portion",
  "AI nutrition correction cannot reopen stale per-100g values",
);
proposed = proposedSnapshot({ data, covers: [] }, [
  { collection: "foodLogs", operation: "delete", id: 3, data: null },
]);
check(
  proposed.data.foodLogs.length === 1 && data.foodLogs.length === 2,
  "AI food deletion removes calories only in proposed snapshot",
);
assert.throws(() =>
  proposedSnapshot({ data, covers: [] }, [
    {
      collection: "foodLogs",
      operation: "upsert",
      id: 3,
      data: '{"calories":-100}',
    },
  ]),
);
checks++;
const original = {
  id: 1,
  trainingKey: "one",
  name: "Силовая",
  date: "2026-10-17",
  time: "17:00",
  duration: 30,
  done: false,
  entries: [{ exerciseKey: "pull", unit: "раз", sets: 3, plannedValue: 5 }],
};
const workouts = [
  original,
  { ...original, id: 2, trainingKey: "two", date: "2026-10-21" },
  { ...original, id: 3, trainingKey: "done", done: true },
  {
    ...original,
    id: 4,
    trainingKey: "health",
    healthSource: { key: "imported" },
  },
  {
    ...original,
    id: 5,
    trainingKey: "different",
    entries: [{ exerciseKey: "squat", unit: "раз", sets: 3 }],
  },
];
check(
  workoutGroup(original) === workoutGroup(workouts[1]) &&
    workoutGroup(original) !== workoutGroup(workouts[4]),
  "Legacy repeats require exercise identity, not just title",
);
check(
  workoutGroup({ ...original, seriesKey: "series" }) ===
    workoutGroup({ ...workouts[4], seriesKey: "series" }),
  "Explicit series survives editing exercise plan",
);
check(
  workoutBatchRows(workouts, {
    group: workoutGroup(original),
    from: "2026-10-17",
    until: "2026-10-21",
  }).length === 2,
  "Bulk candidates preserve completed and Health Connect by default",
);
check(
  workoutBatchRows(workouts, {
    group: workoutGroup(original),
    includeDone: true,
  }).length === 3,
  "Completed sessions require explicit option",
);
const batchData = {
    workouts: [...workouts],
    events: workouts.map((w) => ({ id: w.id + 10, workoutId: w.id })),
    tasks: [{ id: 99 }],
  },
  workoutArray = batchData.workouts,
  eventArray = batchData.events;
let removed = removeWorkoutBatch(batchData, ["one", "two", "health"]);
check(
  removed.workouts.length === 2 && removed.events.length === 2,
  "Only selected local sessions and linked events are deleted",
);
check(
  batchData.workouts === workoutArray &&
    batchData.events === eventArray &&
    batchData.tasks.length === 1,
  "Bulk mutation preserves shared arrays and unrelated data",
);
batchData.workouts.push({ ...original, id: 20, trainingKey: "new" });
restoreWorkoutBatch(batchData, removed);
check(
  batchData.workouts.length === 6 &&
    batchData.workouts[0].trainingKey === "one" &&
    batchData.workouts.at(-1).trainingKey === "new" &&
    batchData.events.length === 5,
  "Undo restores order and links while preserving newer records",
);
check(
  restoreWorkoutBatch(batchData, removed) === 0 &&
    batchData.events.length === 5,
  "Undo is idempotent",
);
const stress = { workouts: [], events: [] };
for (let i = 0; i < 100000; i++) {
  stress.workouts.push({ ...original, id: i + 1, trainingKey: "stress-" + i });
  stress.events.push({ id: i + 1, workoutId: i + 1 });
}
const started = performance.now();
removed = removeWorkoutBatch(
  stress,
  stress.workouts.map((w) => w.trainingKey),
);
check(
  !stress.workouts.length &&
    !stress.events.length &&
    removed.workouts.length === 100000,
  "100,000 linked sessions delete without argument limits",
);
restoreWorkoutBatch(stress, removed);
check(
  stress.workouts.length === 100000 &&
    stress.events.length === 100000 &&
    stress.workouts[99999].id === 100000,
  "100,000 sessions restore without loss",
);
const stressMs = Math.round(performance.now() - started);
let status,
  polls = 0,
  text = "Моя запись";
const dictation = createDictation({
  services: {
    platform: async (op) => {
      if (op === "speechStart")
        return {
          active: false,
          error: "Речевой пакет не установлен",
          needsModel: true,
          canDownload: true,
          mode: "local",
          engine: "Android",
        };
      if (op === "speechPoll") polls++;
      return {};
    },
  },
  getText: () => text,
  setText: (value) => (text = value),
  language: () => "ru",
  allowCloud: () => false,
  onStatus: (...args) => (status = args),
});
await dictation.start();
check(
  !dictation.active && !polls && text === "Моя запись",
  "Failed native start cannot leave a hot mic polling or erase draft",
);
check(
  status[2] && status[3].needsModel && status[3].mode === "local",
  "Speech status exposes repair and actual mode",
);
dictation.dispose();
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      stressSessions: 100000,
      stressMs,
      scope:
        "Pure logic and mocked speech bridge; no real device or external AI request",
    },
    null,
    2,
  ),
);
