const { iterateBackfillDates, validDate } = require("./pure/backfill-schedule.js");
const { isExpense } = require("./pure/record-types.js");
const { projectedOccurrence } = require("./calendar-move.js");
const { saveScheduledPayment } = require("./scheduled-payments.js");

// Restore only this month when reactivation would otherwise leave its calendar
// empty. Saved payments, including moved ones, and projected dates take priority.
function restoreReactivatedMonth(app, subscription, today) {
  if (!validDate(today) || subscription.getBool("inactive") ||
      !isExpense(subscription.getString("record_type"))) return 0;
  const next = subscription.getString("next_payment").slice(0, 10);
  if (!validDate(next)) return 0;
  const first = today.slice(0, 7) + "-01";
  const endOfMonth = new Date(first + "T00:00:00Z");
  endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
  const nextMonth = endOfMonth.toISOString().slice(0, 10);
  endOfMonth.setUTCDate(0);
  const last = endOfMonth.toISOString().slice(0, 10);
  const existing = app.findRecordsByFilter(
    "payment_records",
    "user = {:owner} && subscription_id = {:sub} && " +
      "((due_date >= {:first} && due_date < {:next}) || " +
      "(scheduled_date >= {:first} && scheduled_date < {:next}))",
    "", 1, 0,
    { owner: subscription.getString("user"), sub: subscription.id, first, next: nextMonth },
  );
  if (existing.length) return 0;
  const limit = subscription.getFloat("payment_limit");
  if (limit > 0 && subscription.getFloat("payments_completed") >= limit) return 0;
  const start = subscription.getString("start_date").slice(0, 10);
  const beginning = validDate(start) && start > first ? start : first;
  const ends = [subscription.getString("end_date"), subscription.getString("cancellation_date")]
    .map(value => value.slice(0, 10)).filter(value => validDate(value)).sort();
  const end = ends[0] || "";
  if (beginning > last || (end && end < beginning)) return 0;
  const cycle = app.findRecordById("cycles", subscription.getString("cycle")).getString("name");
  const frequency = subscription.getFloat("frequency");
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > 1200) return 0;
  let dates;
  if (cycle === "One-Time") dates = next >= beginning && next <= last && (!end || next <= end) ? [next] : [];
  else {
    if (!["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly"].includes(cycle)) return 0;
    dates = [...iterateBackfillDates({
      start: beginning, anchorDate: next, until: last, end, cycle, frequency,
      billingAnchorDay: subscription.getFloat("billing_anchor_day"),
    })];
  }
  if (dates.some(date => projectedOccurrence(app, subscription, date))) return 0;
  let created = 0;
  for (const date of dates)
    if (saveScheduledPayment(app, subscription, date, false)) created++;
  return created;
}

module.exports = { restoreReactivatedMonth };
