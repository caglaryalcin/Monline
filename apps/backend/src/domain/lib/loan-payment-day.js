const { validDate } = require("./pure/backfill-schedule.js");

// A loan has one installment day across its full history. Actual paid dates stay separate.
function updateLoanPaymentDay(repository, owner, rows, day) {
  const ids = new Set(rows.map((row) => row.id));
  for (const row of rows)
    if (row.getFloat("loan_payment_day") !== day) {
      row.set("loan_payment_day", day);
      repository.save(row);
    }
  const entries = repository.findRecordsByFilter("finance_entries", "user = {:user}", "", 0, 0, { user: owner });
  const moves = repository.findRecordsByFilter("calendar_moves", "user = {:user}", "", 0, 0, { user: owner });
  let updated = 0;
  for (const entry of entries) {
    const previous = entry.getString("date");
    const year = Number(previous.slice(0, 4)), month = Number(previous.slice(5, 7));
    if (!ids.has(entry.getString("row_id")) || !validDate(previous) ||
        !["planned", "settled"].includes(entry.getString("status"))) continue;
    const date = previous.slice(0, 7) + "-" + String(Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate())).padStart(2, "0");
    if (date === previous) continue;
    // Preserve the former paid-date fallback on legacy records without an explicit paid date.
    if (entry.getString("status") === "settled" && !entry.getString("settled_date"))
      entry.set("settled_date", previous);
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
