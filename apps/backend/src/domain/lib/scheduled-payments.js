const { DataRecord } = require("../../storage.cjs");

// Called inside the schedule transaction. Existing records (including pending
// ones) are authoritative: a retry must not overwrite their amount or status.
function saveScheduledPayment(
  app,
  subscription,
  dueDate,
  markPaid,
  details = {},
) {
  const tomorrow = new Date(dueDate + "T00:00:00.000Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const existing = app.findRecordsByFilter(
    "payment_records",
    "subscription_id = {:sid} && (scheduled_date = {:date} || (due_date >= {:date} && due_date < {:tomorrow}))",
    "",
    1,
    0,
    {
      sid: subscription.id,
      date: dueDate,
      tomorrow: tomorrow.toISOString().slice(0, 10),
    },
  );
  if (existing.length) return false;
  const { isTrialDate } = require("./pure/subscription-trial.mjs");
  const cycle = app.findRecordById("cycles", subscription.getString("cycle")).getString("name");
  if (cycle === "Last-Weekday" && !isTrialDate(subscription, dueDate)) {
    const month = dueDate.slice(0, 7);
    const first = month + "-01";
    const end = new Date(first + "T12:00:00Z");
    end.setUTCMonth(end.getUTCMonth() + 1);
    const saved = app.findRecordsByFilter("payment_records",
      "subscription_id = {:id} && ((due_date >= {:first} && due_date < {:end}) || (scheduled_date >= {:first} && scheduled_date < {:end}))",
      "", 0, 0, { id: subscription.id, first, end: end.toISOString().slice(0, 10) });
    if (saved.some((record) => {
      const origin = record.getString("scheduled_date") || record.getString("due_date").slice(0, 10);
      return origin.slice(0, 7) === month && !isTrialDate(subscription, origin);
    })) return false;
  }
  const record = new DataRecord(
    app.findCollectionByNameOrId("payment_records"),
  );
  record.set("subscription_id", subscription.id);
  record.set("user", subscription.get("user"));
  record.set("due_date", dueDate);
  record.set("amount", require("./pure/subscription-trial.mjs").subscriptionAmount(subscription, dueDate));
  record.set("paid_at", markPaid ? new Date().toISOString() : "");
  record.set("auto_paid", markPaid);
  if (details.notes) record.set("notes", details.notes);
  for (const key of ["name", "brand_name", "currency", "category", "payment_method", "payer"])
    record.set(key, subscription.get(key));
  app.save(record);
  return true;
}

module.exports = { saveScheduledPayment };
