import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  syncDifferences,
  syncConflictValue,
} from "../src/features/workspace/sync-review.js";
import {
  personalDay,
  personalDayWindow,
  timestampInPersonalDay,
  lifeRecordDay,
  lifeTrackingDefaults,
  lifeSettings,
  validateLifeTracking,
  workoutAdherence,
  nutrientTotals,
  weightSeries,
  stampLifeRecord,
  matchingStepDays,
  illnessDays,
} from "../src/features/workspace/life-tracking-model.js";
import { assistantContext } from "../src/features/workspace/assistant.js";
import { stepStatistics } from "../src/features/workspace/life-statistics.js";
import {
  mergeHealthData,
  plannedWorkoutEntries,
  validateTrainingData,
  goalState,
} from "../src/features/workspace/training-model.js";
const prefs = {
  ...lifeTrackingDefaults(),
  personalDay: { enabled: true, start: "22:00" },
};
const data = {
  version: 32,
  lifePreferences: prefs,
  illnessLogs: [],
  nutrientLogs: [],
  weightLogs: [],
};
assert.equal(
  lifeSettings({
    lifePreferences: { nutrition: { calories: false, micronutrients: true } },
  }).nutrition.calories,
  true,
);
assert.equal(
  lifeSettings({ lifePreferences: { nutrition: { micronutrients: true } } })
    .nutrition.micronutrients,
  false,
);
const at = (s) => new Date(s).getTime();
assert.equal(personalDay(at("2026-10-29T21:59:59"), data), "2026-10-28");
assert.equal(personalDay(at("2026-10-29T22:00:00"), data), "2026-10-29");
assert.equal(personalDay(at("2027-01-01T01:00:00"), data), "2026-12-31");
assert.equal(personalDay(at("2024-03-01T01:00:00"), data), "2024-02-29");
assert.equal(personalDay(at("2026-10-29T01:00:00"), {}), "2026-10-29");
assert.equal(
  lifeRecordDay(
    {
      date: "2026-10-29",
      manualOverride: true,
      personalDate: true,
      healthSource: { end: at("2026-10-29T09:00:00") },
    },
    data,
    "sleepLogs",
  ),
  "2026-10-29",
);
assert.equal(
  lifeRecordDay(
    { date: "2026-10-29", at: at("2026-10-29T04:00:00"), ml: 250 },
    data,
    "waterLogs",
  ),
  "2026-10-28",
);
assert.equal(
  lifeRecordDay(
    { date: "2026-10-29", at: at("2026-10-29T04:00:00") },
    data,
    "checkins",
  ),
  "2026-10-28",
);
const window = personalDayWindow("2026-10-29", data);
assert.equal(window.from, at("2026-10-29T22:00:00"));
assert.equal(window.until, at("2026-10-30T22:00:00"));
assert.equal(
  timestampInPersonalDay("2026-10-29", "04:00", data),
  at("2026-10-30T04:00:00"),
);
assert.equal(
  lifeRecordDay({ date: "2026-10-29", time: "04:00" }, data, "workouts"),
  "2026-10-28",
);
assert.equal(
  lifeRecordDay({ date: "2026-10-29" }, data, "foodLogs"),
  "2026-10-29",
);
assert.equal(
  lifeRecordDay(
    { date: "2026-10-29", healthSource: { end: at("2026-10-29T09:00:00") } },
    data,
    "sleepLogs",
  ),
  "2026-10-28",
);
assert.equal(
  stampLifeRecord(
    { date: "2026-10-29" },
    data,
    "foodLogs",
    at("2026-10-30T04:00:00"),
  ).occurredAt,
  at("2026-10-30T04:00:00"),
);
data.illnessLogs = [
  { id: 1, date: "2026-10-27", until: "2026-10-28" },
  { id: 2, date: "2026-10-28", until: "2026-10-29" },
];
assert.deepEqual(illnessDays(data.illnessLogs, "2026-10-26", "2026-10-30"), [
  "2026-10-27",
  "2026-10-28",
  "2026-10-29",
]);
assert.deepEqual(
  workoutAdherence(
    [
      { date: "2026-10-27", done: false },
      { date: "2026-10-28", done: true },
      { date: "2026-10-30", done: false },
    ],
    data,
  ),
  { planned: 3, done: 1, excused: 1, eligible: 2, percent: 50 },
);
assert.equal(
  workoutAdherence([{ date: "2026-10-27", done: false }], data).percent,
  null,
);
const steps = stepStatistics(
  [
    { date: "2026-10-26", count: 1000 },
    { date: "2026-10-28", count: 200 },
  ],
  "2026-10-26",
  "2026-10-29",
  data,
);
assert.equal(steps.total, 1200);
assert.equal(steps.illnessDays, 3);
assert.equal(steps.averageOutsideIllness, 1000);
assert.equal(steps.missingDaysOutsideIllness, 0);
assert.equal(
  matchingStepDays(
    [
      {
        date: "2026-10-28",
        count: 100,
        source: "health-connect",
        dayStartMinutes: 0,
      },
    ],
    data,
  ).length,
  0,
);
data.lifePreferences.nutrientTargets = [
  { key: "v", name: "Магний", unit: "мг", target: 100 },
];
data.nutrientLogs = [
  {
    id: 3,
    date: "2026-10-28",
    nutrientKey: "v",
    name: "Магний",
    unit: "мг",
    amount: 25,
  },
  {
    id: 4,
    date: "2026-10-28",
    nutrientKey: "v",
    name: "Магний",
    unit: "мкг",
    amount: 100,
  },
];
assert.equal(nutrientTotals(data, "2026-10-28")[0].percent, 25);
data.weightLogs = [
  { id: 5, date: "2026-10-27", kg: 75 },
  { id: 6, date: "2026-10-28", kg: 74.5 },
  { id: 7, date: "2026-10-28", kg: 74.8 },
];
assert.deepEqual(weightSeries(data).points, [
  { date: "2026-10-27", kg: 75 },
  { date: "2026-10-28", kg: 74.8 },
]);
assert.equal(weightSeries(data).change, -0.2);
validateLifeTracking(data);
for (const bad of [
  { ...data, lifePreferences: { personalDay: null } },
  { ...data, lifePreferences: { nutrition: 5 } },
  { ...data, weightLogs: [{ id: 1, date: "2026-10-28", kg: "70" }] },
  {
    ...data,
    illnessLogs: [{ id: 1, date: "2026-10-28", until: "2026-10-27" }],
  },
  { ...data, nutrientLogs: [{ ...data.nutrientLogs[0], amount: -1 }] },
])
  assert.throws(() => validateLifeTracking(bad));
