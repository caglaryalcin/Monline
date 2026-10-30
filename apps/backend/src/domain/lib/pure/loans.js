const { validDate } = require("./backfill-schedule.js");

// A read-only view of the months explicitly entered in the user's ledger.
function loanSummaries(data) {
  const groups = new Map();
  for (const row of data.finance_rows || []) {
    if (row.is_deleted || row.kind !== "expense" || row.expense_type === "credit_card" || !row.is_loan)
      continue;
    // The visible loan name identifies the repayment schedule across years.
    // Users can keep separate loans separate by giving them different names.
    const key = String(row.name).normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
    const group = groups.get(key) || { row, rowIds: new Set() };
    group.rowIds.add(row.id);
    if ((row.year || 0) > (group.row.year || 0)) group.row = row;
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter(({ row, rowIds }) => row.year ||
      !(data.finance_rows || []).some((fork) => fork.origin_row === row.id) ||
      (data.finance_entries || []).some((entry) => rowIds.has(entry.row_id)))
    .sort((a, b) => (a.row.row_order || 0) - (b.row.row_order || 0))
    .map(({ row, rowIds }) => {
      const byMonth = new Map();
      for (const entry of data.finance_entries || []) {
        if (
          !rowIds.has(entry.row_id) ||
          !validDate(entry.date) ||
          !["planned", "settled"].includes(entry.status) ||
          typeof entry.amount !== "number" ||
          !Number.isFinite(entry.amount) ||
          entry.amount <= 0 ||
          entry.amount > 1e12 ||
          Math.abs(entry.amount * 100 - Math.round(entry.amount * 100)) >= 0.01
        )
          continue;
        const month = entry.date.slice(0, 7);
        const value = byMonth.get(month) || { paid: 0, remaining: 0 };
        value[entry.status === "settled" ? "paid" : "remaining"] += Math.round(
          entry.amount * 100,
        );
        byMonth.set(month, value);
      }
      const months = [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => ({
          month,
          amount: (value.paid + value.remaining) / 100,
          paid_amount: value.paid / 100,
          remaining_amount: value.remaining / 100,
          status:
            value.remaining === 0
              ? "settled"
              : value.paid > 0
                ? "partial"
                : "planned",
        }));
      const paid = [...byMonth.values()].reduce(
        (sum, value) => sum + value.paid,
        0,
      );
      const remaining = [...byMonth.values()].reduce(
        (sum, value) => sum + value.remaining,
        0,
      );
      const paidCount = months.filter(
        (month) => month.status === "settled",
      ).length;
      return {
        row_id: row.id,
        name: row.name,
        currency: "TRY",
        start_month: months[0]?.month || null,
        end_month: months.at(-1)?.month || null,
        total_installments: months.length,
        paid_installments: paidCount,
        remaining_installments: months.length - paidCount,
        total_amount: (paid + remaining) / 100,
        paid_amount: paid / 100,
        remaining_amount: remaining / 100,
        months,
      };
    });
}
module.exports = { loanSummaries };
