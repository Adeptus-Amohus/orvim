import { homeItems } from "./changes.js";
import { lifeRecordDay, lifeDayStart } from "./life-tracking-model.js";
import { statsDay, statsShift } from "./life-period.js";

// The launcher receives only this small projection, never the database or keys.
export function widgetSnapshot(snapshot, now = Date.now(), locale = "ru") {
  const data = snapshot.data,
    today = statsDay(new Date(now));
  const days = Array.from({ length: 16 }, (_, i) => statsShift(today, i - 1));
  const food = new Map();
  for (const row of data.foodLogs || []) {
    const day = lifeRecordDay(row, data, "foodLogs");
    if (days.includes(day))
      food.set(day, (food.get(day) || 0) + (Number(row.calories) || 0));
  }
  const requested =
    data.languageMode === "system" ? locale : data.languageMode || locale;
  return {
    version: 1,
    updatedAt: now,
    language: String(requested).startsWith("en") ? "en" : "ru",
    appearance: ["light", "dark"].includes(data.appearance)
      ? data.appearance
      : "system",
    palette: ["sun", "pine", "scarlet", "winter", "custom"].includes(
      data.palette,
    )
      ? data.palette
      : "sun",
    customColor: /^#[0-9a-f]{6}$/i.test(data.customColor || "")
      ? data.customColor
      : "#8c6ad8",
    dayStartMinutes: lifeDayStart(data),
    ai: {
      provider: String(data.connectionSettings?.aiProvider || "openai"),
      model: String(data.connectionSettings?.aiModel || ""),
    },
    appliedOperations: (data.uiPreferences?.widgetReceipts || []).map(
      (row) => row.key,
    ),
    days: days.map((day) => {
      const rows = homeItems(data, day);
      return {
        date: day,
        items: rows.slice(0, 200).map(({ kind, item }) => ({
          kind,
          id: item.id,
          title: String(item.title || "").slice(0, 180),
          start: item.start || item.time || "",
          end: item.end || "",
          duration: Number(item.duration) || 30,
          done: Boolean(item.done),
        })),
        total: rows.length,
        calories: Math.round(food.get(day) || 0),
        foodTarget: Math.max(0, Number(data.foodTarget) || 0),
      };
    }),
  };
}