const context = assistantContext(
  {
    ...data,
    foodLogs: [
      {
        id: 11,
        date: "2026-10-29",
        occurredAt: at("2026-10-29T04:00:00"),
        calories: 100,
      },
    ],
    workouts: [],
    stepLogs: [],
  },
  { lifeData: ["*"] },
  new Date("2026-10-29T09:00:00"),
  "за сегодня",
);
assert.equal(context.today, "2026-10-28");
assert.equal(context.foodLogs.length, 1);
assert.equal(context.lifeSummary.nutrition.consumedCalories, 100);
assert.equal(context.lifeSummary.weight.last, 74.8);
assert.equal(context.illnessLogs.length, 2);
assert.equal(assistantContext(data, {}, new Date()).weightLogs, undefined);
assert.equal(
  plannedWorkoutEntries([
    { exerciseKey: "1", name: "Test", unit: "раз", sets: 1, effort: 5 },
  ])[0].effort,
  undefined,
);
const health = { stepLogs: [], sleepLogs: [], workouts: [] };
mergeHealthData(
  health,
  {
    granted: ["steps", "sleep"],
    steps: [{ date: "2026-10-28", count: 200, dayStartMinutes: 1320 }],
    sleep: [
      {
        date: "2026-10-28",
        key: "a",
        origin: "watch",
        start: at("2026-10-29T01:00:00"),
        end: at("2026-10-29T09:00:00"),
      },
    ],
  },
  () => 1,
  { steps: true, sleep: true },
);
assert.equal(health.stepLogs[0].dayStartMinutes, 1320);
const goal = {
  kind: "exercise",
  exerciseKey: "pull",
  unit: "раз",
  from: "2026-10-28",
  until: "2026-10-28",
  baseline: 0,
  target: 20,
  calculation: "latest",
};
const workout = {
  id: 8,
  date: "2026-10-29",
  time: "04:00",
  name: "Подтягивания",
  duration: 30,
  done: true,
  entries: [
    {
      exerciseKey: "pull",
      name: "Подтягивания",
      unit: "раз",
      sets: 1,
      value: 10,
      done: true,
      effort: 4,
    },
  ],
};
assert.equal(goalState(goal, [workout], data).percent, 50);
assert.equal(goalState(goal, [workout], {}).percent, 0);
validateTrainingData({ workouts: [workout] });
validateTrainingData({
  workouts: [{ ...workout, effort: 4, effortRatedAt: Date.now() }],
});
for (const effort of [0, 6, 3.5, "4"])
  assert.throws(() =>
    validateTrainingData({ workouts: [{ ...workout, effort }] }),
  );
assert.throws(() =>
  validateTrainingData({
    workouts: [{ ...workout, entries: [{ ...workout.entries[0], effort: 6 }] }],
  }),
);
assert.equal(health.sleepLogs[0].healthSource.end, at("2026-10-29T09:00:00"));
const changes = syncDifferences({ data: {} }, { data });
for (const kind of ["weightLogs", "illnessLogs", "nutrientLogs"])
  assert(changes.some((row) => row.collection === kind));
assert(
  changes.some(
    (row) => row.collection === "@settings" && row.title === "Мой учёт",
  ),
);
assert.match(
  syncConflictValue(
    { collection: "@settings", uid: "lifePreferences" },
    data.lifePreferences,
  ),
  /Начало дня: 22:00/,
);
const dst = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    `import {personalDayWindow} from './src/features/workspace/life-tracking-model.js';const d={lifePreferences:{personalDay:{enabled:true,start:'22:00'}}};const a=personalDayWindow('2026-03-28',d),b=personalDayWindow('2026-10-24',d);if((a.until-a.from)/3600000!==23||(b.until-b.from)/3600000!==25)throw Error('DST boundary');`,
  ],
  { env: { ...process.env, TZ: "Europe/Berlin" }, encoding: "utf8" },
);
assert.equal(dst.status, 0, dst.stderr);
assert.equal(
  weightSeries({
    weightLogs: Array.from({ length: 10000 }, (_, id) => ({
      id: id + 1,
      date: "2026-10-28",
      kg: 70 + id / 10000,
    })),
  }).points.length,
  1,
);
console.log(
  "Personal day, legacy data, illness, nutrition, weight, context privacy and health import passed",
);
