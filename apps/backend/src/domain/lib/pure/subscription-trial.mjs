import { subscriptionPrice } from "./subscription-prices.mjs";
import { lastWeekdayOfMonth, weekdayBillingOnOrAfter } from "./last-weekday.mjs";

function field(subscription, key) {
  return typeof subscription?.get === "function" ? subscription.get(key) : subscription?.[key];
}
function dateOnly(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}
export const MAX_TRIAL_MONTHS = 120;
export const TRIAL_LIMITS = { day: 3650, week: 520, month: 120, year: 10 };
export function trialEndDate(subscription) {
  const duration = Number(field(subscription, "trial_duration") || 0);
  const unit = duration ? field(subscription, "trial_unit") : "month";
  const count = duration || Number(field(subscription, "trial_months") || 0);
  const start = dateOnly(field(subscription, "trial_start_date"));
  if (!Object.hasOwn(TRIAL_LIMITS, unit) || !Number.isInteger(count) || count < 1 || count > TRIAL_LIMITS[unit] ||
      !/^\d{4}-\d{2}-\d{2}$/.test(start)) return "";
  const date = new Date(start + "T12:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start) return "";
  if (unit === "day" || unit === "week") {
    date.setUTCDate(date.getUTCDate() + count * (unit === "week" ? 7 : 1));
    return date.toISOString().slice(0, 10);
  }
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + count * (unit === "year" ? 12 : 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function isTrialDate(subscription, value) {
  if (field(subscription, "record_type") === "credit") return false;
  const start = dateOnly(field(subscription, "trial_start_date"));
  const end = trialEndDate(subscription);
  const date = dateOnly(value);
  if (Number(field(subscription, "trial_duration") || 0) > 0)
    return !!end && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= start && date < end;
  return !!end && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date.slice(0, 7) >= start.slice(0, 7) && date.slice(0, 7) < end.slice(0, 7);
}
/** Keep the normal price on the subscription; only dated occurrences become free. */
export function subscriptionAmount(subscription, date) {
  return isTrialDate(subscription, date) ? 0 : subscriptionPrice(subscription, date);
}
/** Legacy trials keep monthly occurrences; flexible trials resume on their exact end date. */
export function nextTrialPaymentDate(subscription, value, anchorDay, cycleName) {
  const day = dateOnly(value);
  if (!isTrialDate(subscription, day)) return "";
  if (Number(field(subscription, "trial_duration") || 0) > 0) {
    const end = trialEndDate(subscription);
    return cycleName === "Last-Weekday" ? weekdayBillingOnOrAfter(end, field(subscription, "billing_calendar")) : end;
  }
  const date = new Date(day + "T12:00:00Z");
  const anchor = Number(anchorDay || field(subscription, "billing_anchor_day")) || Number(day.slice(8, 10));
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(anchor, last));
  if (cycleName === "Last-Weekday") return lastWeekdayOfMonth(date.toISOString().slice(0, 10), field(subscription, "billing_calendar"));
  return date.toISOString().slice(0, 10);
}
