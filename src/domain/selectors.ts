import type { Snapshot } from "./models";
import { dateKey, daysAgo } from "./dates";

export function mainActions(data: Snapshot, today: string) {
  const active = new Set(
    data.projects.filter((p) => p.status === "active").map((p) => p.id),
  );
  return data.tasks
    .filter(
      (t) =>
        t.status === "open" &&
        (!t.project_id || active.has(t.project_id)) &&
        (!t.scheduled_date ||
          t.scheduled_date <= today ||
          (t.due_date !== null && t.due_date <= today)),
    )
    .sort(
      (a, b) =>
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
        (a.scheduled_date ?? "9999").localeCompare(
          b.scheduled_date ?? "9999",
        ) ||
        a.created_at.localeCompare(b.created_at),
    )
    .slice(0, 3);
}
export function areaCounts(data: Snapshot, areaId: string, today: string) {
  const since = daysAgo(today, 29);
  return {
    projects: data.projects.filter(
      (p) => p.area_id === areaId && p.status === "active",
    ).length,
    wins: data.wins.filter(
      (w) =>
        w.area_id === areaId &&
        dateKey(new Date(w.occurred_at)) >= since &&
        dateKey(new Date(w.occurred_at)) <= today,
    ).length,
  };
}
export function monthlyWins(data: Snapshot, today: string) {
  return data.wins.filter((w) =>
    dateKey(new Date(w.occurred_at)).startsWith(today.slice(0, 7)),
  ).length;
}
