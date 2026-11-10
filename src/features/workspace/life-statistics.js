import {
  statsDay,
  statsShift,
  statsPeriod,
  requestLifePeriod,
} from "./life-period.js";
import {
  lifeRecordDay,
  personalDay,
  workoutAdherence,
  illnessDays,
  illnessOnDay,
  matchingStepDays,
  weightSeries,
} from "./life-tracking-model.js";
export {
  statsDay,
  statsShift,
  statsPeriod,
  requestLifePeriod,
  analyzeLifePeriod,
  validStatsRange,
} from "./life-period.js";

export function stepStatistics(logs, from, until, data = {}) {
  const byDate = new Map();
  for (const row of matchingStepDays(logs, data)) {
    if (
      typeof row.date !== "string" ||
      !Number.isFinite(row.count) ||
      row.count < 0 ||
      (from && row.date < from) ||
      (until && row.date > until)
    )
      continue;
    const old = byDate.get(row.date);
    if (!old?.manualOverride || row.manualOverride) byDate.set(row.date, row);
  }
  const daily = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, count }) => ({ date, count }));
  const total = daily.reduce((sum, row) => sum + row.count, 0),
    recordedDays = daily.length;
  const days =
    from && until
      ? Math.round((Date.parse(until) - Date.parse(from)) / 86400000) + 1
      : null;
  const monthly = new Map();
  const excused =
    from && until
      ? illnessDays(
          data.illnessLogs,
          from,
          until,
          personalDay(Date.now(), data),
        )
      : [];
  const excusedSet = new Set(excused),
    healthy = daily.filter((row) => !excusedSet.has(row.date));
  for (const row of daily) {
    const key = row.date.slice(0, 7),
      month = monthly.get(key) || { month: key, total: 0, recordedDays: 0 };
    month.total += row.count;
    month.recordedDays++;
    monthly.set(key, month);
  }
  return {
    total,
    recordedDays,
    calendarDays: days,
    missingDays: days === null ? null : Math.max(0, days - recordedDays),
    average: recordedDays ? total / recordedDays : null,
    illnessDays: excused.length,
    averageOutsideIllness: healthy.length
      ? healthy.reduce((sum, row) => sum + row.count, 0) / healthy.length
      : null,
    missingDaysOutsideIllness:
      days === null
        ? null
        : Math.max(0, days - excused.length - healthy.length),
    best: daily.reduce(
      (best, row) => (!best || row.count > best.count ? row : best),
      null,
    ),
    daily,
    monthly: [...monthly.values()],
  };
}

