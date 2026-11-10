import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Landmark, Lightbulb, Scale, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { useNumberLocale } from "@/hooks/useNumberLocale";
import client from "@/lib/client";
import { financeOverview, type FinanceOverviewStatement } from "@/lib/financeOverview";
import { resolveLocale } from "@/lib/locale";
import { spendingKey } from "@/lib/spending";
import { formatCurrency } from "@/lib/utils";
import { financeService } from "@/services/finance";
import { savingsService } from "@/services/savings";
import { spendingService } from "@/services/spending";

export function FinanceOverview() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const numberLocale = useNumberLocale();
  const today = useLocalToday();
  const month = today.slice(0, 7);
  const userId = user?.id || "";
  const enabled = !!userId;
  const ledger = useQuery({ queryKey: ["finance", userId], queryFn: financeService.get, enabled });
  const needsStatements = !!ledger.data?.finance_statement_links?.length;
  const statements = useQuery({
    queryKey: ["bank-statements", userId, "overview-balances"],
    queryFn: () => client.collection("bank_statements").getFullList<FinanceOverviewStatement>({ fields: "id,period,summary", sort: "-period,-created" }),
    enabled: enabled && needsStatements,
  });
  const needsCardSpending = !!ledger.data?.finance_rows.some((row) => !row.is_deleted && row.expense_type === "credit_card");
  const spending = useQuery({ queryKey: spendingKey(userId), queryFn: spendingService.get, enabled: enabled && needsCardSpending });
  const savings = useQuery({ queryKey: ["savings", userId], queryFn: savingsService.list, enabled });
  const needsRates = !!savings.data?.some((saving) => saving.asset !== "TRY") ||
    !!spending.data?.installments.some((plan) => plan.row_id && plan.currency !== "TRY") ||
    !!spending.data?.events.some((event) => event.card_row_id && event.currency !== "TRY");
  const rates = useQuery({
    queryKey: ["savings-rates", userId, "fixer"], queryFn: savingsService.rates,
    enabled: enabled && needsRates, staleTime: 60000, refetchInterval: 5 * 60 * 1000,
  });
  const summary = financeOverview({
    month,
    ledger: ledger.isError ? undefined : ledger.data,
    savings: savings.isError ? undefined : savings.data,
    statements: needsStatements ? (statements.isError ? undefined : statements.data) : [],
    spending: spending.isError ? undefined : spending.data,
    rates: rates.data,
  });
  const monthLabel = new Intl.DateTimeFormat(resolveLocale(i18n), { month: "long", year: "numeric" })
    .format(new Date(`${month}-01T12:00:00`));
  const money = (value: number | null) => value === null ? "—" : formatCurrency(value, "TRY", { locale: numberLocale });
  const rateLoading = needsRates && rates.isPending;
  const cashLoading = ledger.isPending;
  const debtLoading = ledger.isPending || (needsStatements && statements.isPending) ||
    (needsCardSpending && spending.isPending) || (needsRates && rates.isPending);
  const assetLoading = savings.isPending || rateLoading;
  const failed = ledger.isError || savings.isError ||
    (needsStatements && statements.isError) || (needsCardSpending && spending.isError) || (needsRates && rates.isError);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("finance_workspace_overview")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("finance_workspace_intro")}</p>
      </div>
      {failed && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 p-4 text-sm">
        <p>{t("finance_workspace_load_error")}</p>
        <Button variant="outline" size="sm" onClick={() => void Promise.all([
          ledger.refetch(), savings.refetch(),
          ...(needsStatements ? [statements.refetch()] : []),
          ...(needsCardSpending ? [spending.refetch()] : []),
          ...(needsRates ? [rates.refetch()] : []),
        ])}>{t("savings_retry")}</Button>
      </div>}
      <section className="space-y-3" aria-label={t("finance_workspace_month_state")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t("finance_workspace_month_state")}</h2>
          <span className="text-sm text-muted-foreground">{monthLabel}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard title={t("finance_workspace_income")} value={money(summary.income)}
            icon={<ArrowDownLeft />} accent="34 197 94" loading={cashLoading} description={t("finance_workspace_received")} />
          <SummaryCard title={t("finance_workspace_expenses")} value={money(summary.expenses)}
            icon={<ArrowUpRight />} accent="244 63 94" loading={cashLoading} description={t("finance_workspace_paid")} />
          <SummaryCard title={t("finance_workspace_remaining")} value={money(summary.remaining)}
            icon={<Wallet />} accent="59 130 246" loading={cashLoading} description={t("finance_workspace_flow_formula")} />
        </div>
      </section>
      <section className="space-y-3" aria-label={t("finance_workspace_assets_state")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t("finance_workspace_assets_state")}</h2>
          <span className="text-sm text-muted-foreground">{t("finance_workspace_recorded")}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard title={t("savings_total")} value={money(summary.assets)}
            icon={<span aria-hidden="true" className="inline-flex h-[22px] w-[22px] items-center justify-center text-xl leading-none">💰</span>}
            accent="139 92 246" loading={assetLoading} description={t("finance_workspace_savings")} />
          <SummaryCard title={t("finance_workspace_total_debts")} value={money(summary.debts)}
            icon={<Landmark />} accent="249 115 22" loading={debtLoading} description={t("finance_workspace_debt_formula")} />
          <SummaryCard title={t("finance_workspace_net")} value={money(summary.net)}
            icon={<Scale />} accent="20 184 166" loading={assetLoading || debtLoading} description={t("finance_workspace_net_formula")} />
        </div>
        {!assetLoading && !debtLoading && (summary.assets === null || summary.debts === null) &&
          <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{t("finance_workspace_incomplete")}</p>}
      </section>
      <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Lightbulb aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>{t("finance_workspace_summary_help")}</p>
      </div>
    </div>
  );
}
