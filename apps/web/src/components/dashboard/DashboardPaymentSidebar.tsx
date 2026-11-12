import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BudgetOverviewCard } from "@/components/dashboard/BudgetOverviewCard";
import { type BudgetPeriod, budgetPeriodBounds } from "@/lib/budgetPeriod";
import { type DashboardMonthlyEntry, monthlyBillPayments, monthlyLoanPayments } from "@/lib/dashboardMonthlyPayments";
import type { DashboardPaymentGroup } from "@/lib/dashboardYear";
import type { FinanceRow } from "@/lib/finance";
import type { MonthlyBudgetEntry } from "@/lib/monthlyBudget";
import type { QuickPaymentActions } from "@/lib/quickPayment";
import { type LoanSummary, type SpendingEvent, subscriptionSection } from "@/lib/spending";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types";

export interface DashboardSidebarData {
  bills: DashboardPaymentGroup;
  skippedBills?: SpendingEvent[];
  loans: LoanSummary[];
  financeRows?: FinanceRow[];
  currencies: Currency[];
  billsLoading: boolean;
  billsError: boolean;
  loansLoading: boolean;
  loansError: boolean;
}

export function DashboardPaymentSidebar({
  quickPayments,
  periodMonths = 1,
  onPeriodChange,
  data,
  today,
  budget,
  entries,
  totalCredits,
  isLoading,
  hasError,
  formatValue,
}: {
  quickPayments?: QuickPaymentActions;
  periodMonths?: BudgetPeriod;
  onPeriodChange?: (value: BudgetPeriod) => void;
  data: DashboardSidebarData;
  today: string;
  budget: number;
  entries: MonthlyBudgetEntry[];
  totalCredits: number;
  isLoading: boolean;
  hasError: boolean;
  formatValue: (amount: number) => string;
}) {
  const { t } = useTranslation();
  const [section, setSection] = useState<"online" | "bills" | "loans">("online");
  const online = entries.filter((entry) =>
    ["online", "other"].includes(subscriptionSection(entry.subscription)),
  );
  const { from, until } = budgetPeriodBounds(today, periodMonths);
  const bills = monthlyBillPayments(data.bills, today, data.currencies, periodMonths);
  const skippedBills: DashboardMonthlyEntry[] = (data.skippedBills ?? [])
    .filter((bill) => bill.date >= from && bill.date < until)
    .map((bill) => ({
      id: `skipped:${bill.id}`,
      name: bill.name,
      date: bill.date,
      providerRowId: bill.provider_row_id,
      amount: 0,
      status: "skipped",
      bill,
    }));
  const billEntries = [
    ...bills.entries,
    ...skippedBills,
    ...entries.filter((entry) => entry.date >= from && entry.date < until && subscriptionSection(entry.subscription) === "bills"),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const loans = monthlyLoanPayments(data.loans, today, data.currencies, data.financeRows, periodMonths);
  return (
    <BudgetOverviewCard
      quickPayments={quickPayments}
      periodMonths={periodMonths}
      onPeriodChange={onPeriodChange}
      section={section}
      controls={
        <div
          role="group"
          className="inline-flex flex-wrap items-center gap-0.5 rounded-xl bg-muted p-1"
          aria-label={t("dashboard_month_payment_sections")}
        >
          {(["online", "bills", "loans"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={section === value}
              onClick={() => setSection(value)}
              className={cn(
                "whitespace-nowrap rounded-lg border border-transparent px-2 py-1.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                section === value
                  ? "border-primary/60 bg-background font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`dashboard_year_section_${value}`)}
            </button>
          ))}
        </div>
      }
      budget={budget}
      totalCredits={totalCredits}
      formatValue={formatValue}
      entries={section === "online" ? online : section === "bills" ? billEntries : loans.entries}
      isLoading={
        section === "online"
          ? isLoading
          : section === "bills"
            ? data.billsLoading || isLoading
            : data.loansLoading
      }
      hasError={
        section === "online"
          ? hasError
          : section === "bills"
            ? data.billsError || hasError || data.bills.unpriced > 0 || bills.unpriced > 0
            : data.loansError || loans.unpriced > 0
      }
    />
  );
}