export const lifeCollections = [
  "stepLogs",
  "workouts",
  "foodLogs",
  "waterLogs",
  "sleepLogs",
  "checkins",
  "weightLogs",
  "illnessLogs",
];
export function lifeContextSummary(context, period = null) {
  const sources = lifeCollections.filter((key) => Object.hasOwn(context, key));
  if (!sources.length) return null;
  const steps = sources.includes("stepLogs")
    ? stepStatistics(context.stepLogs, period?.from, period?.until, context)
    : null;
  const food = context.foodLogs || [],
    workouts = context.workouts || [],
    done = workouts.filter((w) => w.done),
    sleep = context.sleepLogs || [];
  const sum = (rows, key) =>
    Math.round(
      rows.reduce(
        (total, row) => total + (Number.isFinite(row[key]) ? row[key] : 0),
        0,
      ) * 100,
    ) / 100;
  const coverage = (rows, kind, metric) => {
    const today = personalDay(Date.now(), context),
      known = new Set(rows.map((r) => lifeRecordDay(r, context, kind))),
      excused =
        period?.from && period?.until
          ? illnessDays(context.illnessLogs, period.from, period.until, today)
          : [...known].filter((day) =>
              illnessOnDay(context.illnessLogs, day, today),
            ),
      healthy = rows.filter(
        (r) =>
          !illnessOnDay(
            context.illnessLogs,
            lifeRecordDay(r, context, kind),
            today,
          ),
      ),
      healthyDays = new Set(healthy.map((r) => lifeRecordDay(r, context, kind)))
        .size;
    return {
      illnessDays: excused.length,
      excusedUnrecordedDays: excused.filter((day) => !known.has(day)).length,
      recordedDaysOutsideIllness: healthyDays,
      averageOutsideIllness: healthyDays
        ? sum(healthy, metric) / healthyDays
        : null,
    };
  };
  const exercises = new Map();
  for (const workout of workouts)
    for (const entry of workout.entries || []) {
      const actual = entry.setResults
        ? entry.setResults.filter(
            (set) => set.done && Number.isFinite(set.value),
          )
        : (workout.done || entry.done) && Number.isFinite(entry.value)
          ? [{ value: entry.value, legacySets: entry.sets || 1 }]
          : [];
      if (!actual.length) continue;
      const key = (entry.exerciseKey || entry.name) + ":" + entry.unit;
      const item = exercises.get(key) || {
        exerciseKey: entry.exerciseKey,
        name: entry.name,
        unit: entry.unit,
        best: 0,
        total: entry.unit === "кг" ? null : 0,
        recordedSets: 0,
        recordedSessions: 0,
        volumeKg: 0,
        setsWithKnownRepetitions: 0,
      };
      item.recordedSessions++;
      for (const set of actual) {
        item.best = Math.max(item.best, set.value);
        item.recordedSets += set.legacySets || 1;
        if (item.total !== null)
          item.total +=
            set.value *
            (["раз", "мин"].includes(entry.unit) ? set.legacySets || 1 : 1);
        if (entry.unit === "кг" && Number.isFinite(set.reps)) {
          item.volumeKg += set.value * set.reps;
          item.setsWithKnownRepetitions++;
        }
      }
      exercises.set(key, item);
    }
  const checkins = context.checkins || [];
  const metrics = {};
  for (const key of ["mood", "energy", "stress"]) {
    const rows = checkins.filter(
      (row) =>
        Number.isFinite(row[key]) &&
        row[key] >= 1 &&
        row[key] <= 5 &&
        Number.isFinite(row.at),
    );
    const daily = new Map();
    for (const row of rows) {
      const date = lifeRecordDay(row, context, "checkins"),
        bucket = daily.get(date) || [];
      bucket.push(row[key]);
      daily.set(date, bucket);
    }
    const means = [...daily.values()].map(
      (values) => values.reduce((a, b) => a + b, 0) / values.length,
    );
    metrics[key] = {
      count: rows.length,
      recordedDays: daily.size,
      averagePerCheckin: rows.length ? sum(rows, key) / rows.length : null,
      averagePerRecordedDay: means.length
        ? means.reduce((a, b) => a + b, 0) / means.length
        : null,
    };
  }
  return {
    period,
    wellbeing: sources.includes("checkins")
      ? {
          checkins: checkins.length,
          recordedDays: new Set(
            checkins
              .filter((r) => Number.isFinite(r.at))
              .map((r) => lifeRecordDay(r, context, "checkins")),
          ).size,
          ...metrics,
        }
      : null,
    availableSources: sources,
    steps: steps && {
      total: steps.total,
      recordedDays: steps.recordedDays,
      averagePerRecordedDay: steps.average,
      best: steps.best,
      missingDays: steps.missingDays,
      illnessDays: steps.illnessDays,
      averageOutsideIllness: steps.averageOutsideIllness,
      missingDaysOutsideIllness: steps.missingDaysOutsideIllness,
      daily: steps.daily.slice(-400),
      monthly: steps.monthly,
      dailyHistoryLimited: steps.daily.length > 400,
    },
    nutrition: sources.includes("foodLogs")
      ? {
          consumedCalories: sum(food, "calories"),
          proteinGrams: sum(food, "protein"),
          fatGrams: sum(food, "fat"),
          carbsGrams: sum(food, "carbs"),
          meals: food.length,
          ...coverage(food, "foodLogs", "calories"),
          recordedDays: new Set(
            food.map((r) => lifeRecordDay(r, context, "foodLogs")),
          ).size,
        }
      : null,
    workouts: sources.includes("workouts")
      ? {
          completed: done.length,
          planned: workouts.length - done.length,
          adherence: workoutAdherence(workouts, context),
          completedMinutes: sum(done, "duration"),
          exercises: [...exercises.values()].map((row) => ({
            ...row,
            total:
              row.total === null ? null : Math.round(row.total * 100) / 100,
            volumeKg: Math.round(row.volumeKg * 100) / 100,
          })),
        }
      : null,
    sleep: sources.includes("sleepLogs")
      ? {
          totalHours: sum(sleep, "hours"),
          ...coverage(sleep, "sleepLogs", "hours"),
          recordedDays: sleep.length,
          averageHours: sleep.length
            ? sum(sleep, "hours") / sleep.length
            : null,
        }
      : null,
    water: sources.includes("waterLogs")
      ? { ml: sum(context.waterLogs, "ml") }
      : null,
    weight: sources.includes("weightLogs")
      ? weightSeries(context, period?.from, period?.until)
      : null,
    illness: sources.includes("illnessLogs")
      ? { periods: context.illnessLogs }
      : null,
    dataNotes:
      "Illness days excuse missed plans, never invent activity. Weight is kg, nutrient units must not be added together. " +
      "Missing dates are unknown, not zero. A recorded zero steps is valid. Calories are food intake, not energy burned. Step totals already combine device sources; do not add workout steps again. Workout details and actual sets are in workouts; count only done sessions as completed. Exercise aggregates cover all actual recorded results before any raw-record limit; kg best is a maximum, kg volume includes only sets with known repetitions. Planned results are excluded.",
  };
}
