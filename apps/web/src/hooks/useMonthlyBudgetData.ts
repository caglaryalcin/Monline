import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useLocalToday } from "@/hooks/useLocalToday";
import { buildMonthlyBudget } from "@/lib/monthlyBudget";
import { queryKeys } from "@/lib/queryKeys";
import { recordedPayments } from "@/lib/recordedPayments";
import { currenciesService } from "@/services/currencies";
import { paymentRecordsService } from "@/services/paymentRecords";
import { subscriptionsService } from "@/services/subscriptions";

export function useMonthlyBudgetData(userId: string, paymentTracking: boolean, enabled = true) {
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
  const entries = useMemo(
    () =>
      buildMonthlyBudget(
        subscriptions.data ?? [],
        currencies.data ?? [],
        records.data ?? [],
        paymentTracking,
        new Date(year, month - 1, day),
      ),
    [subscriptions.data, currencies.data, records.data, paymentTracking, year, month, day],
  );
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
    paymentCosts,
    isLoading: subscriptions.isPending || currencies.isPending || records.isPending,
    hasError: subscriptions.isError || currencies.isError || records.isError,
  };
}
