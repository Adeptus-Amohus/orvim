// @ts-check
import { statsPeriod, validStatsRange } from "./life-period.js";
/** @typedef {import('./life-period.js').StatsRange} StatsRange */
/** @param {string | StatsRange | null | undefined} period @param {string} day */
export function inFinancePeriod(period, day) {
  if (!period) return false;
  return typeof period === "string"
    ? day.startsWith(period)
    : day >= period.from && day <= period.until;
}
/** @param {string} mode @param {string} value @param {string} from @param {string} until @returns {StatsRange | null} */
export function financeRange(mode, value, from = "", until = "") {
  return mode === "range"
    ? validStatsRange(from, until)
      ? { from, until }
      : null
    : statsPeriod(mode, value);
}
