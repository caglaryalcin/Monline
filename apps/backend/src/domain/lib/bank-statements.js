function invalid() {
  throw new Error("statement_invalid_rows");
}
function cancelledStatementCharges(rows, includeRefunds = false) {
  const { pairs } =
    require("./pure/statement-refunds.mjs").matchStatementRefunds(
      rows,
    );
  return new Set(
    pairs.flatMap((pair) =>
      includeRefunds ? [pair.chargeId, pair.refundId] : [pair.chargeId],
    ),
  );
}
function refundedStatementCharges(rows) {
  return require("./pure/statement-refunds.mjs").matchStatementRefunds(rows).refundedChargeIds;
}
function validate(input, { legacy = false } = {}) {
  if (
    !input ||
    !["enpara", "denizbank", "garanti"].includes(input.bank) ||
    typeof input.file_name !== "string" ||
    !input.file_name.trim() ||
    input.file_name.length > 255 ||
    !/^[a-f0-9]{64}$/.test(input.file_hash) ||
    !/^20\d{2}-(0[1-9]|1[0-2])$/.test(input.period) ||
    !Number.isInteger(input.page_count) ||
    input.page_count < 1 ||
    input.page_count > 80 ||
    !Array.isArray(input.transactions) ||
    !Array.isArray(input.excluded_transactions ?? []) ||
    input.transactions.length + (input.excluded_transactions ?? []).length <
      1 ||
    input.transactions.length + (input.excluded_transactions ?? []).length >
      3000
  )
    invalid();
  const ids = new Set();
  // Validate excluded source rows just as strictly as saved expenses. They are
  // retained only for PDF reconciliation and must never become spending events.
  const transactions = [
    ...input.transactions,
    ...(input.excluded_transactions ?? []),
  ].map((row) => {
    if (
      !row ||
      typeof row.id !== "string" ||
      !/^[\w-]{1,60}$/.test(row.id) ||
      ids.has(row.id) ||
      typeof row.date !== "string" ||
      !/^20\d{2}-\d{2}-\d{2}$/.test(row.date) ||
      typeof row.merchant !== "string" ||
      !row.merchant.trim() ||
      row.merchant.length > 250 ||
      typeof row.amount !== "number" ||
      !Number.isFinite(row.amount) ||
      row.amount < 0 ||
      row.amount > 100000000 ||
      Math.abs(row.amount * 100 - Math.round(row.amount * 100)) > 0.00001 ||
      !["TRY", "EUR", "USD", "GBP"].includes(row.currency) ||
      !["charge", "refund", "repayment", "fee", "cash"].includes(row.kind) ||
      !Number.isInteger(row.page) ||
      row.page < 1 ||
      row.page > input.page_count ||
      typeof row.installment !== "string" ||
      row.installment.length > 60
    )
      invalid();
    if (
      row.subscription_service !== undefined &&
      (typeof row.subscription_service !== "string" ||
        !row.subscription_service.trim() ||
        row.subscription_service.length > 120)
    )
      invalid();
    if (
      row.subscription_match !== undefined &&
      !["catalog", "account", "provider", "manual"].includes(
        row.subscription_match,
      )
    )
      invalid();
    const date = new Date(row.date + "T12:00:00Z");
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== row.date
    )
      invalid();
    ids.add(row.id);
    const transaction = {
      id: row.id,
      date: row.date,
      merchant: row.merchant.trim(),
      amount: Math.round(row.amount * 100) / 100,
      currency: row.currency,
      kind: row.kind,
      page: row.page,
      installment: row.installment,
    };
    if (row.subscription_service)
      transaction.subscription_service = row.subscription_service.trim();
    if (row.subscription_match)
      transaction.subscription_match = row.subscription_match;
    if (row.category !== undefined) {
      if (
        ![
          "digital",
          "online",
          "bills",
          "shopping",
          "health",
          "groceries",
          "dining",
          "coffee",
          "travel",
          "transport",
          "toys",
          "foreign",
          "other",
          "fees",
        ].includes(row.category)
      )
        invalid();
      transaction.category = row.category;
    }
    if (row.source !== undefined) {
      if (typeof row.source !== "string" || row.source.length > 10000)
        invalid();
      transaction.source = row.source;
    }
    const checks = require("./statement-checks.js");
    if (
      !legacy &&
      (!checks.validInstallment(row.installment) ||
        !checks.sourceAmountSafe(row))
    )
      invalid();
    if (row.amount_confirmed === true) transaction.amount_confirmed = true;
    if (row.financing !== undefined) {
      if (
        !row.financing ||
        row.currency !== "TRY" ||
        !row.installment ||
        !["charge", "cash"].includes(row.kind)
      )
        invalid();
      const keys = ["principal", "interest", "kkdf", "bsmv"];
      if (
        !keys.every(
          (key) =>
            typeof row.financing[key] === "number" &&
            Number.isFinite(row.financing[key]) &&
            row.financing[key] >= 0 &&
            row.financing[key] <= 100000000 &&
            Math.abs(
              row.financing[key] * 100 - Math.round(row.financing[key] * 100),
            ) < 0.00001,
        ) ||
        Math.abs(
          keys.reduce(
            (sum, key) => sum + Math.round(row.financing[key] * 100),
            0,
          ) - Math.round(row.amount * 100),
        ) > 5
      )
        invalid();
      transaction.financing = Object.fromEntries(
        keys.map((key) => [key, row.financing[key]]),
      );
    }
    return transaction;
  });
  const summary = {};
  if (input.summary != null) {
    if (typeof input.summary !== "object" || Array.isArray(input.summary))
      invalid();
    for (const key of [
      "previous_balance",
      "payments",
      "purchases",
      "cash",
      "fees",
      "balance",
      "minimum_payment",
    ]) {
      if (input.summary[key] === undefined) continue;
      const value = input.summary[key];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100000000 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 0.00001
      )
        invalid();
      summary[key] = value;
    }
  }
  const unresolved = input.unresolved ?? [];
  if (
    !Array.isArray(unresolved) ||
    unresolved.length > 25000 ||
    unresolved.some(
      (line) =>
        !line ||
        typeof line.text !== "string" ||
        line.text.length > 10000 ||
        !Number.isInteger(line.page) ||
        line.page < 1 ||
        line.page > input.page_count,
    )
  )
    invalid();
  return {
    bank: input.bank,
    file_name: input.file_name.trim(),
    file_hash: input.file_hash,
    period: input.period,
    page_count: input.page_count,
    transactions: transactions.slice(0, input.transactions.length),
    excluded_transactions: transactions.slice(input.transactions.length),
    summary,
    unresolved: unresolved.map((line) => ({
      page: line.page,
      text: line.text,
    })),
  };
}
module.exports = {
  validate,
  cancelledStatementCharges,
  refundedStatementCharges,
};
