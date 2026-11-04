const { validDate } = require("./pure/historical-payment.js");
const { isCredit } = require("./pure/record-types.js");
const { subscriptionAmount } = require("./pure/subscription-trial.mjs");
const { Record, BadRequestError, NotFoundError } = require("../../runtime.cjs");

function quickPay(app, userId, subscriptionId, body, now = new Date()) {
  const date = body.due_date;
  const offset = body.utc_offset_minutes;
  if (!validDate(date) || !Number.isInteger(offset) || offset < -840 || offset > 840)
    throw new BadRequestError("quick_payment_unavailable");
  const limit = new Date(now.getTime() - offset * 60000);
  limit.setUTCDate(limit.getUTCDate() + 2);
  if (date > limit.toISOString().slice(0, 10))
    throw new BadRequestError("quick_payment_unavailable");
  return app.runInTransaction((tx) => {
    let sub;
    try { sub = tx.findRecordById("subscriptions", subscriptionId); }
    catch (_) { throw new NotFoundError(); }
    if (sub.getString("user") !== userId) throw new NotFoundError();
    const user = tx.findRecordById("users", userId);
    if (!user.get("payment_tracking") || sub.get("inactive") || sub.get("auto_mark_paid") ||
        isCredit(sub.get("record_type"))) throw new BadRequestError("quick_payment_unavailable");
    const matches = tx.findRecordsByFilter("payment_records",
      "user = {:user} && subscription_id = {:sub} && due_date >= {:from} && due_date < {:until}",
      "", 0, 0, { user: userId, sub: subscriptionId, from: date, until: date + "~" });
    // Retrying a successful request must never change its amount or timestamp.
    const paid = matches.find((record) => !!record.getString("paid_at"));
    if (paid) return paid;
    const existing = matches[0];
    if (!existing) {
      const day = (field) => sub.getString(field).slice(0, 10);
      if (date !== day("next_payment") || sub.get("calendar_projection_hidden") ||
          (day("start_date") && date < day("start_date")) ||
          (day("end_date") && date > day("end_date")) ||
          (day("cancellation_date") && date > day("cancellation_date")) ||
          (day("calendar_projection_from") && date < day("calendar_projection_from")) ||
          (sub.get("payment_limit") > 0 && sub.get("payments_completed") >= sub.get("payment_limit")) ||
          tx.findRecordsByFilter("payment_records", "subscription_id = {:sub} && scheduled_date = {:date}",
            "", 1, 0, { sub: subscriptionId, date }).length)
        throw new BadRequestError("quick_payment_unavailable");
    }
    const amount = existing ? existing.get("amount") : subscriptionAmount(sub, date);
    const currency = existing?.getString("currency") || sub.getString("currency");
    if (!Number.isFinite(amount) || amount <= 0 || amount !== body.expected_amount || currency !== body.expected_currency)
      throw new BadRequestError("quick_payment_changed");
    const record = existing || new Record(tx.findCollectionByNameOrId("payment_records"));
    if (!existing) {
      record.set("user", userId);
      record.set("subscription_id", subscriptionId);
      record.set("due_date", date);
      record.set("amount", amount);
      for (const key of ["name", "brand_name", "currency", "category", "payment_method", "payment_account", "payer"])
        record.set(key, sub.get(key));
    }
    record.set("paid_at", now.toISOString());
    record.set("auto_paid", false);
    tx.save(record);
    return record;
  });
}
module.exports = { quickPay };
