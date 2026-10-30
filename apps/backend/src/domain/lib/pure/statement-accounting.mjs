import { statementSourceRows } from "./statement-payments.mjs";
import { statementRefundSourceSafe } from "./statement-refunds.mjs";

// The review screen and server must share the entire cent-based calculation.
export function statementUnitemizedFees(rows, summary = {}, excluded = []) {
  if (summary.fees === undefined || !Number.isFinite(summary.fees) || summary.fees < 0) return 0;
  let itemized = 0;
  for (const row of statementSourceRows([...rows, ...excluded])) {
    if (row.currency !== "TRY" || row.kind === "repayment" || !Number.isFinite(row.amount)) continue;
    if (row.kind === "fee")
      itemized += (row.kind === "refund" ? -1 : 1) * Math.round(row.amount * 100);
    if (row.financing && ["charge", "cash"].includes(row.kind))
      for (const key of ["interest", "kkdf", "bsmv"])
        if (typeof row.financing[key] === "number" && Number.isFinite(row.financing[key]) && row.financing[key] >= 0)
          itemized += Math.round(row.financing[key] * 100);
  }
  return Math.max(0, Math.round(summary.fees * 100) - itemized) / 100;
}

const monetary = (value) => typeof value === "number" && Number.isFinite(value) &&
  value >= 0 && value <= 100000000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;

// Refund identity and user selection have no role here. Verify conservation of
// money from every original posting, independently of bank refund presentation.
export function inspectStatementAccounting(rows, summary = {}, bank = "", context = {}) {
  rows = statementSourceRows(rows);
  const issues = [];
  const ids = new Set();
  if (!rows.length) issues.push("no_source_rows");
  for (const row of rows) {
    if (row.id && ids.has(row.id)) issues.push("conflicting_source_rows");
    ids.add(row.id);
  }
  if (rows.some((row) => !monetary(row.amount) || !["charge", "refund", "repayment", "fee", "cash"].includes(row.kind) || row.uncertain || row.amount_issue || !statementRefundSourceSafe(row)))
    issues.push("invalid_source_rows");
  if (rows.some((row) => row.currency !== "TRY")) issues.push("unsupported_currency");
  if (Object.values(summary).some((value) => value !== undefined && !monetary(value))) issues.push("invalid_summary");
  if (context.unresolvedCount > 0 || context.emptyPages > 0) issues.push("unread_source_rows");
  const available = (keys) => keys.every((key) => monetary(summary[key]));
  const movementFields = ["payments", "purchases", "cash", "fees"];
  const hasMovement = available(movementFields);
  const hasBalances = available(["previous_balance", "balance"]);
  const summaryNet = hasMovement ? (Math.round(summary.purchases * 100) + Math.round(summary.cash * 100) +
    Math.round(summary.fees * 100) - Math.round(summary.payments * 100)) / 100 : null;
  const sourceValid = rows.length > 0 && !issues.some((issue) => ["invalid_source_rows", "unsupported_currency", "conflicting_source_rows"].includes(issue));
  const summaryOnlyFees = sourceValid ? statementUnitemizedFees(rows, summary) : 0;
  const sourceNet = sourceValid ? (rows.reduce((sum, row) => sum +
    (["refund", "repayment"].includes(row.kind) ? -1 : 1) * Math.round(row.amount * 100), 0) + Math.round(summaryOnlyFees * 100)) / 100 : null;
  const checks = [];
  const compare = (key, expected, actual) => {
    if (Math.round(expected * 100) === actual) return;
    checks.push({
      key, expected, actual: actual / 100, difference: (actual - Math.round(expected * 100)) / 100,
    });
  };
  if (hasBalances && hasMovement)
    compare("summary_balance", summary.balance, Math.round(summary.previous_balance * 100) + Math.round(summaryNet * 100));
  let verificationBasis = null;
  if (sourceNet !== null && hasBalances) {
    verificationBasis = "balance";
    compare("balance", summary.balance, Math.round(summary.previous_balance * 100) + Math.round(sourceNet * 100));
  } else if (sourceNet !== null && hasMovement) {
    verificationBasis = "summary";
    compare("movement", summaryNet, Math.round(sourceNet * 100));
  }
  if (!hasBalances && !hasMovement) issues.push("incomplete_summary");
  return {
    status: checks.length ? "mismatch" : issues.length || !verificationBasis ? "incomplete" : "verified",
    differences: checks,
    issues: [...new Set(issues)],
    sourceNet, summaryNet, summaryOnlyFees, verificationBasis,
  };
}

export function reconcileStatement(rows, summary = {}, bank = "") {
  return inspectStatementAccounting(rows, summary, bank).differences;
}
