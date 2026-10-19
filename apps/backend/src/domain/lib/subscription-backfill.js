const { DataRecord } = require("../../storage.cjs");
const { BadRequestError } = require("../../errors.cjs");
const {
  backfillDates,
  MAX_BACKFILL_PAYMENTS,
} = require("./pure/backfill-schedule.js");

function prepareBackfill(app, subscription, input, now = new Date()) {
  try {
    const data = typeof input === "string" ? JSON.parse(input) : input;
    if (
      !data ||
      data.confirmed !== true ||
      !Array.isArray(data.payments) ||
      !data.payments.length ||
      data.payments.length > MAX_BACKFILL_PAYMENTS ||
      subscription.getString("record_type") === "credit"
    )
      throw new Error("backfill_invalid_selection");
    const offset = data.utc_offset_minutes;
    if (!Number.isInteger(offset) || Math.abs(offset) > 840)
      throw new Error("historical_invalid_date");
    const today = new Date(now.getTime() - offset * 60000)
      .toISOString()
      .slice(0, 10);
    const ends = [
      subscription.getString("end_date"),
      subscription.getString("cancellation_date"),
    ]
      .map((date) => date.slice(0, 10))
      .filter(Boolean)
      .sort();
    const dates = new Set(
      backfillDates({
        start: subscription.getString("start_date").slice(0, 10),
        anchorDate:
          subscription.getString("next_payment").slice(0, 10) ||
          subscription.getString("start_date").slice(0, 10),
        until: today,
        cycle: app
          .findRecordById("cycles", subscription.getString("cycle"))
          .getString("name"),
        frequency: Number(subscription.get("frequency")),
        end: ends[0] || "",
        limit: Number(subscription.get("payment_limit")) || 0,
      }),
    );
    const seen = new Set();
    return data.payments.map((payment) => {
      if (
        !payment ||
        !dates.has(payment.due_date) ||
        seen.has(payment.due_date)
      )
        throw new Error("backfill_invalid_selection");
      seen.add(payment.due_date);
      if (
        typeof payment.amount !== "number" ||
        !Number.isFinite(payment.amount) ||
        payment.amount < 0 ||
        payment.amount > 1e12
      )
        throw new Error("historical_invalid_amount");
      const paidOffset = payment.paid_utc_offset_minutes;
      if (!Number.isInteger(paidOffset) || Math.abs(paidOffset) > 840)
        throw new Error("historical_invalid_date");
      const paidAt = new Date(
        Date.parse(payment.due_date + "T00:00:00.000Z") + paidOffset * 60000,
      );
      if (paidAt > now) throw new Error("historical_invalid_date");
      return {
        due_date: payment.due_date,
        amount: payment.amount,
        paid_at: paidAt.toISOString(),
      };
    });
  } catch (error) {
    const known = [
      "backfill_invalid_schedule",
      "backfill_too_many",
      "backfill_invalid_selection",
      "historical_invalid_amount",
      "historical_invalid_date",
    ];
    throw new BadRequestError(
      known.includes(error.message)
        ? error.message
        : "backfill_invalid_selection",
    );
  }
}

// Called inside the same transaction that saves the subscription.
function saveBackfill(app, subscription, payments) {
  let saved = 0;
  const existing = app.findRecordsByFilter(
    "payment_records",
    "user = {:user} && subscription_id = {:sub}",
    "",
    0,
    0,
    { user: subscription.getString("user"), sub: subscription.id },
  );
  for (const payment of payments) {
    const matches = existing.filter(
      (record) =>
        record.getString("due_date").slice(0, 10) === payment.due_date,
    );
    if (matches.some((record) => !!record.getString("paid_at"))) continue;
    const record =
      matches[0] ||
      new DataRecord(app.findCollectionByNameOrId("payment_records"));
    record.set("user", subscription.getString("user"));
    record.set("subscription_id", subscription.id);
    record.set("auto_paid", false);
    for (const [key, value] of Object.entries(payment)) record.set(key, value);
    app.save(record);
    saved++;
  }
  return saved;
}
module.exports = { prepareBackfill, saveBackfill };
