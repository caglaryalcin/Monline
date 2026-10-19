import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, CalendarClock, DollarSign, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { BudgetOverviewCard } from "@/components/dashboard/BudgetOverviewCard";
import { CostHistoryCard } from "@/components/dashboard/CostHistoryCard";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { useDashboardDerivedData } from "@/components/dashboard/useDashboardDerivedData";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { useMonthlyBudgetData } from "@/hooks/useMonthlyBudgetData";
import { usePaidTotals } from "@/hooks/usePaidTotals";
import { useSummaryData } from "@/hooks/useSummaryData";
import { useYearlyCosts } from "@/hooks/useYearlyCosts";
import { queryKeys } from "@/lib/queryKeys";
import { currentMonthKey } from "@/lib/recordTypes";
import { toast } from "@/lib/toast";
import { formatPrice } from "@/lib/utils";
import { yearlyCostsService } from "@/services/yearlyCosts";

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";
  const currentYear = Number(useLocalToday().slice(0, 4));
  const [selectedYear, setSelectedYear] = useState(currentYear);
  useEffect(() => setSelectedYear(currentYear), [currentYear]);

  const summary = useSummaryData(userId);
  const paid = usePaidTotals(userId, selectedYear);
  const monthlyBudget = useMonthlyBudgetData(userId, !!user?.payment_tracking);
  const yearlyCosts = useYearlyCosts(userId);
  const lastSnapshot = useRef("");

  const snapshotMutation = useMutation({
    mutationFn: () => yearlyCostsService.snapshot(),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.yearlyCosts.all(userId),
      }),
    onError: () => toast.error(t("history_save_error")),
  });

  const { mutate: takeSnapshot, isPending: snapshotPending } = snapshotMutation;
  const snapshotKey = summary.data
    ? `${userId}:${currentMonthKey()}:${summary.data.totalMonthly}`
    : "";

  useEffect(() => {
    // Refresh the current month's stored cost after changes, including zero
    // after the last deletion. Older months remain historical snapshots.
    if (
      snapshotKey &&
      snapshotKey !== lastSnapshot.current &&
      !summary.isFetching &&
      !summary.isError &&
      !snapshotPending
    ) {
      lastSnapshot.current = snapshotKey;
      takeSnapshot();
    }
  }, [snapshotKey, summary.isFetching, summary.isError, snapshotPending, takeSnapshot]);

  const summaryData = summary.data;
  const formatValue = (value: number) =>
    formatPrice(value, summaryData?.mainSymbol ?? "$", {
      currencyCode: summaryData?.mainCode,
    });

  const { budget, chartData, totalCredits } = useDashboardDerivedData({
    user,
    summary: summaryData,
    yearlyCosts: yearlyCosts.data,
    paymentCosts: monthlyBudget.paymentCosts,
  });

  return (
    <div className="animate-in slide-in-from-bottom-4 space-y-8 fade-in duration-500">
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <SummaryCard
              title={t("total_weekly")}
              year={selectedYear}
              value={paid.data ? formatValue(paid.data.averageWeekly) : "—"}
              icon={<TrendingUp className="h-6 w-6" />}
              loading={paid.isLoading}
              accent="var(--chart-2)"
            />
            <SummaryCard
              title={t("total_monthly")}
              year={selectedYear}
              value={paid.data ? formatValue(paid.data.averageMonthly) : "—"}
              icon={<DollarSign className="h-6 w-6" />}
              loading={paid.isLoading}
              accent="var(--chart-3)"
            />
            <SummaryCard
              title={t("total_yearly")}
              year={selectedYear}
              value={paid.data ? formatValue(paid.data.totalYearly) : "—"}
              icon={<Calendar className="h-6 w-6" />}
              loading={paid.isLoading}
              accent="var(--chart-4)"
            />
            <SummaryCard
              title={t("next_month_cost")}
              value={summaryData ? formatValue(summaryData.nextMonthTotal) : "—"}
              icon={<CalendarClock className="h-6 w-6" />}
              loading={summary.isLoading}
              accent="var(--chart-1)"
            />
          </div>

          <section aria-label={t("history")}>
            <CostHistoryCard
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
              variant="classic"
              data={chartData}
              forecasts={summaryData?.forecasts}
              formatValue={formatValue}
              currencySymbol={summaryData?.mainSymbol ?? "$"}
              isLoading={summary.isLoading || yearlyCosts.isLoading || monthlyBudget.isLoading}
              hasError={!!yearlyCosts.error || monthlyBudget.hasError || summary.isError}
              className=""
            />
          </section>
        </div>
        <div className="min-w-0 xl:col-span-4">
          <BudgetOverviewCard
            budget={budget}
            entries={monthlyBudget.entries}
            totalCredits={totalCredits}
            isLoading={monthlyBudget.isLoading || summary.isLoading}
            hasError={monthlyBudget.hasError || summary.isError}
            formatValue={formatValue}
          />
        </div>
      </div>
    </div>
  );
}
