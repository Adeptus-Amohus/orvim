export function wellbeingSlots(
  count?: number,
): { hour: number; start: number }[];
export function wellbeingPeriodStart(timestamp: number, count?: number): number;
export function wellbeingDue(
  last: number | null,
  now?: number,
  count?: number,
): boolean;
export function nextWellbeingPeriod(now?: number, count?: number): number;
export function nextWellbeingReminder(
  now?: number,
  last?: number,
  count?: number,
): number;
