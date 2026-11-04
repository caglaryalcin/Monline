export const LAST_WEEKDAY_CYCLE = "Last-Weekday";

/** Last Monday–Friday in the supplied date's month; public holidays are not inferred. */
export function lastWeekdayOfMonth(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(value + "T12:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "";
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  else if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() - 2);
  return date.toISOString().slice(0, 10);
}

/** The first allowed charge on or after a trial ends. */
export function weekdayBillingOnOrAfter(value) {
  const last = lastWeekdayOfMonth(value);
  if (!last || last >= value) return last;
  const next = new Date(value + "T12:00:00Z");
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return lastWeekdayOfMonth(next.toISOString().slice(0, 10));
}
