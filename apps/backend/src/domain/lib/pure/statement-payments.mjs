// The same source ID may reach accounting through both selected and excluded
// lists. Distinct IDs remain distinct, even for two identical bank payments.
export function statementSourceRows(rows) {
  const seen = new Map();
  return rows.filter((row) => {
    if (!row.id) return true;
    const fingerprint = JSON.stringify([row.date, row.currency, row.amount, row.kind, row.merchant, row.installment, row.source, row.financing]);
    const versions = seen.get(row.id) || new Set();
    if (versions.has(fingerprint)) return false;
    versions.add(fingerprint);
    seen.set(row.id, versions);
    return true;
  });
}

// These are source-ledger totals, not a reconstruction of bank summary buckets.
// Banks may put refunds in Payments or net them from Purchases. Merchant matching
// must never decide bank accounting or the amount actually paid to the card.
export function statementPaymentTotals(rows, summary = {}, bank = "") {
  rows = statementSourceRows(rows);
  let repayments = 0, refunds = 0, repaymentCount = 0;
  const paymentRows = [];
  for (const row of rows) {
    if (row.currency !== "TRY" || !Number.isFinite(row.amount) || row.amount < 0) continue;
    if (row.kind === "repayment") {
      repayments += Math.round(row.amount * 100);
      repaymentCount++;
      paymentRows.push(row);
    }
    if (row.kind === "refund") {
      refunds += Math.round(row.amount * 100);
      paymentRows.push(row);
    }
  }
  const payments = typeof summary.payments === "number" && Number.isFinite(summary.payments) && summary.payments >= 0
    ? Math.round(summary.payments * 100) : null;
  return {
    summaryPayments: payments === null ? null : payments / 100,
    refundCredits: refunds / 100,
    cardPayments: repaymentCount ? repayments / 100 : null,
    // Compatibility field: gross source credits, never compared with an
    // ambiguously grouped bank Payments subtotal.
    calculatedPayments: (repayments + refunds) / 100,
    repaymentTotal: repayments / 100,
    cancelledRefunds: 0,
    paymentRows: paymentRows.map(({ id, date, merchant, amount, kind, page }) => ({ id, date, merchant, amount, kind, page })),
  };
}
