import type { WorkspaceSnapshot } from "./runtime";
import { nextWellbeingReminder, wellbeingSlots } from "./wellbeing.js";
export interface ReminderPlan {
  enabled: boolean;
  wellbeingEnabled: boolean;
  scheduleEnabled: boolean;
  soundEnabled: boolean;
  wellbeingAt: number;
  wellbeingSlots: { hour: number; start: number }[];
  lastCheckinAt: number;
  language: string;
  items: {
    id: string;
    at: number;
    title: string;
    date: string;
    start: string;
    kind: string;
  }[];
}
export function reminderPlan(
  snapshot: WorkspaceSnapshot,
  now = Date.now(),
): ReminderPlan {
  const data = snapshot.data,
    settings = data.notificationSettings as Record<string, unknown> | undefined;
  const wellbeingEnabled = settings?.wellbeingEnabled !== false;
  const scheduleEnabled = settings?.scheduleEnabled !== false;
  const enabled =
    settings?.enabled !== false && (wellbeingEnabled || scheduleEnabled);
  const latest = ((data.checkins as { at: number }[]) || []).reduce(
    (last, row) => (row.at <= now ? Math.max(last, row.at) : last),
    0,
  );
  const wellbeingAt = nextWellbeingReminder(
    now,
    latest,
    Number(settings?.wellbeingCount ?? 3),
  );
  const requestedLanguage =
    data.languageMode === "system"
      ? navigator.language
      : String(data.languageMode || "ru");
  const language = requestedLanguage.toLowerCase().startsWith("en")
    ? "en"
    : "ru";
  const items = (
    ((enabled && scheduleEnabled ? data.events : []) as {
      id: number;
      date: string;
      start: string;
      title: string;
      done?: boolean;
    }[]) || []
  ).flatMap((event) => {
    if (
      event.done ||
      !/^\d{4}-\d{2}-\d{2}$/.test(event.date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.start)
    )
      return [];
    const at = new Date(`${event.date}T${event.start}:00`).valueOf() - 300_000;
    return Number.isFinite(at) && at > now
      ? [
          {
            id: `event-${event.id}`,
            at,
            title: event.title,
            date: event.date,
            start: event.start,
            kind: "event",
          },
        ]
      : [];
  });
  return {
    enabled,
    wellbeingEnabled,
    scheduleEnabled,
    soundEnabled: settings?.soundEnabled !== false,
    wellbeingAt,
    wellbeingSlots: wellbeingSlots(Number(settings?.wellbeingCount ?? 3)),
    lastCheckinAt: latest,
    language,
    items,
  };
}
