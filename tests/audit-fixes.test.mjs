import assert from "node:assert/strict";
import {
  requestLifePeriod,
  analyzeLifePeriod,
  statsShift,
} from "../src/features/workspace/life-statistics.js";
import { assistantContext } from "../src/features/workspace/assistant.js";
import { financialSummary } from "../src/features/workspace/changes.js";
import { financeRange } from "../src/features/workspace/finance-period.js";

const now = new Date("2026-10-21T12:00:00");
let checks = 0;
for (const [prompt, from, until] of [
  ["Сколько шагов с 12 по 18 октября?", "2026-10-12", "2026-10-18"],
  ["с 12.10.2026 по 18.10.2026", "2026-10-12", "2026-10-18"],
  ["с 12.10 по 18.10.2026", "2026-10-12", "2026-10-18"],
  ["Сравни вчера и сегодня", "2026-10-20", "2026-10-21"],
  ["Сравни сегодня и вчера", "2026-10-20", "2026-10-21"],
  ["за последние две недели", "2026-10-08", "2026-10-21"],
  ["last two weeks", "2026-10-08", "2026-10-21"],
  ["за последние 14 дней включая сегодня", "2026-10-08", "2026-10-21"],
  ["с 30 декабря 2025 по 2 января 2026", "2025-12-30", "2026-01-02"],
  ["с 28 по 29 февраля 2024", "2024-02-28", "2024-02-29"],
]) {
  assert.deepEqual(requestLifePeriod(prompt, now), { from, until }, prompt);
  checks++;
}
for (const prompt of [
  "с 18.10.2026 по 12.10.2026",
  "с 30 по 31 февраля 2026",
  "за 31.02.2026",
  "за последние десять недель",
  "за 20260 год",
  "за 9999 год",
  "за 12 октября 9999",
  "с 12 по 18 октября 20260",
  "с 12.10 по 18.10.9999",
  "за 12.10.9999",
]) {
  assert.ok(analyzeLifePeriod(prompt, now).issue, prompt);
  checks++;
}
for (const [prompt, expected] of [
  [
    "Сравни прошлый и текущий месяц",
    [
      { from: "2026-09-01", until: "2026-09-30" },
      { from: "2026-10-01", until: "2026-10-31" },
    ],
  ],
  [
    "Сравни 2025 и 2026 год",
    [
      { from: "2025-01-01", until: "2025-12-31" },
      { from: "2026-01-01", until: "2026-12-31" },
    ],
  ],
  [
    "Сравни прошлый и текущий год",
    [
      { from: "2025-01-01", until: "2025-12-31" },
      { from: "2026-01-01", until: "2026-12-31" },
    ],
  ],
]) {
  assert.deepEqual(
    analyzeLifePeriod(prompt, now).comparisons,
    expected,
    prompt,
  );
  checks++;
}
assert.deepEqual(
  analyzeLifePeriod(
    "Сравни прошлый и текущий месяц",
    new Date("2026-01-10T12:00:00"),
  ).comparisons,
  [
    { from: "2025-12-01", until: "2025-12-31" },
    { from: "2026-01-01", until: "2026-01-31" },
  ],
);
checks++;
const data = {
  version: 31,
  projects: [],
  tasks: [],
  events: [],
  uiPreferences: {},
  stepLogs: [
    { date: "2026-10-12", count: 1000 },
    { date: "2026-10-18", count: 2000 },
  ],
  checkins: Array.from({ length: 365 }, (_, i) => ({
    at: new Date(statsShift("2026-01-01", i) + "T12:00:00").getTime(),
    mood: i < 165 ? 1 : 5,
    energy: 3,
    stress: 2,
  })),
};
let context = assistantContext(
  data,
  { lifeData: ["*"] },
  now,
  "Сколько шагов с 12 по 18 октября?",
);
assert.equal(context.lifeSummary.steps.total, 3000);
checks++;
context = assistantContext(data, { lifeData: ["*"] }, now, "за 2026 год");
assert.equal(context.checkins.length, 200);
assert.equal(context.lifeSummary.wellbeing.mood.count, 365);
assert.equal(context.lifeSummary.wellbeing.mood.averagePerCheckin, 1165 / 365);
assert.equal(context.lifeSummary.wellbeing.recordedDays, 365);
checks++;
context = assistantContext(
  {
    ...data,
    checkins: [
      ...data.checkins.slice(0, 1),
      { ...data.checkins[0], at: data.checkins[0].at + 1000, mood: 5 },
      { ...data.checkins[1], mood: 5 },
    ],
  },
  { checkins: ["*"] },
  now,
);
assert.equal(context.lifeSummary.wellbeing.mood.averagePerCheckin, 11 / 3);
assert.equal(context.lifeSummary.wellbeing.mood.averagePerRecordedDay, 4);
checks++;
context = assistantContext(
  data,
  { lifeData: ["*"] },
  now,
  "Сравни 12 октября и 18 октября",
);
assert.deepEqual(
  context.lifeSummary.comparisons.map((part) => part.steps.total),
  [1000, 2000],
);
checks++;
context = assistantContext(data, { lifeData: ["*"] }, now, "за год", {
  from: "2026-10-12",
  until: "2026-10-12",
});
assert.equal(context.lifeSummary.steps.total, 1000);
checks++;
assert.throws(() =>
  assistantContext(data, { lifeData: ["*"] }, now, "", {
    from: "2026-10-18",
    until: "2026-10-12",
  }),
);
checks++;
const rows = [
  { date: "2026-01-01", currency: "KZT", type: "income", amount: 100 },
  { date: "2026-10-18", currency: "KZT", type: "expense", amount: 20 },
  { date: "2026-10-18", currency: "KZT", type: "transfer", amount: 1000 },
  { date: "2026-10-18", currency: "USD", type: "income", amount: 999 },
  { date: "2025-10-18", currency: "KZT", type: "income", amount: 999 },
];
const annual = financialSummary(rows, financeRange("year", "2026"), "KZT");
assert.equal(annual.income, 100);
assert.equal(annual.expenses, 20);
assert.equal(annual.balance, 80);
checks++;
assert.equal(
  financialSummary(
    rows,
    financeRange("range", "", "2026-10-01", "2026-10-31"),
    "KZT",
  ).income,
  0,
);
checks++;
assert.equal(financeRange("year", "20260"), null);
checks++;
assert.equal(financialSummary(rows, null, "KZT").items.length, 0);
checks++;
console.log(
  JSON.stringify({
    passed: true,
    checks,
    scope:
      "Date/context and finance regressions; synthetic data, no external services",
  }),
);
