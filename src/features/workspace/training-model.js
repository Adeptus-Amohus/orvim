import { lifeRecordDay, personalDay } from "./life-tracking-model.js";
// Stable string keys keep exercise/goal links intact when LAN sync remaps numeric IDs.
export const trainingUnits = ["раз", "кг", "км", "мин"];
export const trainingKey = () => crypto.randomUUID();
export const round = (value) => Math.round(value * 100) / 100;
export const totalsGoal = (goal) =>
  goal.kind !== "count" &&
  Boolean(goal.exerciseKey) &&
  goal.calculation === "total";

export function plannedWorkoutEntries(entries = []) {
  return entries.map((entry) => ({
    exerciseKey: entry.exerciseKey,
    name: entry.name,
    unit: entry.unit,
    plannedValue: entry.plannedValue ?? null,
    sets: entry.sets || 1,
    value: null,
    done: false,
  }));
}

export function workoutDates(date, repeat = "1", interval = 4, until = date) {
  const validDay = (day) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(new Date(day + "T12:00:00").getTime()) &&
    localDate(new Date(day + "T12:00:00")) === day;
  if (!validDay(date)) throw Error("Выберите дату тренировки.");
  if (repeat === "1") return [date];
  if (repeat !== "interval" && !["4", "13", "26", "52"].includes(repeat))
    throw Error("Выберите повтор тренировки.");
  if (
    repeat === "interval" &&
    (!Number.isInteger(interval) ||
      interval < 1 ||
      interval > 365 ||
      !validDay(until) ||
      until < date)
  )
    throw Error("Укажите интервал в днях и конечную дату.");
  const cursor = new Date(date + "T12:00:00"),
    last = new Date(date + "T12:00:00");
  last.setDate(last.getDate() + 365);
  if (repeat === "interval" && until > localDate(last))
    throw Error("Повторы можно запланировать на год вперёд.");
  const dates = [],
    step = repeat === "interval" ? interval : 7,
    count = repeat === "interval" ? 366 : Number(repeat);
  for (let i = 0; i < count; i++) {
    const day = localDate(cursor);
    if (repeat === "interval" && day > until) break;
    dates.push(day);
    cursor.setDate(cursor.getDate() + step);
  }
  return dates;
}

export function entryMeasurement(entry, total = false) {
  if (entry.setResults) {
    const values = entry.setResults
      .filter((set) => set.done && Number.isFinite(set.value))
      .map((set) => set.value);
    return values.length
      ? round(
          total
            ? values.reduce((sum, value) => sum + value, 0)
            : Math.max(...values),
        )
      : null;
  }
  return Number.isFinite(entry.value)
    ? total && ["раз", "мин"].includes(entry.unit)
      ? round(entry.value * (entry.sets || 1))
      : entry.value
    : null;
}

