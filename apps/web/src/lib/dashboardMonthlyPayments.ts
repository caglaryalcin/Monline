import { type BudgetPeriod, budgetPeriodBounds } from "@/lib/budgetPeriod";
import type { DashboardPaymentGroup } from "@/lib/dashboardYear";
import type { FinanceRow } from "@/lib/finance";
import type { MonthlyBudgetEntry } from "@/lib/monthlyBudget";
import type { LoanSummary } from "@/lib/spending";
import type { Currency } from "@/types";

export type DashboardMonthlyEntry = Omit<MonthlyBudgetEntry, "subscription" | "status"> & {
  status: MonthlyBudgetEntry["status"] | "partial";
  paidAmount?: number;
  pendingAmount?: number;
  subscription?: MonthlyBudgetEntry["subscription"];
  name?: string;
  labelKey?: string;
  monthOnly?: boolean;
  providerRowId?: string;
};

/** Use the same bill plans as the year graph, converted to the user's main currency. */
export function monthlyBillPayments(
  group: DashboardPaymentGroup,
  today: string,
  currencies: Currency[],
  months: BudgetPeriod = 1,
) {
  const { from, until } = budgetPeriodBounds(today, months);
  const main = currencies.find((currency) => currency.is_main);
  let unpriced = 0;
  const entries: DashboardMonthlyEntry[] = [];
  for (const [paid, items] of [
    [true, group.items],
    [false, group.upcoming],
  ] as const) {
    items.forEach((item, index) => {
      if (item.date < from || item.date >= until) return;
      const currency = currencies.find((currency) => currency.code === item.currency);
      const rate =
        item.currency === (main?.code ?? "TRY")
          ? 1
          : currency && main && currency.rate > 0 && main.rate > 0
            ? main.rate / currency.rate
            : null;
      if (rate == null) {
        unpriced++;
        return;
      }
      entries.push({
        id: `bill:${paid}:${index}`,
        name: item.name,
        providerRowId: item.providerRowId,
        date: item.date,
        labelKey: item.labelKey,
        monthOnly: !!item.labelKey,
        amount: Math.round(item.amount * rate * 100) / 100,
        status: paid ? "paid" : !item.labelKey && item.date < today ? "overdue" : "pending",
      });
    });
  }
  return { entries: entries.sort((a, b) => a.date.localeCompare(b.date)), unpriced };
}

/** Loan summaries preserve partial payments and combine a loan's rows across years. */
export function monthlyLoanPayments(
  loans: LoanSummary[],
  today: string,
  currencies: Currency[],
  rows: FinanceRow[] = [],
  months: BudgetPeriod = 1,
) {
  const { from, until } = budgetPeriodBounds(today, months);
  const entries: DashboardMonthlyEntry[] = [];
  let unpriced = 0;
  for (const loan of loans) {
    const row = rows.find((row) => row.id === loan.row_id);
    for (const month of loan.months) {
      const item = { name: loan.name, date: `${month.month}-01`, currency: loan.currency };
      if (item.date < from || item.date >= until) continue;
      const result = monthlyBillPayments(
        {
          items: month.paid_amount > 0 ? [{ ...item, amount: month.paid_amount }] : [],
          upcoming: month.remaining_amount > 0 ? [{ ...item, amount: month.remaining_amount }] : [],
          totals: [],
          unpriced: 0,
        },
        today,
        currencies,
        months,
      );
      if (result.unpriced) {
        unpriced++;
        continue;
      }
      if (!result.entries.length) continue;
      const paidAmount = result.entries.find((entry) => entry.status === "paid")?.amount ?? 0;
      const pendingAmount = result.entries.find((entry) => entry.status !== "paid")?.amount ?? 0;
      entries.push({
        id: `loan:${loan.row_id}:${month.month}`,
        name: loan.name,
        providerRowId: loan.provider_row_id || row?.origin_row || loan.row_id,
        date: item.date,
        amount: (Math.round(paidAmount * 100) + Math.round(pendingAmount * 100)) / 100,
        paidAmount,
        pendingAmount,
        monthOnly: true,
        status: pendingAmount === 0 ? "paid" : paidAmount > 0 ? "partial" : "pending",
      });
    }
  }
  return { entries: entries.sort((a, b) => a.date.localeCompare(b.date)), unpriced };
}
