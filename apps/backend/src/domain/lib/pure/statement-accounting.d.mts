import type { StatementPaymentRow } from "./statement-payments.mjs";

interface AccountingRow extends StatementPaymentRow { category?: string; financing?: { principal: number; interest: number; kkdf: number; bsmv: number } }
interface AccountSummary { fees?: number; payments?: number; purchases?: number; cash?: number; previous_balance?: number; balance?: number }
export interface StatementReconciliationCheck {
  key: "payments" | "balance" | "summary_balance" | "movement";
  expected: number;
  actual: number;
  difference: number;
}
export interface StatementAccountingInspection {
  status: "verified" | "mismatch" | "incomplete";
  differences: StatementReconciliationCheck[];
  issues: string[];
  sourceNet: number | null;
  summaryNet: number | null;
  summaryOnlyFees: number;
  verificationBasis: "balance" | "summary" | null;
}
export function inspectStatementAccounting(rows: AccountingRow[], summary?: AccountSummary, bank?: string, context?: { unresolvedCount?: number; emptyPages?: number }): StatementAccountingInspection;
export function statementUnitemizedFees(rows: AccountingRow[], summary?: AccountSummary, excluded?: AccountingRow[]): number;
export function reconcileStatement(rows: AccountingRow[], summary?: AccountSummary, bank?: string): StatementReconciliationCheck[];
