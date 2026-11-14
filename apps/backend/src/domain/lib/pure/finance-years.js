function rootId(row) {
  return row.origin_row || row.id;
}
// Automatic continuation starts with the 2026 ledger; historical years stay saved views.
const CONTINUATION_START_YEAR = 2026;
function loanStartingRow(rows, row) {
  if (!row.is_loan) return undefined;
  const root = rows.find((item) => item.id === rootId(row));
  const startYear = Number((row.loan_start_date || "").slice(0, 4)) || Number(root?.year || 0);
  if (startYear < CONTINUATION_START_YEAR) return undefined;
  return rows.find((item) => item.is_loan && rootId(item) === rootId(row) && Number(item.year) === startYear);
}
function continuesAcrossYears(row, year) {
  return row.kind === "expense" && !row.is_auto_carryover &&
    (row.expense_type === "credit_card" || !!row.bill_type ||
      (row.is_rent && row.rent_start_date && row.rent_end_date &&
       row.rent_start_date <= `${year}-12-31` && row.rent_end_date >= `${year}-01-01`) ||
      (row.is_loan && row.loan_start_date && row.loan_end_date &&
       row.loan_start_date <= `${year}-12-31` && row.loan_end_date >= `${year}-01-01`));
}
function firstYear(data) {
  const rows = new Map((data.finance_rows || []).filter((row) => !row.is_deleted).map((row) => [row.id, row]));
  const years = [...rows.values()].filter((row) => !row.is_auto_carryover && Number(row.year)).map((row) => Number(row.year));
  for (const records of [data.finance_entries, data.finance_statement_links, data.finance_card_transactions])
    for (const record of records || [])
      if (rows.has(record.row_id)) years.push(Number((record.month || record.date || "").slice(0, 4)));
  const valid = years.filter((year) => Number.isInteger(year) && year >= 1970 && year <= 2200);
  return valid.length ? Math.min(...valid) : null;
}
function rowsForYear(rows, year, data = {}, forNewPayment = false) {
  const active = new Set(rows.filter((row) => !row.is_deleted && Number(row.year) === year).map((row) => row.id));
  for (const records of [data.finance_entries, data.finance_statement_links, data.finance_card_transactions])
    for (const record of records || [])
      if (Number((record.month || record.date || "").slice(0, 4)) === year) active.add(record.row_id);
  for (const row of rows)
    if (active.has(row.id) && row.payment_card) active.add(row.payment_card);
  const forks = new Map(rows.filter((row) => Number(row.year) === year && row.origin_row).map((row) => [row.origin_row, row]));
  const visible = rows.filter((row) =>
    !row.is_deleted && (Number(row.year || 0) === year ||
      (!Number(row.year || 0) && !forks.has(row.id) && (row.is_auto_carryover || active.has(row.id)))),
  );
  // Resolve the latest yearly version before deciding whether it continues.
  const continuations = new Map();
  for (const row of rows) {
    const rowYear = Number(row.year || 0), root = rootId(row);
    if (!rowYear || rowYear >= year || forks.has(root)) continue;
    if (rowYear < CONTINUATION_START_YEAR && !forNewPayment) continue;
    const previous = continuations.get(root);
    if (!previous || Number(previous.year || 0) < rowYear) continuations.set(root, row);
  }
  for (const row of continuations.values()) {
    if (!row.is_deleted && (continuesAcrossYears(row, year) || active.has(row.id) ||
        (forNewPayment && (row.is_loan || row.is_rent))) &&
        !visible.some((item) => rootId(item) === rootId(row))) {
      visible.push(row);
    }
  }
  const cards = new Map(visible.map((row) => [rootId(row), row.id]));
  const all = new Map(rows.map((row) => [row.id, row]));
  const loanPriority = (row) => Number(Number(loanStartingRow(rows, row)?.year || year) < year);
  return visible.map((row) => ({
    ...row,
    row_order: loanStartingRow(rows, row)?.row_order ?? row.row_order,
    payment_card: !row.is_loan && row.payment_card ? cards.get(rootId(all.get(row.payment_card) || { id: row.payment_card })) || row.payment_card : "",
  })).sort((a, b) => Number(!!a.is_auto_carryover) - Number(!!b.is_auto_carryover) ||
    (a.row_order || 0) - (b.row_order || 0) || loanPriority(b) - loanPriority(a));
}
function rowForYear(rows, id, year, data = {}, forNewPayment = false) {
  const original = rows.find((row) => row.id === id);
  if (!original) return undefined;
  const root = rootId(original);
  if (rows.some((row) => Number(row.year) === year && rootId(row) === root && row.is_deleted)) return undefined;
  return rowsForYear(rows, year, data, forNewPayment).find((row) => rootId(row) === root);
}
module.exports = { rootId, loanStartingRow, firstYear, rowsForYear, rowForYear };
