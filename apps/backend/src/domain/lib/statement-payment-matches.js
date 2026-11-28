const { createHash } = require("node:crypto");
const { validDate } = require("./pure/backfill-schedule.js");

const keyFor = (ids) => JSON.stringify([...ids].sort());
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function readDecisions(value, selected) {
  if (value == null) return new Map();
  if (!Array.isArray(value) || value.length > 3000)
    throw new Error("statement_import_invalid");
  const decisions = new Map(),
    used = new Set();
  for (const choice of value) {
    if (
      !choice ||
      !Array.isArray(choice.transaction_ids) ||
      !choice.transaction_ids.length ||
      choice.transaction_ids.some(
        (id) => typeof id !== "string" || !selected.has(id) || used.has(id),
      ) ||
      new Set(choice.transaction_ids).size !== choice.transaction_ids.length ||
      (choice.payment_id !== null &&
        (typeof choice.payment_id !== "string" ||
          !/^[a-z0-9]{15}$/.test(choice.payment_id))) ||
      typeof choice.review_token !== "string" ||
      !/^[a-f0-9]{64}$/.test(choice.review_token)
    )
      throw new Error("statement_import_invalid");
    choice.transaction_ids.forEach((id) => used.add(id));
    decisions.set(keyFor(choice.transaction_ids), choice);
  }
  return decisions;
}
function paidSnapshots(payments) {
  return payments
    .filter((payment) => payment.getString("paid_at"))
    .map((payment) => ({
      id: payment.id,
      subscription_id: payment.getString("subscription_id"),
      date: payment.getString("due_date").slice(0, 10),
      amount: payment.getFloat("amount"),
      currency_id: payment.getString("currency"),
      token: digest([
        payment.id,
        payment.getString("subscription_id"),
        payment.getString("due_date"),
        payment.getString("scheduled_date"),
        payment.getString("paid_at"),
        payment.get("amount"),
        payment.getString("currency"),
        payment.getString("notes"),
        payment.get("statement_sources"),
      ]),
    }));
}
function paymentReview(statement, subscription, pending, amount, snapshots) {
  const charge = pending[0].row;
  const candidates = snapshots
    .filter((payment) => {
      if (
        payment.subscription_id !== subscription.id ||
        (payment.currency_id &&
          payment.currency_id !== subscription.getString("currency")) ||
        !validDate(payment.date)
      )
        return false;
      return payment.date.slice(0, 7) === charge.date.slice(0, 7);
    })
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.date) - Date.parse(charge.date)) -
          Math.abs(Date.parse(b.date) - Date.parse(charge.date)) ||
        a.id.localeCompare(b.id),
    );
  if (!candidates.length) return null;
  const transactionIds = pending.map((entry) => entry.row.id).sort();
  return {
    transaction_ids: transactionIds,
    subscription_name: subscription.getString("name"),
    date: charge.date,
    amount,
    currency: charge.currency,
    review_token: digest([
      statement.id,
      statement.getString("file_hash"),
      subscription.id,
      transactionIds,
      charge.date,
      amount,
      charge.currency,
      candidates.map((payment) => [payment.id, payment.token]),
    ]),
    candidates: candidates.map((payment) => ({
      payment_id: payment.id,
      date: payment.date,
      amount: payment.amount,
      currency: charge.currency,
    })),
  };
}
module.exports = { keyFor, readDecisions, paidSnapshots, paymentReview };
