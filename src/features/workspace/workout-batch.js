import {
  activeGoals,
  plannedWorkoutEntries,
  validateTrainingData,
} from "./training-model.js";

// New repetitions have an explicit series. Legacy plans are grouped by their
// exercise identity and planned values, never by the title alone.
export function workoutGroup(workout) {
  if (workout.seriesKey) return "series:" + workout.seriesKey;
  return (
    "legacy:" +
    JSON.stringify([
      workout.name,
      workout.time,
      workout.duration,
      (workout.entries || []).map((e) => [
        e.exerciseKey,
        e.unit,
        e.sets || 1,
        e.plannedValue ?? null,
      ]),
    ])
  );
}

export function workoutBatchRows(
  workouts,
  { group = "", from, until, includeDone = false },
) {
  return workouts
    .filter(
      (w) =>
        !w.healthSource &&
        (!group || workoutGroup(w) === group) &&
        (!from || w.date >= from) &&
        (!until || w.date <= until) &&
        (includeDone || !w.done),
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
    );
}

export function removeWorkoutBatch(data, keys) {
  const selected = new Set(keys),
    workouts = [],
    events = [],
    ids = new Set();
  data.workouts.forEach((row, index) => {
    if (selected.has(row.trainingKey) && !row.healthSource) {
      workouts.push({ row, index });
      ids.add(row.id);
    }
  });
  data.events.forEach((row, index) => {
    if (ids.has(row.workoutId)) events.push({ row, index });
  });
  const compact = (rows, remove) => {
    let next = 0;
    for (const row of rows) if (!remove(row)) rows[next++] = row;
    rows.length = next;
  };
  compact(data.workouts, (row) => ids.has(row.id));
  compact(data.events, (row) => ids.has(row.workoutId));
  return { workouts, events };
}

export function restoreWorkoutBatch(data, removed) {
  const ids = new Set(data.workouts.map((w) => w.id)),
    keys = new Set(data.workouts.map((w) => w.trainingKey));
  const workouts = removed.workouts.filter(
    ({ row }) => !ids.has(row.id) && !keys.has(row.trainingKey),
  );
  const restoredIds = new Set(workouts.map(({ row }) => row.id));
  const eventIds = new Set(data.events.map((e) => e.id));
  const events = removed.events.filter(
    ({ row }) => restoredIds.has(row.workoutId) && !eventIds.has(row.id),
  );
  const merge = (rows, entries) => {
    const result = [],
      sorted = [...entries].sort((a, b) => a.index - b.index);
    let a = 0,
      b = 0;
    while (a < rows.length || b < sorted.length) {
      if (
        b < sorted.length &&
        (sorted[b].index <= result.length || a === rows.length)
      )
        result.push(sorted[b++].row);
      else result.push(rows[a++]);
    }
    rows.splice(0, rows.length);
    // Avoid argument-count limits for large schedules.
    for (const row of result) rows.push(row);
  };
  merge(data.workouts, workouts);
  merge(data.events, events);
  return workouts.length;
}

export function workoutHasResults(workout) {
  return Boolean(
    workout.done ||
    workout.completedAt ||
    workout.healthSource ||
    (workout.entries || []).some(
      (entry) =>
        entry.done ||
        entry.completedAt ||
        entry.value != null ||
        (entry.setResults || []).some(
          (set) =>
            set.done ||
            set.completedAt ||
            set.value != null ||
            set.reps != null,
        ),
    ),
  );
}

export function workoutUpdateRows(
  workouts,
  source,
  { from, until, scope = "series", name = source.name },
) {
  return workouts
    .filter(
      (workout) =>
        workout.trainingKey !== source.trainingKey &&
        !workoutHasResults(workout) &&
        workout.date >= from &&
        workout.date <= until &&
        (scope === "all" ||
          (scope === "series" && source.seriesKey
            ? workout.seriesKey === source.seriesKey
            : workout.name.trim().toLocaleLowerCase() ===
              name.trim().toLocaleLowerCase())),
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
    );
}

export function updateWorkoutPlans(data, source, keys, period) {
  if (!source.entries?.length)
    throw Error("Добавьте хотя бы одно упражнение в исходное занятие.");
  const selected = new Set(keys);
  const rows = workoutUpdateRows(data.workouts, source, period).filter((row) =>
    selected.has(row.trainingKey),
  );
  const changes = rows.map((row) => ({
    row,
    before: {
      entries: structuredClone(row.entries),
      goalKeys: structuredClone(row.goalKeys),
    },
    after: {
      entries: plannedWorkoutEntries(source.entries),
      goalKeys: activeGoals(data.trainingGoals, row.date, source.entries).map(
        (goal) => goal.goalKey,
      ),
    },
  }));
  // Validate the complete proposal before mutating even one scheduled session.
  validateTrainingData({
    workouts: changes.map(({ row, after }) => ({ ...row, ...after })),
  });
  for (const change of changes)
    Object.assign(change.row, structuredClone(change.after));
  return changes.map(({ row, before, after }) => ({
    key: row.trainingKey,
    before,
    after,
  }));
}

export function undoWorkoutPlans(data, changes) {
  const byKey = new Map(data.workouts.map((row) => [row.trainingKey, row]));
  let restored = 0;
  for (const change of changes) {
    const row = byKey.get(change.key);
    if (
      !row ||
      workoutHasResults(row) ||
      JSON.stringify(row.entries) !== JSON.stringify(change.after.entries) ||
      JSON.stringify(row.goalKeys) !== JSON.stringify(change.after.goalKeys)
    )
      continue;
    for (const field of ["entries", "goalKeys"]) {
      if (change.before[field] === undefined) delete row[field];
      else row[field] = structuredClone(change.before[field]);
    }
    restored++;
  }
  return restored;
}
