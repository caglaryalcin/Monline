const MAX_BACKFILL_PAYMENTS = 1000;
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const time = Date.parse(value + "T00:00:00.000Z");
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}

// Always advance from the original day: Jan 31 -> Feb 28 -> Mar 31.
function* iterateBackfillDates({
  start,
  anchorDate = start,
  billingAnchorDay,
  until,
  cycle,
  frequency,
  end = "",
  limit = 0,
  trial,
  calendar = trial?.get ? trial.get("billing_calendar") : trial?.billing_calendar,
}) {
  const months = { Monthly: 1, "Last-Weekday": 1, Quarterly: 3, "Half-Yearly": 6, Yearly: 12 };
  if (
    !validDate(start) ||
    !validDate(anchorDate) ||
    !validDate(until) ||
    (end && !validDate(end)) ||
    !["Daily", "Weekly", ...Object.keys(months)].includes(cycle) ||
    !Number.isInteger(frequency) ||
    frequency < 1 ||
    frequency > 1200 ||
    !Number.isInteger(limit) ||
    limit < 0
  )
    throw new Error("backfill_invalid_schedule");
  const { trialEndDate } = require("./subscription-trial.mjs");
  const trialEnd = Number(trial?.get ? trial.get("trial_duration") : trial?.trial_duration) > 0 ? trialEndDate(trial) : "";
  if (trialEnd) {
    const trialStart = String(trial?.get ? trial.get("trial_start_date") : trial?.trial_start_date).slice(0, 10);
    const cutoff = end && end < until ? end : until;
    const includeStart = trialStart >= start && trialStart <= cutoff;
    if (includeStart) yield trialStart;
    if (includeStart && limit === 1) return;
    const paidStart = cycle === "Last-Weekday" ? require("./last-weekday.mjs").weekdayBillingOnOrAfter(trialEnd, calendar) : trialEnd;
    yield* iterateBackfillDates({
      start: start > paidStart ? start : paidStart, anchorDate: paidStart,
      billingAnchorDay: Number(trialEnd.slice(8, 10)), until, cycle, frequency, end,
      limit: limit ? limit - Number(includeStart) : 0,
      calendar,
    });
    return;
  }
  const anchor = new Date(anchorDate + "T00:00:00.000Z");
  const dayOfMonth =
    Number.isInteger(billingAnchorDay) &&
    billingAnchorDay >= 1 &&
    billingAnchorDay <= 31
      ? billingAnchorDay
      : anchor.getUTCDate();
  const beginning = new Date(start + "T00:00:00.000Z");
  const monthStep = months[cycle] * frequency;
  const firstIndex = monthStep
    ? Math.floor(
        ((beginning.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
          beginning.getUTCMonth() -
          anchor.getUTCMonth()) /
          monthStep,
      )
    : Math.floor(
        (beginning.getTime() - anchor.getTime()) /
          (86400000 * frequency * (cycle === "Weekly" ? 7 : 1)),
      );
  const cutoff = end && end < until ? end : until;
  let count = 0;
  for (let index = firstIndex; !limit || count < limit; index++) {
    let date;
    if (months[cycle]) {
      const target = new Date(anchor.getTime());
      target.setUTCDate(1);
      target.setUTCMonth(
        anchor.getUTCMonth() + index * frequency * months[cycle],
      );
      const last = new Date(target.getTime());
      last.setUTCMonth(last.getUTCMonth() + 1);
      last.setUTCDate(0);
      target.setUTCDate(Math.min(dayOfMonth, last.getUTCDate()));
      if (cycle === "Last-Weekday") target.setUTCDate(Number(require("./last-weekday.mjs").lastWeekdayOfMonth(target.toISOString().slice(0, 10), calendar).slice(8, 10)));
      date = target;
    } else {
      date = new Date(anchor.getTime());
      date.setUTCDate(
        date.getUTCDate() + index * frequency * (cycle === "Weekly" ? 7 : 1),
      );
    }
    if (!Number.isFinite(date.getTime())) break;
    const day = date.toISOString().slice(0, 10);
    if (day > cutoff) break;
    if (day < start) continue;
    count++;
    yield day;
  }
}
function backfillDates(options) {
  const dates = [];
  for (const day of iterateBackfillDates(options)) {
    if (dates.length === MAX_BACKFILL_PAYMENTS)
      throw new Error("backfill_too_many");
    dates.push(day);
  }
  return dates;
}
module.exports = {
  backfillDates,
  iterateBackfillDates,
  validDate,
  MAX_BACKFILL_PAYMENTS,
};
