export function dateKey(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export function displayDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(undefined, options).format(
    new Date(value.length === 10 ? value + "T12:00:00" : value),
  );
}
export function weekStart(today: string): string {
  const date = new Date(today + "T12:00:00");
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKey(date);
}
export function daysAgo(today: string, days: number): string {
  const date = new Date(today + "T12:00:00");
  date.setDate(date.getDate() - days);
  return dateKey(date);
}
export function atLocalNoon(date: string): string {
  return new Date(date + "T12:00:00").toISOString();
}
