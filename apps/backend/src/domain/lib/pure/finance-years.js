function rootId(row) {
  return row.origin_row || row.id;
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
function rowsForYear(rows, year, data = {}) {
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
  const cards = new Map(visible.map((row) => [rootId(row), row.id]));
  const all = new Map(rows.map((row) => [row.id, row]));
  return visible.map((row) => ({
    ...row,
    payment_card: row.payment_card ? cards.get(rootId(all.get(row.payment_card) || { id: row.payment_card })) || row.payment_card : "",
  })).sort((a, b) => Number(!!a.is_auto_carryover) - Number(!!b.is_auto_carryover) || (a.row_order || 0) - (b.row_order || 0));
}
function rowForYear(rows, id, year, data = {}) {
  const original = rows.find((row) => row.id === id);
  if (!original) return undefined;
  const root = rootId(original);
  return rowsForYear(rows, year, data).find((row) => rootId(row) === root);
}
module.exports = { rootId, firstYear, rowsForYear, rowForYear };
