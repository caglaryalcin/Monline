const { advanceDate } = require("./date-helpers.js");
const { isExpense } = require("./pure/record-types.js");
const {
  advanceFiniteSchedule,
  dateOnly,
} = require("./pure/subscription-limits.js");
const { saveScheduledPayment } = require("./scheduled-payments.js");

// Non-renewing subscriptions still need their due occurrence recorded, but
// their next_payment stays unchanged until explicitly renewed.
const DUE_FILTER =
  "inactive = false && next_payment != '' && (auto_renew = true || next_payment >= {:today}) && " +
  "(next_payment < {:tomorrow} || (end_date != '' && end_date < {:today}))";

function advanceSubscription(app, subscriptionId, today, advance = true) {
  return app.runInTransaction((tx) => {
    const sub = tx.findRecordById("subscriptions", subscriptionId);
    if (!isExpense(sub.get("record_type")) || sub.get("inactive")) return null;
    const cycle = tx.findRecordById("cycles", sub.get("cycle"));
    const user = tx.findRecordById("users", sub.get("user"));
    const markPaid =
      !!sub.get("auto_mark_paid") && !!user.get("payment_tracking");
    const anchor = dateOnly(sub.get("next_payment"));
    const start = dateOnly(sub.get("start_date"));
    const end =
      [sub.get("end_date"), sub.get("cancellation_date")]
        .map(dateOnly)
        .filter(Boolean)
        .sort()[0] || "";
    const result = advanceFiniteSchedule({
      nextPayment: anchor,
      today: advance ? today : anchor < today ? anchor : today,
      cycleName: cycle.get("name"),
      frequency: sub.get("frequency"),
      billingAnchorDay: sub.get("billing_anchor_day"),
      endDate: end,
      paymentLimit: sub.get("payment_limit"),
      paymentsCompleted: sub.get("payments_completed"),
      inactive: sub.get("inactive"),
      advanceDate,
      onOccurrence: (date) => {
        if (!start || date >= start)
          saveScheduledPayment(tx, sub, date, markPaid);
      },
    });
    if (advance) {
      sub.set("__monline_schedule_advance", true);
      sub.set("next_payment", result.nextPayment);
      sub.set("payments_completed", result.paymentsCompleted);
      sub.set("inactive", result.inactive);
      tx.save(sub);
    }
    return result;
  });
}

function advanceDueSubscriptions(app, today) {
  const tomorrow = advanceDate(new Date(today + "T00:00:00.000Z"), "Daily", 1)
    .toISOString()
    .slice(0, 10);
  const subs = app.findRecordsByFilter("subscriptions", DUE_FILTER, "", 0, 0, {
    today,
    tomorrow,
  });
  let processed = 0;
  for (const sub of subs) {
    if (!isExpense(sub.get("record_type"))) continue;
    // Failure rolls back the records and date together. Other subscriptions
    // can proceed; this one can be retried without losing or duplicating days.
    try {
      advanceSubscription(app, sub.id, today, !!sub.get("auto_renew"));
      processed++;
    } catch (error) {
      console.error(
        "[Monline] Schedule failed for subscription " + sub.id,
        error.message,
      );
    }
  }
  return processed;
}

module.exports = { DUE_FILTER, advanceSubscription, advanceDueSubscriptions };
