const { DataRecord } = require("../../storage.cjs");

// Called inside the schedule transaction. Existing records (including pending
// ones) are authoritative: a retry must not overwrite their amount or status.
function saveScheduledPayment(app, subscription, dueDate, markPaid, details = {}) {
  const tomorrow = new Date(dueDate + "T00:00:00.000Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const existing = app.findRecordsByFilter(
    "payment_records",
    "subscription_id = {:sid} && due_date >= {:date} && due_date < {:tomorrow}",
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
  const record = new DataRecord(
    app.findCollectionByNameOrId("payment_records"),
  );
  record.set("subscription_id", subscription.id);
  record.set("user", subscription.get("user"));
  record.set("due_date", dueDate);
  record.set("amount", subscription.get("price"));
  record.set("paid_at", markPaid ? new Date().toISOString() : "");
  record.set("auto_paid", markPaid);
  if (details.notes) record.set("notes", details.notes);
  for (const key of ["name", "currency", "category", "payment_method", "payer"])
    record.set(key, subscription.get(key));
  app.save(record);
  return true;
}

module.exports = { saveScheduledPayment };
