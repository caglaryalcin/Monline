import { lastWeekdayOfMonth } from "./last-weekday.mjs";
import { nextTrialPaymentDate, trialEndDate } from "./subscription-trial.mjs";

const field = (subscription, key) => typeof subscription?.get === "function" ? subscription.get(key) : subscription?.[key];
const day = value => typeof value === "string" ? value.slice(0, 10) : "";
function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1970-01-01" || value > "2200-12-31") return false;
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The end is exclusive: billing resumes on `to`. */
export function validateBillingPauses(raw) {
  let pauses = raw;
  if (typeof pauses === "string") {
    try { pauses = JSON.parse(pauses); } catch { throw Error("billing_pauses_invalid"); }
  }
  if (pauses == null) return [];
  if (!Array.isArray(pauses) || pauses.length > 24) throw Error("billing_pauses_invalid");
  const result = pauses.map(pause => {
    if (!pause || !validDay(pause.from) || !validDay(pause.to) || pause.from >= pause.to)
      throw Error("billing_pauses_invalid");
    return { from: pause.from, to: pause.to };
  }).sort((left, right) => left.from.localeCompare(right.from));
  if (result.some((pause, index) => index > 0 && pause.from < result[index - 1].to))
    throw Error("billing_pauses_overlap");
  return result;
}
export function billingPauseOn(subscription, date) {
  const pauses = field(subscription, "billing_pauses");
  const value = day(date);
  return Array.isArray(pauses) && value ? pauses.find(pause => pause.from <= value && value < pause.to) : undefined;
}
export function isBillingPaused(subscription, date) {
  return !!billingPauseOn(subscription, date);
}

function nextDate(subscription, cycleName, value) {
  const frequency = Number(field(subscription, "frequency") || 1);
  const trialEnd = Number(field(subscription, "trial_duration")) > 0 ? trialEndDate(subscription) : "";
  const anchor = Number(field(subscription, "billing_anchor_day")) || Number((trialEnd || day(field(subscription, "next_payment"))).slice(8, 10));
  const trial = nextTrialPaymentDate(subscription, value, anchor, cycleName);
  if (trial) return trial;
  const result = new Date(value + "T12:00:00Z");
  const months = { Monthly: 1, "Last-Weekday": 1, Quarterly: 3, "Half-Yearly": 6, Yearly: 12 }[cycleName];
  if (months) {
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months * frequency);
    const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(anchor, last));
    if (!Number.isFinite(result.getTime()) || result.getUTCFullYear() > 2200) throw Error("billing_pauses_invalid");
    const next = result.toISOString().slice(0, 10);
    return cycleName === "Last-Weekday" ? lastWeekdayOfMonth(next, field(subscription, "billing_calendar")) : next;
  }
  if (cycleName !== "Daily" && cycleName !== "Weekly") throw Error("billing_pauses_invalid");
  result.setUTCDate(result.getUTCDate() + frequency * (cycleName === "Weekly" ? 7 : 1));
  if (!Number.isFinite(result.getTime()) || result.getUTCFullYear() > 2200) throw Error("billing_pauses_invalid");
  return result.toISOString().slice(0, 10);
}

/** Zero skips the next billing occurrence; offsets count the underlying billing cycles. */
export function planBillingPause(subscription, cycleName, afterCycles, duration, today) {
  const frequency = Number(field(subscription, "frequency") || 1);
  if (!Number.isInteger(afterCycles) || afterCycles < 0 || afterCycles > 1200 ||
      !Number.isInteger(duration) || duration < 1 || duration > 1200 ||
      !Number.isInteger(frequency) || frequency < 1 || frequency > 1200 ||
      !["Daily", "Weekly", "Monthly", "Last-Weekday", "Quarterly", "Half-Yearly", "Yearly"].includes(cycleName) ||
      field(subscription, "record_type") === "credit" || !validDay(today)) throw Error("billing_pauses_invalid");
  let from = day(field(subscription, "next_payment"));
  if (!validDay(from)) throw Error("billing_pauses_invalid");
  let guard = 0;
  while (from < today && guard++ < 100000) from = nextDate(subscription, cycleName, from);
  for (let index = 0; index < afterCycles; index++) from = nextDate(subscription, cycleName, from);
  let to = from;
  for (let index = 0; index < duration; index++) to = nextDate(subscription, cycleName, to);
  const end = [day(field(subscription, "end_date")), day(field(subscription, "cancellation_date"))].filter(Boolean).sort()[0];
  if (end && to > end) throw Error("billing_pauses_invalid");
  return validateBillingPauses([{ from, to }])[0];
}

export function nextUnpausedBillingDate(subscription, cycleName) {
  let date = day(field(subscription, "next_payment"));
  if (!validDay(date)) return date;
  for (let guard = 0; guard < 100000 && isBillingPaused(subscription, date); guard++) {
    let next;
    try { next = nextDate(subscription, cycleName, date); }
    catch { return ""; }
    if (!validDay(next) || next <= date) return "";
    date = next;
  }
  return date;
}
