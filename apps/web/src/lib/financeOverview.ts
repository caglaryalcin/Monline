import {
  type FinanceData,
  financeMonths,
  isCardPaid,
  isFinanceDeficitRow,
} from "./finance";
import { installmentSchedule } from "./installmentSchedule";
import { type Saving, type SavingsRates, savingsUnitRate, savingsValue } from "./savings";
import type { SpendingData } from "./spending";
import type { SavedStatement } from "./statements";

export type FinanceOverviewStatement = Pick<SavedStatement, "id" | "period" | "summary">;

type CardSpending = Pick<SpendingData, "events" | "installments">;

function totalTryCents(items: { amount: number; currency: string }[], rates?: SavingsRates) {
  let total = 0;
  for (const item of items) {
    if (item.amount === 0) continue;
    const rate = savingsUnitRate(item.currency, rates);
    if (rate === null || !Number.isFinite(item.amount)) return null;
    total += Math.round(item.amount * rate * 100);
  }
  return total;
}

/** Current unpaid bills plus recorded card balances, purchases and installments. */
function recordedDebts(
  ledger: FinanceData,
  statements: FinanceOverviewStatement[],
  month: string,
  spending?: CardSpending,
  rates?: SavingsRates,
) {
  const rows = new Map(ledger.finance_rows.map((row) => [row.id, row]));
  const cardRoot = (id: string) => rows.get(id)?.origin_row || id;
  // A card balance survives the calendar year even before a new ledger row exists.
  const cards = ledger.finance_rows.filter((row) => !row.is_deleted && row.kind === "expense" && row.expense_type === "credit_card");
  const activeRoots = new Set(cards.map((row) => cardRoot(row.id)));
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

  // Do not briefly show only statement balances while card purchases are loading.
  if (activeRoots.size > 0 && !spending) return null;
  const previousMonth = new Date(`${month}-01T12:00:00Z`);
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const fallbackPeriod = previousMonth.toISOString().slice(0, 7);
  const firstPeriod = [...latest.values()].map((statement) => statement.period).sort()[0] || fallbackPeriod;
  // This schedule deduplicates repeated statement snapshots and projects only
  // the installments still owed after each card's latest published statement.
  const plans = spending ? installmentSchedule({
    events: spending.events,
    installments: spending.installments.filter((plan) => plan.period <= month),
  }, firstPeriod) : [];

  const payments = new Map<string, number>();
  for (const entry of ledger.finance_entries) {
    const row = rows.get(entry.row_id);
    if (!row || row.is_deleted || row.expense_type !== "credit_card" || entry.status !== "settled") continue;
    const root = cardRoot(row.id);
    const statement = latest.get(root);
    const paidMonth = (entry.settled_date || entry.date).slice(0, 7);
    if (paidMonth > (statement?.period || fallbackPeriod) && paidMonth <= month)
      payments.set(root, (payments.get(root) || 0) + Math.round(entry.amount * 100));
  }
  for (const root of activeRoots) {
    const statement = latest.get(root);
    const cutoff = statement?.period || fallbackPeriod;
    const installments = totalTryCents(plans.filter((plan) =>
      cardRoot(plan.row_id) === root && plan.period > cutoff,
    ), rates);
    const purchases = totalTryCents((spending?.events || []).filter((event) => {
      const period = event.source === "manual_card"
        ? event.statement_period || event.date.slice(0, 7) : event.date.slice(0, 7);
      return event.card_row_id && cardRoot(event.card_row_id) === root &&
        event.source !== "statement" && event.counts_as_expense && !event.duplicate_of &&
        !event.amount_pending && event.status !== "planned" &&
        (event.kind === "expense" || event.kind === "refund") && period > cutoff && period <= month;
    }), rates);
    if (installments === null || purchases === null) return null;
    const balance = statement ? Math.round(statement.summary!.balance! * 100) : 0;
    // Apply payments once to the entire card obligation so an overpayment also
    // reduces unbilled purchases and installments, rather than being discarded.
    const remaining = Math.max(0, balance + installments + purchases - (payments.get(root) || 0));
    // A scheduled card repayment is part of that card's balance. Count the
    // larger recorded obligation once, including plans without a statement.
    total += Math.max(unpaidCards.get(root) || 0, remaining);
  }
  return total / 100;
}

/** Monthly totals use the ledger's calculation; assets use the user's savings. */
export function financeOverview({
  month, ledger, savings, statements, spending, rates,
}: {
  month: string;
  ledger?: FinanceData;
  savings?: Saving[];
  statements?: FinanceOverviewStatement[];
  spending?: CardSpending;
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
  const debts = ledger && statements ? recordedDebts(ledger, statements, month, spending, rates) : null;
  const net = assets !== null && debts !== null ? Math.round((assets - debts) * 100) / 100 : null;
  return { income, expenses, remaining, assets, debts, net };
}
