import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useLocalToday } from "@/hooks/useLocalToday";
import { type BudgetPeriod,buildBudgetPeriod } from "@/lib/budgetPeriod";
import { costHistoryPayments } from "@/lib/costHistoryPayments";
import { queryKeys } from "@/lib/queryKeys";
import { recordedPayments } from "@/lib/recordedPayments";
import { currenciesService } from "@/services/currencies";
import { paymentRecordsService } from "@/services/paymentRecords";
import { subscriptionsService } from "@/services/subscriptions";

export function useMonthlyBudgetData(
  userId: string,
  paymentTracking: boolean,
  enabled = true,
  selectedYear?: number,
  periodMonths: BudgetPeriod = 1,
) {
  const options = { enabled: !!userId && enabled };
  const subscriptions = useQuery({
    queryKey: queryKeys.subscriptions.all(userId),
    queryFn: () => subscriptionsService.list(userId),
    ...options,
  });
  const currencies = useQuery({
    queryKey: queryKeys.currencies.all(userId),
    queryFn: () => currenciesService.list(userId),
    ...options,
  });
  const records = useQuery({
    queryKey: queryKeys.paymentRecords.all(userId),
    queryFn: () => paymentRecordsService.listForUser(userId),
    ...options,
  });
  const [year, month, day] = useLocalToday().split("-").map(Number);
  const historyYear = selectedYear ?? year;
  const historyPayments = useMemo(() => {
    const time = new Date();
    const now = new Date(
      year,
      month - 1,
      day,
      time.getHours(),
      time.getMinutes(),
      time.getSeconds(),
    );
    return costHistoryPayments(
      subscriptions.data ?? [],
      currencies.data ?? [],
      records.data ?? [],
      historyYear,
      now,
    );
  }, [subscriptions.data, currencies.data, records.data, historyYear, year, month, day]);
  const period = useMemo(
    () => buildBudgetPeriod(
      subscriptions.data ?? [], currencies.data ?? [], records.data ?? [], paymentTracking,
      new Date(year, month - 1, day), periodMonths,
    ),
    [subscriptions.data, currencies.data, records.data, paymentTracking, year, month, day, periodMonths],
  );
  const entries = period.entries;
  const paymentCosts = useMemo(() => {
    const totals = new Map<string, { year: number; month: number; total: number }>();
    // A paused subscription still has real paid history. Share conversion and
    // deduplication with statistics instead of estimating from its current price.
    for (const payment of recordedPayments(
      subscriptions.data ?? [],
      currencies.data ?? [],
      records.data ?? [],
    )) {
      if (payment.amount === null) continue;
      const year = payment.paidAt.getFullYear();
      const month = payment.paidAt.getMonth() + 1;
      const key = `${year}/${month}`;
      const point = totals.get(key) ?? { year, month, total: 0 };
      point.total += payment.amount;
      totals.set(key, point);
    }
    return [...totals.values()];
  }, [subscriptions.data, currencies.data, records.data]);
  return {
    entries,
    periodCredits: period.credits,
    paymentCosts,
    paymentDetails: historyPayments.details,
    paymentForecasts: historyPayments.forecasts,
    isLoading: subscriptions.isPending || currencies.isPending || records.isPending,
    hasError: subscriptions.isError || currencies.isError || records.isError,
  };
}
