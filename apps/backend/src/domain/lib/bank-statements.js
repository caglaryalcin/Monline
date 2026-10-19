function invalid() {
  throw new Error("statement_invalid_rows");
}
function validate(input) {
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
    input.transactions.length < 1 ||
    input.transactions.length > 3000
  )
    invalid();
  const ids = new Set();
  const transactions = input.transactions.map((row) => {
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
    return transaction;
  });
  return {
    bank: input.bank,
    file_name: input.file_name.trim(),
    file_hash: input.file_hash,
    period: input.period,
    page_count: input.page_count,
    transactions,
  };
}
module.exports = {
  validate,
};
