import { statsDay, statsShift, validStatsRange } from "./life-period.js";

export const lifeTrackingDefaults = () => ({
  personalDay: { enabled: false, start: "00:00" },
  nutrition: {
    water: true,
    calories: true,
    macros: true,
    micronutrients: false,
  },
  weight: false,
  illness: false,
  nutrientTargets: [],
});
export function lifeSettings(data) {
  const defaults = lifeTrackingDefaults(),
    saved = data?.lifePreferences || {};
  return {
    ...defaults,
    ...saved,
    personalDay: { ...defaults.personalDay, ...saved.personalDay },
    nutrition: {
      ...defaults.nutrition,
      ...saved.nutrition,
      calories: true,
      micronutrients: false,
    },
  };
}
export function lifeDayStart(data) {
  const setting = lifeSettings(data).personalDay;
  return setting.enabled
    ? Number(setting.start.slice(0, 2)) * 60 + Number(setting.start.slice(3))
    : 0;
}
export function matchingStepDays(rows, data = {}) {
  const start = lifeDayStart(data);
  return (rows || []).filter(
    (row) =>
      row.manualOverride ||
      row.source !== "health-connect" ||
      (row.dayStartMinutes || 0) === start,
  );
}
export function personalDay(timestamp = Date.now(), data = {}) {
  const time = new Date(timestamp),
    copy = new Date(time);
  if (time.getHours() * 60 + time.getMinutes() < lifeDayStart(data))
    copy.setDate(copy.getDate() - 1);
  return statsDay(copy);
}
export function personalDayWindow(day, data = {}) {
  const minutes = lifeDayStart(data),
    from = new Date(day + "T00:00:00"),
    until = new Date(day + "T00:00:00");
  from.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  until.setDate(until.getDate() + 1);
  until.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return { from: from.getTime(), until: until.getTime() };
}
export function timestampInPersonalDay(day, time, data = {}) {
  const date = new Date(day + "T" + time + ":00"),
    minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  if (minutes < lifeDayStart(data)) date.setDate(date.getDate() + 1);
  return date.getTime();
}
export function lifeRecordDay(row, data = {}, kind = "") {
  if (Number.isFinite(row.occurredAt)) return personalDay(row.occurredAt, data);
  if (
    kind === "foodLogs" &&
    !row.personalDate &&
    Number.isFinite(row.loggedAt) &&
    statsDay(new Date(row.loggedAt)) === row.date
  )
    return personalDay(row.loggedAt, data);
  if (
    kind === "waterLogs" &&
    !row.personalDate &&
    Number.isFinite(row.at) &&
    statsDay(new Date(row.at)) === row.date
  )
    return personalDay(row.at, data);
  if (kind === "workouts" && Number.isFinite(row.healthSource?.start))
    return personalDay(row.healthSource.start, data);
  if (kind === "checkins" && Number.isFinite(row.at))
    return personalDay(row.at, data);
  if (
    kind === "sleepLogs" &&
    !row.manualOverride &&
    Number.isFinite(row.healthSource?.end)
  )
    return personalDay(row.healthSource.end, data);
  if (
    !row.personalDate &&
    row.date &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time || "")
  )
    return personalDay(new Date(row.date + "T" + row.time + ":00"), data);
  return row.date;
}
export function stampLifeRecord(row, data = {}, kind = "", now = Date.now()) {
  if (Number.isFinite(row.occurredAt)) return row;
  if (row.date === personalDay(now, data)) row.occurredAt = now;
  else if (row.time && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time))
    row.occurredAt = timestampInPersonalDay(row.date, row.time, data);
  row.personalDate = true;
  return row;
}
export function illnessOnDay(logs, day, today = statsDay(new Date())) {
  return (logs || []).some(
    (row) => row.date <= day && day <= (row.until || today),
  );
}
export function illnessDays(logs, from, until, today = statsDay(new Date())) {
  if (!validStatsRange(from, until)) return [];
  const result = [];
  for (
    let day = from, index = 0;
    day <= until;
    day = statsShift(day, 1), index++
  ) {
    if (index > 36600) throw Error("Слишком большой период статистики.");
    if (illnessOnDay(logs, day, today)) result.push(day);
  }
  return result;
}
export function workoutAdherence(workouts, data = {}) {
  const today = personalDay(Date.now(), data);
  const excused = workouts.filter(
    (row) =>
      !row.done &&
      illnessOnDay(
        data.illnessLogs,
        lifeRecordDay(row, data, "workouts"),
        today,
      ),
  );
  const eligible = workouts.length - excused.length,
    done = workouts.filter((row) => row.done).length;
  return {
    planned: workouts.length,
    done,
    excused: excused.length,
    eligible,
    percent: eligible ? Math.round((done / eligible) * 100) : null,
  };
}
export function nutrientTotals(data, day) {
  return (lifeSettings(data).nutrientTargets || []).map((target) => {
    const records = (data.nutrientLogs || []).filter(
      (row) =>
        row.nutrientKey === target.key &&
        row.unit === target.unit &&
        lifeRecordDay(row, data, "nutrientLogs") === day,
    );
    const amount =
      Math.round(records.reduce((sum, row) => sum + row.amount, 0) * 1000) /
      1000;
    return {
      ...target,
      amount,
      recorded: records.length,
      percent: target.target
        ? Math.round((amount / target.target) * 100)
        : null,
    };
  });
}
export function weightSeries(data, from, until) {
  const byDay = new Map();
  for (const row of data.weightLogs || []) {
    const day = lifeRecordDay(row, data, "weightLogs");
    if ((from && day < from) || (until && day > until)) continue;
    const previous = byDay.get(day);
    if (
      !previous ||
      (row.occurredAt || row.id) > (previous.occurredAt || previous.id)
    )
      byDay.set(day, row);
  }
  const points = [...byDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, row]) => ({ date: day, kg: row.kg }));
  return {
    points,
    last: points.at(-1)?.kg ?? null,
    change:
      points.length > 1
        ? Math.round((points.at(-1).kg - points[0].kg) * 100) / 100
        : null,
  };
}
export function validateLifeTracking(data) {
  const raw = data.lifePreferences;
  if (
    raw !== undefined &&
    (!raw || typeof raw !== "object" || Array.isArray(raw))
  )
    throw Error("Некорректные настройки учёта жизни.");
  for (const key of ["personalDay", "nutrition"])
    if (
      raw?.[key] !== undefined &&
      (!raw[key] || typeof raw[key] !== "object" || Array.isArray(raw[key]))
    )
      throw Error("Некорректные настройки учёта жизни.");
  const prefs = lifeSettings(data),
    num = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
  if (
    typeof prefs.personalDay.enabled !== "boolean" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(prefs.personalDay.start) ||
    ["weight", "illness"].some((k) => typeof prefs[k] !== "boolean") ||
    ["water", "calories", "macros", "micronutrients"].some(
      (k) => typeof prefs.nutrition[k] !== "boolean",
    )
  )
    throw Error("Проверьте начало дня и переключатели учёта.");
  if (
    !Array.isArray(prefs.nutrientTargets) ||
    prefs.nutrientTargets.length > 100
  )
    throw Error("Допускается до 100 витаминов и минералов.");
  const keys = new Set();
  for (const row of prefs.nutrientTargets) {
    if (
      !row ||
      typeof row.key !== "string" ||
      !row.key ||
      row.key.length > 200 ||
      keys.has(row.key) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      row.name.length > 100 ||
      !["мг", "мкг", "МЕ", "г"].includes(row.unit) ||
      (row.target != null && !num(row.target, 0.001, 1e9))
    )
      throw Error("Проверьте название, единицу и цель вещества.");
    keys.add(row.key);
  }
  for (const kind of ["weightLogs", "illnessLogs", "nutrientLogs"]) {
    const rows = data[kind] || [];
    if (!Array.isArray(rows) || rows.length > 100000)
      throw Error("Некорректные записи здоровья.");
    const ids = new Set();
    for (const row of rows) {
      if (
        !row ||
        !Number.isSafeInteger(row.id) ||
        row.id < 1 ||
        ids.has(row.id) ||
        !validStatsRange(row.date, row.date) ||
        (row.occurredAt !== undefined && !num(row.occurredAt, 1, 8.64e15))
      )
        throw Error("Проверьте дату записи здоровья.");
      ids.add(row.id);
      if (kind === "weightLogs" && !num(row.kg, 1, 1000))
        throw Error("Вес должен быть от 1 до 1000 кг.");
      if (
        kind === "illnessLogs" &&
        row.until != null &&
        !validStatsRange(row.date, row.until)
      )
        throw Error("Выздоровление не может быть раньше начала болезни.");
      if (
        kind === "nutrientLogs" &&
        (!num(row.amount, 0.001, 1e9) ||
          typeof row.name !== "string" ||
          !row.name.trim() ||
          row.name.length > 100 ||
          typeof row.nutrientKey !== "string" ||
          !row.nutrientKey ||
          row.nutrientKey.length > 200 ||
          !["мг", "мкг", "МЕ", "г"].includes(row.unit))
      )
        throw Error("Проверьте количество и единицу вещества.");
      if (
        row.note != null &&
        (typeof row.note !== "string" || row.note.length > 2000)
      )
        throw Error("Слишком длинная заметка здоровья.");
    }
  }
}
