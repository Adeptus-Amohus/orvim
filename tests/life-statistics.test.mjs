import assert from "node:assert/strict";
import {
  statsPeriod,
  requestLifePeriod,
  stepStatistics,
  lifeContextSummary,
} from "../src/features/workspace/life-statistics.js";
import {
  assistantContext,
  suggestAssistantContext,
} from "../src/features/workspace/assistant.js";
let checks = 0;
const check = (v, label) => {
    assert.ok(v, label);
    checks++;
  },
  now = new Date("2026-10-18T12:00:00");
for (const [query, from, until] of [
  ["за сегодня", "2026-10-18", "2026-10-18"],
  ["за вчера", "2026-10-17", "2026-10-17"],
  ["за позавчера", "2026-10-16", "2026-10-16"],
  ["за неделю", "2026-10-12", "2026-10-18"],
  ["за прошлую неделю", "2026-10-05", "2026-10-11"],
  ["за последние 7 дней", "2026-10-12", "2026-10-18"],
  ["за последние 30 дней", "2026-09-19", "2026-10-18"],
  ["за прошлый месяц", "2026-09-01", "2026-09-30"],
  ["за год", "2026-01-01", "2026-12-31"],
  ["за прошлый год", "2025-01-01", "2025-12-31"],
  ["за 2024 год", "2024-01-01", "2024-12-31"],
  ["за 17 октября", "2026-10-17", "2026-10-17"],
  ["за октябрь 2026", "2026-10-01", "2026-10-31"],
  ["за 18.10.2026", "2026-10-18", "2026-10-18"],
  ["с 2026-10-10 по 2026-10-17", "2026-10-10", "2026-10-17"],
  ["last week", "2026-10-05", "2026-10-11"],
  ["кеше", "2026-10-17", "2026-10-17"],
]) {
  assert.deepEqual(requestLifePeriod(query, now), { from, until }, query);
  checks++;
}
check(
  requestLifePeriod("привет", now) === null,
  "Ordinary conversation does not infer a period",
);
assert.deepEqual(statsPeriod("month", "2024-02"), {
  from: "2024-02-01",
  until: "2024-02-29",
});
checks++;
check(
  statsPeriod("month", "2026-13") === null &&
    statsPeriod("year", "1800") === null &&
    statsPeriod("year", "20260") === null &&
    statsPeriod("year", "2e3") === null,
  "Invalid UI periods rejected",
);
let stats = stepStatistics(
  [
    { date: "2024-02-01", count: 500 },
    { date: "2024-02-02", count: 0, manualOverride: true },
    { date: "2024-02-02", count: 2000 },
    { date: "2024-03-01", count: 200 },
  ],
  "2024-02-01",
  "2024-02-29",
);
check(
  stats.total === 500 &&
    stats.recordedDays === 2 &&
    stats.average === 250 &&
    stats.missingDays === 27,
  "Manual zero is data; duplicate source and absent days are not added",
);
check(
  stats.best.date === "2024-02-01" && stats.monthly[0].total === 500,
  "Month aggregation and best day",
);
stats = stepStatistics([], "2026-10-01", "2026-10-31");
check(
  stats.total === 0 &&
    stats.average === null &&
    stats.best === null &&
    stats.recordedDays === 0,
  "Empty period has no invented average or best day",
);
const data = {
  version: 31,
  projects: [],
  tasks: [],
  events: [],
  thoughts: [],
  archiveItems: [{ id: 1, name: "Private book" }],
  financeLogs: [{ id: 1, amount: 100 }],
  stepLogs: [
    { date: "2026-10-12", count: 1000 },
    { date: "2026-10-17", count: 0 },
    { date: "2026-10-18", count: 7000 },
    { date: "2026-10-11", count: 9999 },
  ],
  workouts: [
    {
      id: 2,
      date: "2026-10-17",
      done: true,
      duration: 30,
      steps: 5000,
      entries: [
        {
          exerciseKey: "pull",
          name: "Подтягивания",
          unit: "раз",
          done: true,
          setResults: [
            { done: true, value: 8 },
            { done: true, value: 12 },
            { done: false, value: 100 },
          ],
        },
        {
          exerciseKey: "press",
          name: "Жим",
          unit: "кг",
          setResults: [{ done: true, value: 100, reps: 5 }],
        },
      ],
    },
    {
      id: 3,
      date: "2026-10-18",
      done: false,
      duration: 60,
      entries: [
        {
          exerciseKey: "pull",
          name: "Подтягивания",
          unit: "раз",
          plannedValue: 50,
          value: null,
          done: false,
        },
      ],
    },
    { id: 4, date: "2026-10-11", done: true, duration: 120, entries: [] },
  ],
  foodLogs: [
    {
      id: 10,
      date: "2026-10-17",
      name: "Завтрак",
      calories: 500,
      protein: 20,
      fat: 10,
      carbs: 70,
    },
    {
      id: 11,
      date: "2026-10-18",
      name: "Обед",
      calories: 700,
      protein: 30,
      fat: 15,
      carbs: 100,
    },
    { id: 12, date: "2026-10-11", calories: 10000 },
  ],
  sleepLogs: [
    { date: "2026-10-17", hours: 7 },
    { date: "2026-10-18", hours: 8 },
  ],
  waterLogs: [{ id: 30, date: "2026-10-18", ml: 500 }],
  checkins: [
    {
      at: new Date("2026-10-17T10:00:00").getTime(),
      mood: 4,
      energy: 3,
      stress: 2,
    },
  ],
  uiPreferences: {},
};
check(
  !assistantContext(data, {}, now, "Общая статистика за неделю").lifeSummary,
  "No health data is sent without selection",
);
const suggested = suggestAssistantContext(
  data,
  {},
  "Общая статистика за неделю: шаги, тренировки и калораж",
  now,
);
check(
  suggested.map((s) => s.kind).join(",") === "stepLogs,workouts,foodLogs" &&
    suggested.every(
      (s) =>
        s.ids[0] === "*" &&
        s.rows.every((r) => r.date >= "2026-10-12" && r.date <= "2026-10-18"),
    ),
  "Life request offers only the named sources in the requested period",
);
check(
  suggestAssistantContext(data, {}, "Сколько шагов за неделю?", now)
    .map((s) => s.kind)
    .join(",") === "stepLogs",
  "Step question does not offer sleep, finances, food or thoughts",
);
check(
  !suggestAssistantContext(
    data,
    { lifeData: ["*"] },
    "Сколько шагов за неделю?",
    now,
  ).length,
  "Granted Life data need not be attached every message",
);
check(
  !suggestAssistantContext(data, {}, "Добавь тренировку завтра", now).length,
  "Creating a workout does not attach existing health history",
);
const before = JSON.stringify(data),
  context = assistantContext(
    data,
    { lifeData: ["*"] },
    now,
    "Общая статистика за неделю",
  );
