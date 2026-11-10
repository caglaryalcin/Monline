import {
  type FinanceData,
  financeMonths,
  financeRowsForYear,
  isCardPaid,
  isFinanceDeficitRow,
} from "./finance";
import { type Saving, type SavingsRates, savingsValue } from "./savings";
import type { SavedStatement } from "./statements";

export type FinanceOverviewStatement = Pick<SavedStatement, "id" | "period" | "summary">;

/** This month's unpaid ledger entries plus the latest remaining card balances. */
function recordedDebts(ledger: FinanceData, statements: FinanceOverviewStatement[], month: string) {
  const rows = new Map(ledger.finance_rows.map((row) => [row.id, row]));
  const cardRoot = (id: string) => rows.get(id)?.origin_row || id;
  const currentCards = financeRowsForYear(ledger.finance_rows, Number(month.slice(0, 4)), ledger)
    .filter((row) => row.expense_type === "credit_card");
  const activeRoots = new Set(currentCards.map((row) => cardRoot(row.id)));
  const unpaidCards = new Map<string, number>();
  let total = 0;
  for (const entry of ledger.finance_entries) {
    const row = rows.get(entry.row_id);
    if (!row || row.is_deleted || row.kind !== "expense" || isFinanceDeficitRow(row) ||
      isCardPaid(entry, row) || entry.status !== "planned" || !entry.date.startsWith(month)) continue;
    const amount = Math.round(entry.amount * 100);
    if (row.expense_type === "credit_card") {
      const root = cardRoot(row.id);
      activeRoots.add(root);
      unpaidCards.set(root, (unpaidCards.get(root) || 0) + amount);
    } else total += amount;
  }

  const sourceStatements = new Map(statements.map((statement) => [statement.id, statement]));
  const latest = new Map<string, FinanceOverviewStatement>();
  for (const link of ledger.finance_statement_links || []) {
    const root = cardRoot(link.row_id);
    const statement = sourceStatements.get(link.statement_id);
    if (!activeRoots.has(root) || !statement || statement.period > month ||
      typeof statement.summary?.balance !== "number" || !Number.isFinite(statement.summary.balance) ||
      statement.summary.balance < 0) continue;
    const previous = latest.get(root);
    if (!previous || statement.period > previous.period) latest.set(root, statement);
  }

  const payments = new Map<string, number>();
  for (const entry of ledger.finance_entries) {
    const row = rows.get(entry.row_id);
    if (!row || row.is_deleted || row.expense_type !== "credit_card" || entry.status !== "settled") continue;
    const root = cardRoot(row.id);
    const statement = latest.get(root);
    const paidMonth = (entry.settled_date || entry.date).slice(0, 7);
    if (statement && paidMonth > statement.period && paidMonth <= month)
      payments.set(root, (payments.get(root) || 0) + Math.round(entry.amount * 100));
  }
  for (const root of activeRoots) {
    const statement = latest.get(root);
    const remaining = statement
      ? Math.max(0, Math.round(statement.summary!.balance! * 100) - (payments.get(root) || 0)) : 0;
    // A scheduled card repayment is part of that card's balance. Count the
    // larger recorded obligation once, including plans without a statement.
    total += Math.max(unpaidCards.get(root) || 0, remaining);
  }
  return total / 100;
}

/** Monthly totals use the ledger's calculation; assets use the user's savings. */
export function financeOverview({
  month, ledger, savings, statements, rates,
}: {
  month: string;
  ledger?: FinanceData;
  savings?: Saving[];
  statements?: FinanceOverviewStatement[];
  rates?: SavingsRates;
}) {
  const period = ledger ? financeMonths(ledger, Number(month.slice(0, 4))).find((value) => value.month === month) : undefined;
  const income = period?.received ?? null;
  const expenses = period ? Math.round((period.paid + period.carryover) * 100) / 100 : null;
  const remaining = period?.remaining ?? null;
  let assets: number | null = null;
  if (savings) {
    const values = savings.map((saving) => savingsValue(saving, rates));
    if (values.every((value) => value !== null))
      assets = values.reduce<number>((sum, value) => sum + Math.round(value! * 100), 0) / 100;
  }
  const debts = ledger && statements ? recordedDebts(ledger, statements, month) : null;
  const net = assets !== null && debts !== null ? Math.round((assets - debts) * 100) / 100 : null;
  return { income, expenses, remaining, assets, debts, net };
}