export function validateTrainingData(data) {
  const number = (n, min, max) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const templates = data.uiPreferences?.workoutTemplates ?? [];
  if (!Array.isArray(templates) || templates.length > 100)
    throw Error("Некорректный список сохранённых занятий.");
  const keys = new Set();
  for (const template of templates) {
    if (
      !template ||
      typeof template.key !== "string" ||
      !template.key ||
      template.key.length > 200 ||
      keys.has(template.key) ||
      typeof template.name !== "string" ||
      !template.name.trim() ||
      template.name.length > 150 ||
      !number(template.duration, 1, 1439) ||
      typeof template.note !== "string" ||
      template.note.length > 100000 ||
      !Array.isArray(template.entries)
    )
      throw Error("Некорректное сохранённое занятие.");
    if (
      new Set(template.entries.map((entry) => entry?.exerciseKey)).size !==
      template.entries.length
    )
      throw Error("Повторяющиеся упражнения сохранённого занятия.");
    keys.add(template.key);
  }
  for (const workout of [...(data.workouts || []), ...templates]) {
    if (
      workout.effort !== undefined &&
      (!Number.isInteger(workout.effort) ||
        workout.effort < 1 ||
        workout.effort > 5)
    )
      throw Error("Некорректная оценка сложности тренировки.");
    if (
      workout.effortRatedAt !== undefined &&
      !number(workout.effortRatedAt, 1, 8640000000000000)
    )
      throw Error("Некорректное время оценки тренировки.");
    if (
      workout.seriesKey !== undefined &&
      (typeof workout.seriesKey !== "string" ||
        !workout.seriesKey ||
        workout.seriesKey.length > 200)
    )
      throw Error("Некорректная серия занятий.");
    if (
      (workout.restSeconds !== undefined &&
        (!number(workout.restSeconds, 5, 300) ||
          !Number.isInteger(workout.restSeconds))) ||
      ["restAutomatic", "restSound"].some(
        (key) =>
          workout[key] !== undefined && typeof workout[key] !== "boolean",
      )
    )
      throw Error("Некорректные настройки отдыха занятия.");
    for (const entry of workout.entries || []) {
      if (!entry || typeof entry !== "object")
        throw Error("Некорректные упражнения тренировки.");
      if (
        entry.effort !== undefined &&
        (!Number.isInteger(entry.effort) ||
          entry.effort < 1 ||
          entry.effort > 5)
      )
        throw Error("Некорректная оценка сложности упражнения.");
      if (
        entry.effortRatedAt !== undefined &&
        !number(entry.effortRatedAt, 1, 8640000000000000)
      )
        throw Error("Некорректное время оценки упражнения.");
      if (
        entry.setResults !== undefined &&
        (!Array.isArray(entry.setResults) ||
          entry.setResults.length !== (entry.sets || 1) ||
          entry.setResults.length > 100 ||
          entry.setResults.some(
            (set) =>
              !set ||
              typeof set.done !== "boolean" ||
              (set.value !== null && !number(set.value, 0, 100000)) ||
              (set.done && set.value === null) ||
              (entry.unit === "раз" &&
                set.value !== null &&
                !Number.isInteger(set.value)) ||
              (set.reps !== undefined &&
                (!number(set.reps, 0, 100000) ||
                  !Number.isInteger(set.reps))) ||
              (set.completedAt !== undefined &&
                !number(set.completedAt, 1, 8640000000000000)),
          ))
      )
        throw Error("Некорректные результаты подходов.");
    }
    if (
      workout.entries !== undefined &&
      (!Array.isArray(workout.entries) ||
        workout.entries.length > 200 ||
        workout.entries.some(
          (e) =>
            !e ||
            typeof e.exerciseKey !== "string" ||
            !e.exerciseKey ||
            typeof e.name !== "string" ||
            !trainingUnits.includes(e.unit) ||
            (e.done !== undefined && typeof e.done !== "boolean") ||
            (e.completedAt !== undefined &&
              !number(e.completedAt, 1, 8640000000000000)) ||
            (e.value !== null &&
              e.value !== undefined &&
              (!number(e.value, 0, 100000) ||
                (e.unit === "раз" && !Number.isInteger(e.value)))) ||
            (e.plannedValue !== null &&
              e.plannedValue !== undefined &&
              (!number(e.plannedValue, 0, 100000) ||
                (e.unit === "раз" && !Number.isInteger(e.plannedValue)))) ||
            (e.sets !== undefined &&
              (!Number.isInteger(e.sets) || !number(e.sets, 1, 100))),
        ))
    )
      throw Error("Некорректные упражнения тренировки.");
    if (
      workout.goalKeys !== undefined &&
      (!Array.isArray(workout.goalKeys) ||
        workout.goalKeys.some(
          (key) => typeof key !== "string" || !key || key.length > 200,
        ))
    )
      throw Error("Некорректные ссылки тренировки на цели.");
  }
  for (const goal of data.trainingGoals || []) {
    if (goal.kind !== undefined && !["result", "count"].includes(goal.kind))
      throw Error("Некорректный тип цели.");
    if (
      goal.calculation !== undefined &&
      !["latest", "total"].includes(goal.calculation)
    )
      throw Error("Некорректный способ расчёта цели.");
    if (
      (goal.history || []).some(
        (point) =>
          point.initial !== undefined && typeof point.initial !== "boolean",
      )
    )
      throw Error("Некорректная начальная запись цели.");
  }
}

