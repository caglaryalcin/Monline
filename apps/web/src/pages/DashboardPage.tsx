import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { BudgetOverviewCard } from "@/components/dashboard/BudgetOverviewCard";
import { DashboardYearOverview } from "@/components/dashboard/DashboardYearOverview";
import { useDashboardDerivedData } from "@/components/dashboard/useDashboardDerivedData";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { useMonthlyBudgetData } from "@/hooks/useMonthlyBudgetData";
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
  const today = useLocalToday();

  const summary = useSummaryData(userId);
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

  const { budget, totalCredits } = useDashboardDerivedData({
    user,
    summary: summaryData,
    yearlyCosts: yearlyCosts.data,
    paymentCosts: monthlyBudget.paymentCosts,
  });

  return (
    <div className="animate-in slide-in-from-bottom-4 space-y-8 fade-in duration-500">
      <DashboardYearOverview key={userId} userId={userId} today={today} sidebar={
          <BudgetOverviewCard
            budget={budget}
            entries={monthlyBudget.entries}
            totalCredits={totalCredits}
            isLoading={monthlyBudget.isLoading || summary.isLoading}
            hasError={monthlyBudget.hasError || summary.isError}
            formatValue={formatValue}
          />
      } />
    </div>
  );
}
