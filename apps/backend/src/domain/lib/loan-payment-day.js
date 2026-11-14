// Change existing unpaid installments without rebuilding their amounts or paid history.
function updateLoanPaymentDay(repository, owner, rows, day, fromYear) {
  const cutoff = Math.max(2026, fromYear);
  const ids = new Set(rows.map((row) => row.id));
  for (const row of rows)
    if ((!row.getFloat("year") || row.getFloat("year") >= cutoff) && row.getFloat("loan_payment_day") !== day) {
      row.set("loan_payment_day", day);
      repository.save(row);
    }
  const entries = repository.findRecordsByFilter("finance_entries", "user = {:user}", "", 0, 0, { user: owner });
  const moves = repository.findRecordsByFilter("calendar_moves", "user = {:user}", "", 0, 0, { user: owner });
  let updated = 0;
  for (const entry of entries) {
    const previous = entry.getString("date");
    const year = Number(previous.slice(0, 4)), month = Number(previous.slice(5, 7));
    if (!ids.has(entry.getString("row_id")) || year < cutoff || entry.getString("status") !== "planned" ||
        entry.getString("settled_date") || entry.getString("source_payment")) continue;
    const date = previous.slice(0, 7) + "-" + String(Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate())).padStart(2, "0");
    if (date === previous) continue;
    entry.set("date", date);
    repository.save(entry);
    for (const move of moves)
      if (move.getString("source") === "ledger" && move.getString("source_id") === "ledger:" + entry.id)
        repository.delete(move);
    updated++;
  }
  return updated;
}
module.exports = { updateLoanPaymentDay };
