import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BudgetOverviewCard } from "@/components/dashboard/BudgetOverviewCard";
import { monthlyBillPayments, monthlyLoanPayments } from "@/lib/dashboardMonthlyPayments";
import type { DashboardPaymentGroup } from "@/lib/dashboardYear";
import type { FinanceRow } from "@/lib/finance";
import type { MonthlyBudgetEntry } from "@/lib/monthlyBudget";
import { type LoanSummary, subscriptionSection } from "@/lib/spending";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types";

export interface DashboardSidebarData {
  bills: DashboardPaymentGroup;
  loans: LoanSummary[];
  financeRows?: FinanceRow[];
  currencies: Currency[];
  billsLoading: boolean;
  billsError: boolean;
  loansLoading: boolean;
  loansError: boolean;
}

export function DashboardPaymentSidebar({
  data,
  today,
  budget,
  entries,
  totalCredits,
  isLoading,
  hasError,
  formatValue,
}: {
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
  const bills = monthlyBillPayments(data.bills, today, data.currencies);
  const billEntries = [
    ...bills.entries,
    ...entries.filter((entry) => subscriptionSection(entry.subscription) === "bills"),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const loans = monthlyLoanPayments(data.loans, today, data.currencies, data.financeRows);
  return (
    <BudgetOverviewCard
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
            ? data.billsLoading
            : data.loansLoading
      }
      hasError={
        section === "online"
          ? hasError
          : section === "bills"
            ? data.billsError || bills.unpriced > 0
            : data.loansError || loans.unpriced > 0
      }
    />
  );
}
