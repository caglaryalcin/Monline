const { createHash } = require("node:crypto");
const { rowForYear } = require("./finance-years.js");
const PREFIX = {
  finance_entries: "ledger",
  manual_bills: "bill",
  payment_records: "subscription",
  finance_card_transactions: "manual",
};
function eventId(type, id) {
  return `${PREFIX[type]}:${id}`;
}
function subscriptionEvent(record, data) {
  const sub = (data.subscriptions || []).find(
    (sub) => sub.id === record.subscription_id,
  );
  const currency = (data.currencies || []).find(
    (currency) => currency.id === (record.currency || sub?.currency),
  )?.code;
  if (
    (record.subscription_id && !sub) ||
    sub?.record_type === "credit" ||
    !currency ||
    !(record.name || sub?.name)
  )
    return null;
  const method = (data.payment_methods || []).find(
    (method) => method.id === (record.payment_method || sub?.payment_method),
  );
  const card = rowForYear(data.finance_rows, method?.finance_card, Number(record.due_date.slice(0, 4)), data);
  return {
    id: eventId("payment_records", record.id),
    name: record.name || sub.name,
    date: record.due_date.slice(0, 10),
    settled_date: (record.paid_at || "").slice(0, 10),
    amount: record.amount,
    currency,
    kind: "expense",
    source: sub ? "subscription" : "payment",
    subscription_id: sub?.id || "",
    payment_record_id: record.id,
    counts_as_expense: true,
    status: record.paid_at ? "settled" : "planned",
    card_row_id: card?.id || "",
    card_name: card?.name || "",
  };
}
function fingerprint(target, source) {
  // IDs are excluded so account backups can remap ownership and relations.
  return createHash("sha256")
    .update(
      JSON.stringify([
        target.name,
        target.date,
        target.amount,
        target.currency,
        target.card_name || "",
        source.name,
        source.date,
        source.amount,
        source.currency,
        source.installment || "",
        source.source_key,
        ...(target.payment_tag ? [target.payment_tag] : []),
      ]),
    )
    .digest("hex");
}
function compatible(target, source) {
  return (
    !!target &&
    !!source &&
    target.source !== "statement" &&
    target.kind === "expense" &&
    source.kind === "expense" &&
    source.source === "statement" &&
    !source.undated &&
    target.amount > 0 &&
    target.currency === source.currency &&
    Math.round(target.amount * 100) === Math.round(source.amount * 100) &&
    [source.date.slice(0, 7), source.statement_period].includes(
      target.date.slice(0, 7),
    ) &&
    (!target.card_row_id || target.card_row_id === source.card_row_id)
  );
}
function applyMatches(events, data) {
  const byId = new Map(events.map((event) => [event.id, event]));
  const conflicts = [];
  for (const match of data.budget_matches || []) {
    const record =
      match.target_type === "payment_records"
        ? (data.payment_records || []).find(
            (record) => record.id === match.target_id,
          )
        : null;
    const target =
      byId.get(eventId(match.target_type, match.target_id)) ||
      (record && subscriptionEvent(record, data));
    const source = byId.get(
      `statement:${match.statement_id}:${match.transaction_id}`,
    );
    if (!target) continue; // Subscription payments are added by the budget projection.
    const valid =
      compatible(target, source) &&
      fingerprint(target, source) === match.fingerprint;
    if (match.relation === "different") {
      if (
        !(target.separations || []).some((decision) => decision.id === match.id)
      )
        (target.separations ||= []).push({
          id: match.id,
          source_id: source?.id || "",
          name: source?.name || "",
          valid,
        });
      if (!valid) conflicts.push(match.id);
      continue;
    }
    target.verification = valid ? "verified" : "changed";
    target.match_id = match.id;
    target.verified_statement_id = match.statement_id;
    if (!valid) {
      conflicts.push(match.id);
      continue;
    }
    target.counts_as_expense = false;
    target.duplicate_of = source.id;
    source.verification = "verified";
    source.verified_target_name = target.name;
    source.verified_target_id = target.id;
    if (target.bill || target.budget_category === "bills") source.bill = true;
    if (target.bill_type) source.bill_type = target.bill_type;
    if (record?.paid_at) source.payment_record_id = record.id;
    source.budget_category =
      target.budget_category || (target.bill ? "bills" : undefined);
  }
  return conflicts;
}
module.exports = {
  PREFIX,
  eventId,
  fingerprint,
  compatible,
  applyMatches,
  subscriptionEvent,
};
