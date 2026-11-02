function field(subscription, key) {
  return typeof subscription?.get === "function" ? subscription.get(key) : subscription?.[key];
}
function dateOnly(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}
export const MAX_TRIAL_MONTHS = 120;
export function trialEndDate(subscription) {
  const months = Number(field(subscription, "trial_months") || 0);
  const start = dateOnly(field(subscription, "trial_start_date"));
  if (!Number.isInteger(months) || months < 1 || months > MAX_TRIAL_MONTHS ||
      !/^\d{4}-\d{2}-\d{2}$/.test(start)) return "";
  const date = new Date(start + "T12:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start) return "";
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function isTrialDate(subscription, value) {
  if (field(subscription, "record_type") === "credit") return false;
  const start = dateOnly(field(subscription, "trial_start_date"));
  const end = trialEndDate(subscription);
  const date = dateOnly(value);
  return !!end && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date.slice(0, 7) >= start.slice(0, 7) && date.slice(0, 7) < end.slice(0, 7);
}
/** Keep the normal price on the subscription; only dated occurrences become free. */
export function subscriptionAmount(subscription, date) {
  return isTrialDate(subscription, date) ? 0 : Number(field(subscription, "price") || 0);
}
/** Trials have one zero-cost occurrence per month, then resume the normal cycle. */
export function nextTrialPaymentDate(subscription, value, anchorDay) {
  const day = dateOnly(value);
  if (!isTrialDate(subscription, day)) return "";
  const date = new Date(day + "T12:00:00Z");
  const anchor = Number(anchorDay || field(subscription, "billing_anchor_day")) || Number(day.slice(8, 10));
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(anchor, last));
  return date.toISOString().slice(0, 10);
}