check(
  context.lifeSummary.steps.total === 8000 &&
    context.lifeSummary.steps.recordedDays === 3,
  "AI receives exact step totals and recorded-day coverage",
);
check(
  context.lifeSummary.nutrition.consumedCalories === 1200 &&
    context.lifeSummary.nutrition.meals === 2,
  "AI receives food calories only for requested week",
);
check(
  context.lifeSummary.workouts.completed === 1 &&
    context.lifeSummary.workouts.planned === 1 &&
    context.lifeSummary.workouts.completedMinutes === 30,
  "AI distinguishes planned and completed sessions",
);
check(
  context.lifeSummary.workouts.exercises[0].total === 20 &&
    context.lifeSummary.workouts.exercises[0].best === 12 &&
    context.lifeSummary.workouts.exercises[0].recordedSets === 2,
  "Exercise totals count actual completed sets, not future plan",
);
check(
  context.lifeSummary.workouts.exercises[1].best === 100 &&
    context.lifeSummary.workouts.exercises[1].volumeKg === 500,
  "Weights use best result and only known repetitions for volume",
);
check(
  context.lifeSummary.sleep.averageHours === 7.5 &&
    context.lifeSummary.water.ml === 500,
  "Sleep and hydration summaries available",
);
check(
  !context.archiveItems && !context.financeLogs && !context.tasks,
  "Life selection never leaks database, finances or projects",
);
check(
  JSON.stringify(data) === before,
  "Building context never mutates saved records",
);
context.stepLogs[0].count = 1;
check(
  data.stepLogs[0].count === 1000,
  "Context is detached from original data",
);
const day = assistantContext(
  data,
  { lifeData: ["*"] },
  now,
  "Сколько шагов за 17 октября?",
);
check(
  day.stepLogs.length === 1 &&
    day.lifeSummary.steps.total === 0 &&
    day.foodLogs.length === 1 &&
    day.checkins.length === 1,
  "Local named date includes recorded zero and correct check-in date",
);
const only = assistantContext(data, { stepLogs: ["*"] }, now, "за неделю");
check(
  only.lifeSummary.steps.total === 8000 &&
    only.lifeSummary.nutrition === null &&
    only.lifeSummary.workouts === null,
  "Unselected sources are unknown, not falsely zero",
);
const empty = assistantContext(data, { foodLogs: [] }, now);
check(!empty.lifeSummary, "Deselected source does not imply complete coverage");
const large = {
  ...data,
  foodLogs: Array.from({ length: 10000 }, (_, i) => ({
    id: 100 + i,
    date: "2026-10-18",
    name: "Тест",
    calories: 10,
    protein: 1,
    fat: 0,
    carbs: 1,
  })),
};
const largeContext = assistantContext(
  large,
  { lifeData: ["*"] },
  now,
  "Статистика за сегодня",
);
check(
  largeContext.foodLogs.length === 200 &&
    largeContext.lifeSummary.nutrition.meals === 10000 &&
    largeContext.lifeSummary.nutrition.consumedCalories === 100000,
  "Large history keeps complete totals and bounds raw details",
);
check(
  largeContext.lifeSummary.rawRecordCoverage.foodLogs.total === 10000 &&
    largeContext.lifeSummary.rawRecordCoverage.foodLogs.included === 200,
  "Raw-detail limit is disclosed to AI",
);
check(
  lifeContextSummary(
    { stepLogs: [] },
    { from: "2026-10-01", until: "2026-10-31" },
  ).steps.missingDays === 31,
  "Empty attached period reports missing data honestly",
);
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      scope:
        "Pure date/statistics/context logic; no external AI or health-account access",
    },
    null,
    2,
  ),
);

