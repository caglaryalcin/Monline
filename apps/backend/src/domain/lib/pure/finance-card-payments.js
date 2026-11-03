const { rowForYear } = require("./finance-years.js");
const { statementPaymentTotals, statementSourceRows } = require("./statement-payments.mjs");
const { inspectStatementAccounting } = require("./statement-accounting.mjs");

// Keep the selected ledger cell fixed. PDF payment dates describe the source;
// they must never silently switch the comparison to a different ledger month.
function compareCardPayment(data, rowId, statement, ledgerMonth, allowMonthBoundary = false) {
  const statementMonth = statement.period;
  const sourceRows = statementSourceRows([...(statement.transactions || []), ...(statement.excluded_transactions || [])]);
  const paymentRows = sourceRows.filter((row) => row.kind === "repayment" && row.currency === "TRY" && row.amount > 0 && typeof row.date === "string");
  const paymentMonths = [...new Set(paymentRows.map((row) => row.date.slice(0, 7)))].sort();
  const ledgerRow = rowForYear(data.finance_rows, rowId, Number(ledgerMonth.slice(0, 4)), data);
  const card = ledgerRow?.kind === "expense" && ledgerRow.expense_type === "credit_card" ? ledgerRow : null;
  const entries = card ? data.finance_entries.filter((entry) => entry.row_id === card.id && entry.date.startsWith(`${ledgerMonth}-`)) : [];
  const paid = entries.filter((entry) => entry.status === "settled");
  const pending = entries.filter((entry) => entry.status === "planned");
  const total = (items) => items.reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0);
  const paidCents = total(paid);
  const paymentSummary = statementPaymentTotals(
    sourceRows, statement.summary, statement.bank,
  );
  const statementCents = paymentSummary.cardPayments === null ? null : Math.round(paymentSummary.cardPayments * 100);
  const verification = inspectStatementAccounting(sourceRows, statement.summary, statement.bank, {
    unresolvedCount: (statement.unresolved || []).length,
  });
  const incompleteStatement = verification.status !== "verified";
  const comparable = paymentMonths.length <= 1 && !incompleteStatement;
  const paymentMonthMatches = !paymentMonths.length || paymentMonths[0] === ledgerMonth;
  const difference = comparable && paid.length && statementCents !== null ? (paidCents - statementCents) / 100 : null;
  const previousMonthEnd = new Date(`${ledgerMonth}-01T12:00:00Z`);
  previousMonthEnd.setUTCDate(0);
  const boundaryDate = previousMonthEnd.toISOString().slice(0, 10);
  const monthBoundaryEligible = comparable && difference === 0 && !paymentMonthMatches &&
    statementMonth === ledgerMonth && paymentRows.length > 0 &&
    paymentRows.every((row) => row.date === boundaryDate);
  const monthBoundaryAccepted = allowMonthBoundary === true && monthBoundaryEligible;
  const status = paymentMonths.length > 1 ? "multiple_payment_months"
    : incompleteStatement ? "incomplete_statement"
    : !card ? "missing_card"
    : !entries.length ? "missing_ledger"
      : !paid.length ? "unpaid_ledger"
        : statementCents === null ? "missing_statement_payments"
          : difference !== 0 ? "mismatch"
            : paymentMonthMatches || monthBoundaryAccepted ? "matched" : "payment_month_mismatch";
  return {
    status,
    ledger_month: ledgerMonth,
    payment_months: paymentMonths,
    statement_month: statementMonth,
    month_boundary_eligible: monthBoundaryEligible,
    month_boundary_accepted: monthBoundaryAccepted,
    ledger_row_id: card?.id || "",
    ledger_row_name: card?.name || "",
    ledger_amount: paid.length ? paidCents / 100 : null,
    statement_payments: paymentSummary.summaryPayments,
    statement_refunds: paymentSummary.refundCredits,
    statement_card_payments: paymentSummary.cardPayments,
    difference,
    pending_amount: total(pending) / 100,
    pending_count: pending.length,
  };
}

module.exports = { compareCardPayment };
