const {
  refundMerchantName,
  statementPurchaseTotal,
} = require("./statement-refunds.mjs");
const { cancelledStatementCharges } = require("../bank-statements.js");
const { spendingData } = require("./spending.js");

const plan = (value) => {
  const match = String(value || "").match(/^(\d+)\/(\d+)$/);
  return match ? { current: +match[1], total: +match[2] } : null;
};
const merchant = (value) => {
  const name = refundMerchantName(value);
  // Explicit retail aliases only; Prime and other Amazon products stay distinct.
  return ["amazon", "amazon com", "amazon com tr"].includes(name)
    ? "amazon retail"
    : name;
};
// Candidate warnings only. No deletion, merging, FX conversion or ledger writes.
function statementDuplicates(draft, data) {
  const statements = new Map(data.bank_statements.map((row) => [row.id, row]));
  const sourceRows = new Map();
  for (const statement of data.bank_statements)
    for (const row of Array.isArray(statement.transactions)
      ? statement.transactions
      : [])
      sourceRows.set(`statement:${statement.id}:${row.id}`, row);
  const buckets = new Map();
  const key = (row) =>
    JSON.stringify([row.date, row.currency, merchant(row.name)]);
  const add = (row) => {
    if (!row.date || !refundMerchantName(row.name) || !(row.amount > 0)) return;
    const list = buckets.get(key(row)) || [];
    list.push(row);
    buckets.set(key(row), list);
  };
  for (const row of spendingData(data).events)
    if (row.kind === "expense" && row.counts_as_expense && !row.undated)
      add(row);
  const cancelled = cancelledStatementCharges(draft.transactions, true);
  const matches = [];
  for (const row of draft.transactions) {
    if (
      cancelled.has(row.id) ||
      !["charge", "cash", "fee"].includes(row.kind) ||
      row.amount <= 0
    )
      continue;
    const incoming = {
      id: row.id,
      name: row.merchant,
      date: row.date,
      currency: row.currency,
      amount: row.amount,
      installment: row.installment,
      page: row.page,
    };
    const tolerance = row.currency === "TRY" ? 500 : 1;
    for (const existing of buckets.get(key(incoming)) || []) {
      const difference =
        Math.round(row.amount * 100) - Math.round(existing.amount * 100);
      if (Math.abs(difference) > tolerance) continue;
      const previous = statements.get(existing.statement_id);
      const previousRow = sourceRows.get(existing.id);
      const a = plan(row.installment),
        b = plan(existing.installment);
      const total = statementPurchaseTotal(row),
        previousTotal = previousRow
          ? statementPurchaseTotal(previousRow)
          : null;
      const continuation =
        previous &&
        previous.bank === draft.bank &&
        previous.period !== draft.period &&
        a &&
        b &&
        a.total === b.total &&
        a.current !== b.current &&
        total !== null &&
        previousTotal !== null &&
        Math.round(total * 100) === Math.round(previousTotal * 100);
      // A different month's installment is expected when importing a new statement.
      if (continuation) continue;
      if (matches.length >= 200) return { matches, has_more: true };
      const sourcePage = existing.page ?? previousRow?.page;
      matches.push({
        kind: "possible_duplicate",
        incoming,
        existing: {
          id: existing.id,
          name: existing.name,
          date: existing.date,
          amount: existing.amount,
          currency: existing.currency,
          source: existing.source,
          installment: existing.installment || "",
          statement_id: existing.statement_id || "",
          statement_period: existing.statement_period || "",
          card_name: existing.card_name || "",
          ...(Number.isInteger(sourcePage) && sourcePage > 0 ? { page: sourcePage } : {}),
        },
        difference: difference / 100,
      });
    }
    add({
      ...incoming,
      id: `incoming:${row.id}`,
      source: "incoming",
      statement_period: draft.period,
    });
  }
  return { matches, has_more: false };
}
module.exports = { statementDuplicates };