export function goalState(goal, workouts, data = {}) {
  const inPeriod = (day) =>
    (!goal.from || day >= goal.from) && (!goal.until || day <= goal.until);
  const matching = workouts.filter(
    (row) =>
      inPeriod(lifeRecordDay(row, data, "workouts")) &&
      (goal.kind === "count" ||
        (row.entries || []).some(
          (entry) =>
            entry.exerciseKey === goal.exerciseKey && entry.unit === goal.unit,
        )),
  );
  const linked = matching.filter((row) => row.done);
  const measurements = matching.flatMap((workout) =>
    (workout.entries || [])
      .filter(
        (entry) =>
          entry.exerciseKey === goal.exerciseKey &&
          entry.unit === goal.unit &&
          (entry.setResults?.some((set) => set.done) ||
            workout.done ||
            entry.done === true) &&
          entryMeasurement(entry) !== null,
      )
      .map((entry) => ({
        // Explicit sets use their actual completed values. Legacy equal sets
        // retain the previous calculation rather than rewriting old results.
        value: entryMeasurement(entry, totalsGoal(goal)),
        result: entryMeasurement(entry),
        sets: entry.setResults
          ? entry.setResults.filter((set) => set.done).length
          : entry.sets || 1,
        date: lifeRecordDay(workout, data, "workouts"),
        at: sessionTimestamp(workout, entry),
        workoutKey: workout.trainingKey,
        name: workout.name,
      })),
  );
  const manual = (goal.history || [])
    .filter(
      (point, index) =>
        !point.workoutKey &&
        !point.initial &&
        !(
          index === 0 &&
          point.initial === undefined &&
          point.value === goal.baseline
        ),
    )
    .map((point) => ({ ...point, date: personalDay(point.at, data) }))
    .filter((point) => inPeriod(point.date));
  let current;
  const history = [...manual, ...measurements].sort((a, b) => b.at - a.at);
  if (goal.kind === "count") current = linked.length;
  else if (goal.exerciseKey) {
    current = totalsGoal(goal)
      ? goal.baseline + history.reduce((total, point) => total + point.value, 0)
      : (history[0]?.value ?? goal.baseline);
  } else current = goal.current;
  const percent = Math.max(
    0,
    Math.min(100, Math.round((current / goal.target) * 100)),
  );
  return {
    current: round(current),
    percent,
    linked,
    history,
    best: history.reduce(
      (best, point) => Math.max(best, point.result ?? point.value),
      goal.baseline,
    ),
  };
}

function sessionTimestamp(workout, entry) {
  const at = entry.completedAt || workout.completedAt;
  return Number.isFinite(at) && localDate(new Date(at)) === workout.date
    ? at
    : new Date(workout.date + "T" + workout.time).getTime();
}

export function localDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function activeGoals(goals, date, entries) {
  return goals.filter(
    (goal) =>
      (!goal.from || date >= goal.from) &&
      (!goal.until || date <= goal.until) &&
      (goal.kind === "count" ||
        entries.some(
          (entry) =>
            entry.exerciseKey === goal.exerciseKey && entry.unit === goal.unit,
        )),
  );
}

export function dailySteps(rows, date) {
  return rows.find((row) => row.date === date)?.count ?? null;
}

export function normalizeTraining(data) {
  for (const exercise of data.exercises) {
    exercise.exerciseKey ||= exercise._syncId || trainingKey();
    exercise.unit ||= "раз";
  }
  for (const workout of data.workouts)
    workout.trainingKey ||= workout._syncId || trainingKey();
  for (const goal of data.trainingGoals) {
    goal.goalKey ||= goal._syncId || trainingKey();
    goal.history ||= [];
    const first = goal.history[0];
    if (
      first &&
      first.initial === undefined &&
      !first.workoutKey &&
      first.value === goal.baseline
    )
      first.initial = true;
  }
  for (const workout of data.workouts)
    workout.goalKeys = activeGoals(
      data.trainingGoals,
      workout.date,
      workout.entries || [],
    ).map((goal) => goal.goalKey);
}

