import assert from "node:assert/strict";
import {
  englishLabels,
  translateAdditionalLabel,
} from "../src/features/workspace/english-labels.js";
const t = (s) => englishLabels[s] || translateAdditionalLabel(s, t);
assert.equal(t("Мой день"), "My day");
assert.equal(t("Б 12 · Ж 5 · У 40 г"), "P 12 · F 5 · C 40 g");
assert.equal(t("2026-11-03: 3,101 шагов"), "2026-11-03: 3,101 steps");
assert.equal(
  t("Начало дня в 22:00 · питание, сон, шаги и тренировки"),
  "Day starts at 22:00 · nutrition, sleep, steps and workouts",
);
assert.equal(t("Изменить задачу: Купить хлеб"), "Edit task: Купить хлеб");
assert.equal(t("Действия с записью: Мой обед"), "Entry actions: Мой обед");
assert.equal(t("Дней с данными: 3 / 30"), "Days with data: 3 / 30");
assert.equal(t("Произвольная личная заметка"), null);
for (const [source, expected] of [
  ["858 ккал", "858 kcal"],
  ["1 234,5 ккал", "1 234,5 kcal"],
  ["75,5 кг", "75,5 kg"],
  ["100 г", "100 g"],
  ["8.5 ч", "8.5 h"],
  ["10 км", "10 km"],
  ["12 раз", "12 reps"],
  ["3 подхода", "3 sets"],
  ["3,100 шагов", "3,100 steps"],
  ["90 с", "90 s"],
  ["Копий: 24 · последняя 11/7/2026", "Backups: 24 · latest 11/7/2026"],
  ["Nov 7 · 8 h · изменить", "Nov 7 · 8 h · edit"],
  ["БЖУ", "P/F/C"],
  ["Статус:", "Status:"],
  ["Error: Некорректный период данных.", "Error: Invalid data period."],
  ["Доступно: шаги, сон, тренировки.", "Available: steps, sleep, workouts."],
  ["Изменить задачу: 858 ккал", "Edit task: 858 ккал"],
])
  assert.equal(t(source), expected, source);
for (const [source, translated] of Object.entries(englishLabels)) {
  assert.ok(
    !/[А-Яа-яЁё]/.test(translated),
    `Russian translation value: ${source}`,
  );
}
console.log(
  "English labels, status messages, units and preserved user titles passed",
);
