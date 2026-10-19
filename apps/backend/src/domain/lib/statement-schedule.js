const { nextStatementPayment } = require("./pure/statement-payment-date.js");

function latestImportedPayment(records, subscription) {
  let latest = "";
  for (const payment of records) {
    if (
      payment.getString("subscription_id") !== subscription.id ||
      payment.getString("user") !== subscription.getString("user") ||
      !payment.getString("paid_at")
    )
      continue;
    const sources = payment.get("statement_sources");
    if (
      !Array.isArray(sources) ||
      !sources.some(
        (source) =>
          typeof source === "string" &&
          source.startsWith("[monline-statement:"),
      )
    )
      continue;
    const date = payment.getString("due_date").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date > latest) latest = date;
  }
  return latest;
}

function repairImportedSchedules(repository, today) {
  return repository.runInTransaction(() => {
    const payments = repository.findRecordsByFilter(
      "payment_records",
      "paid_at != ''",
    );
    const bySubscription = new Map();
    for (const payment of payments) {
      const id = payment.getString("subscription_id");
      const records = bySubscription.get(id) || [];
      records.push(payment);
      bySubscription.set(id, records);
    }
    let repaired = 0;
    for (const subscription of repository.findRecordsByFilter(
      "subscriptions",
    )) {
      if (
        subscription.getString("record_type") === "credit" ||
        /youtube\s*super/i.test(subscription.getString("name"))
      )
        continue;
      const next = subscription.getString("next_payment").slice(0, 10);
      const latest = latestImportedPayment(
        bySubscription.get(subscription.id) || [],
        subscription,
      );
      // The old importer copied the historical charge into next_payment. Do
      // not rewrite a valid future date or an unpaid date after the last charge.
      if (!latest || !next || next > today || next > latest) continue;
      subscription.set("next_payment", nextStatementPayment(latest, today));
      repository.save(subscription);
      repaired++;
    }
    return repaired;
  });
}

module.exports = { latestImportedPayment, repairImportedSchedules };