// Illness excuses missing records without fabricating sleep or food.
const recoverySummary = lifeContextSummary(
  {
    illnessLogs: [{ id: 1, date: "2026-10-12", until: "2026-10-13" }],
    foodLogs: [
      { date: "2026-10-12", calories: 500 },
      { date: "2026-10-14", calories: 2000 },
    ],
    sleepLogs: [
      { date: "2026-10-12", hours: 10 },
      { date: "2026-10-14", hours: 8 },
    ],
  },
  { from: "2026-10-12", until: "2026-10-14" },
);
assert.equal(recoverySummary.nutrition.consumedCalories, 2500);
assert.equal(recoverySummary.nutrition.illnessDays, 2);
assert.equal(recoverySummary.nutrition.excusedUnrecordedDays, 1);
assert.equal(recoverySummary.nutrition.averageOutsideIllness, 2000);
assert.equal(recoverySummary.sleep.totalHours, 18);
assert.equal(recoverySummary.sleep.excusedUnrecordedDays, 1);
assert.equal(recoverySummary.sleep.averageOutsideIllness, 8);
const privateSummary = lifeContextSummary(
  { foodLogs: [{ date: "2026-10-14", calories: 2000 }] },
  { from: "2026-10-12", until: "2026-10-14" },
);
assert.equal(privateSummary.nutrition.illnessDays, 0);
console.log("8 illness-aware nutrition and sleep summary checks passed");
