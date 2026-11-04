import { isCalendarHoliday } from "./business-calendar.mjs";

export const LAST_WEEKDAY_CYCLE = "Last-Weekday";

/** Last Monday-Friday outside the account's public/bank holiday calendar. */
export function lastWeekdayOfMonth(value, calendar) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(value + "T12:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "";
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  const month = date.getUTCMonth();
  while (date.getUTCDay() === 6 || date.getUTCDay() === 0 ||
         isCalendarHoliday(date.toISOString().slice(0, 10), calendar)) {
    date.setUTCDate(date.getUTCDate() - 1);
    if (date.getUTCMonth() !== month) throw new Error("holiday_calendar_no_workday");
  }
  return date.toISOString().slice(0, 10);
}

/** The first allowed charge on or after a trial ends. */
export function weekdayBillingOnOrAfter(value, calendar) {
  const last = lastWeekdayOfMonth(value, calendar);
  if (!last || last >= value) return last;
  const next = new Date(value + "T12:00:00Z");
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return lastWeekdayOfMonth(next.toISOString().slice(0, 10), calendar);
}
