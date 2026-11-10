export function wellbeingSlots(count = 3) {
  count = Number.isInteger(count) && count >= 1 && count <= 6 ? count : 3;
  if (count === 3)
    return [
      { hour: 9, start: 0 },
      { hour: 15, start: 12 },
      { hour: 21, start: 18 },
    ];
  const hours =
    count === 1
      ? [15]
      : Array.from({ length: count }, (_, i) =>
          Math.round(9 + (i * 12) / (count - 1)),
        );
  return hours.map((hour, i) => ({
    hour,
    start: i ? Math.floor((hours[i - 1] + hour) / 2) : 0,
  }));
}
export function wellbeingPeriodStart(timestamp, count = 3) {
  const time = new Date(timestamp);
  const slot = wellbeingSlots(count)
    .filter((s) => s.start <= time.getHours())
    .at(-1);
  time.setHours(slot.start, 0, 0, 0);
  return time.getTime();
}
export function wellbeingDue(last, now = Date.now(), count = 3) {
  return !last || last > now || last < wellbeingPeriodStart(now, count);
}
export function nextWellbeingPeriod(now = Date.now(), count = 3) {
  const next = new Date(now),
    slot = wellbeingSlots(count).find((s) => s.start > next.getHours());
  if (slot) next.setHours(slot.start, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }
  return next.getTime();
}
export function nextWellbeingReminder(now = Date.now(), last = 0, count = 3) {
  for (let day = 0; day < 3; day++)
    for (const { hour, start } of wellbeingSlots(count)) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      date.setHours(hour, 0, 0, 0);
      const period = new Date(date);
      period.setHours(start, 0, 0, 0);
      if (date.getTime() > now && !(last >= period.getTime() && last <= now))
        return date.getTime();
    }
  throw new Error("Could not determine next wellbeing reminder");
}