// Import only the explicitly enabled categories. Partial permission errors never
// erase data. Daily steps are a replacement total, never an increment.
export function mergeHealthData(data, payload, createId, settings) {
  let added = 0,
    updated = 0,
    protectedCount = 0;
  data.stepLogs ||= [];
  const changed = (old, fields) =>
    Object.entries(fields).some(
      ([key, value]) => JSON.stringify(old[key]) !== JSON.stringify(value),
    );
  if (settings.steps && payload.granted?.includes("steps")) {
    for (const record of payload.steps || []) {
      const old = data.stepLogs.find((row) => row.date === record.date);
      if (old?.manualOverride) {
        protectedCount++;
        continue;
      }
      const fields = {
        date: record.date,
        count: record.count,
        source: "health-connect",
        dayStartMinutes: record.dayStartMinutes || 0,
        origins: record.origins || [],
      };
      if (!old) {
        data.stepLogs.push(fields);
        added++;
      } else if (changed(old, fields)) {
        Object.assign(old, fields);
        updated++;
      }
    }
  }
  if (settings.sleep && payload.granted?.includes("sleep")) {
    // Compare sources per wake-up date. Do not add duplicated watch/app sessions.
    const days = new Map();
    for (const session of payload.sleep || []) {
      const key = session.date + "|" + session.origin;
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(session);
    }
    const byDate = new Map();
    for (const sessions of days.values()) {
      const intervals = sessions
        .flatMap((s) => s.intervals || [[s.start, s.end]])
        .sort((a, b) => a[0] - b[0]);
      let total = 0,
        start = null,
        end = null;
      for (const interval of intervals) {
        if (start === null) {
          [start, end] = interval;
        } else if (interval[0] <= end) end = Math.max(end, interval[1]);
        else {
          total += end - start;
          [start, end] = interval;
        }
      }
      if (start !== null) total += end - start;
      const hours = round(Math.min(24, total / 3600000));
      const record = {
        date: sessions[0].date,
        hours,
        origin: sessions[0].origin,
        sessions: sessions.map((s) => s.key),
        end: Math.max(...sessions.map((s) => s.end)),
      };
      const previous = byDate.get(record.date);
      if (!previous || record.hours > previous.hours)
        byDate.set(record.date, record);
    }
    // A new personal-day boundary may move the same watch session to another
    // date. Remove its obsolete automatic bucket, preserving manual records.
    const sessionDays = new Map(
      (payload.sleep || []).map((row) => [row.key, row.date]),
    );
    data.sleepLogs = data.sleepLogs.filter(
      (row) =>
        row.manualOverride ||
        !row.healthSource?.sessions?.length ||
        !row.healthSource.sessions.every(
          (key) => sessionDays.has(key) && sessionDays.get(key) !== row.date,
        ),
    );
    for (const record of byDate.values()) {
      const old = data.sleepLogs.find((row) => row.date === record.date);
      // Existing manual sleep entries have priority over automatic imports.
      if (old && (!old.healthSource || old.manualOverride)) {
        protectedCount++;
        continue;
      }
      const fields = {
        hours: record.hours,
        healthSource: {
          provider: "health-connect",
          origin: record.origin,
          sessions: record.sessions,
          end: record.end,
        },
      };
      if (!old) {
        data.sleepLogs.push({
          ...fields,
          date: record.date,
          quality: null,
          note: "",
        });
        added++;
      } else if (changed(old, fields)) {
        Object.assign(old, fields);
        updated++;
      }
    }
  }
  if (settings.workouts && payload.granted?.includes("workouts")) {
    const ignored = new Set(settings.ignoredWorkouts || []);
    for (const record of payload.workouts || []) {
      if (ignored.has(record.key)) continue;
      let old = data.workouts.find(
        (row) =>
          row.healthSource?.key === record.key ||
          row.healthAliases?.includes(record.key),
      );
      if (old && old.healthSource.key !== record.key) continue;
      if (!old) {
        // Two companion apps may write the same session under different IDs.
        const duplicate = data.workouts.find(
          (row) =>
            row.healthSource &&
            row.healthSource.origin !== record.origin &&
            row.healthSource.exerciseType === record.exerciseType &&
            Math.abs(row.healthSource.start - record.start) <= 120000 &&
            Math.abs(row.healthSource.end - record.end) <= 120000,
        );
        if (duplicate) {
          duplicate.healthAliases ||= [];
          if (!duplicate.healthAliases.includes(record.key)) {
            duplicate.healthAliases.push(record.key);
            updated++;
          }
          continue;
        }
      }
      const healthSource = {
        provider: "health-connect",
        key: record.key,
        origin: record.origin,
        start: record.start,
        end: record.end,
        updatedAt: record.updatedAt,
        exerciseType: record.exerciseType,
      };
      const fields = { healthSource };
      if (record.steps !== undefined && record.steps !== null)
        fields.steps = record.steps;
      if (old) {
        if (!old.manualOverride && !old.linkedPlan)
          Object.assign(fields, {
            date: record.date,
            time: record.time,
            duration: record.duration,
            name: record.name,
          });
        // Local edits and the planned session's date/exercises remain user owned.
        if (changed(old, fields)) {
          Object.assign(old, fields);
          updated++;
        }
        continue;
      }
      data.workouts.push({
        id: createId(),
        trainingKey: trainingKey(),
        date: record.date,
        time: record.time,
        duration: record.duration,
        name: record.name,
        focus: record.name,
        done: true,
        completedAt: record.end,
        entries: [],
        goalKeys: [],
        result: "",
        ...fields,
      });
      added++;
    }
  }
  return { added, updated, protectedCount };
}
