const { subscriptionAmount } = require("./pure/subscription-trial.mjs");
const { formatLocalDate } = require("./date-helpers.js");

// Reprice untouched upcoming estimates. Paid, overdue, moved and manually
// overridden payments retain their saved amounts.
function repriceUpcomingPayments(app, subscription, before) {
  const today = formatLocalDate(new Date());
  const records = app.findRecordsByFilter("payment_records",
    "subscription_id = {:id} && user = {:user} && due_date > {:today} && paid_at = ''", "", 0, 0,
    { id: subscription.id, user: subscription.get("user"), today });
  for (const record of records) {
    const date = record.getString("due_date").slice(0, 10);
    const scheduled = record.getString("scheduled_date");
    if (date <= today || (scheduled && scheduled !== date) ||
        record.getFloat("amount") !== subscriptionAmount(before, date)) continue;
    record.set("amount", subscriptionAmount(subscription, date));
    app.save(record);
  }
}

module.exports = { repriceUpcomingPayments };
