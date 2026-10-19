import { useQuery } from "@tanstack/react-query";

import { useLocalToday } from "@/hooks/useLocalToday";
import { paidTotals } from "@/lib/paidTotals";
import { queryKeys } from "@/lib/queryKeys";
import { currenciesService } from "@/services/currencies";
import { paymentRecordsService } from "@/services/paymentRecords";
import { subscriptionsService } from "@/services/subscriptions";

export function usePaidTotals(userId: string, selectedYear?: number) {
  // Refresh the calendar boundaries at midnight and when returning to the app.
  useLocalToday();
  const options = { enabled: !!userId };
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
  const payments = useQuery({
    queryKey: queryKeys.paymentRecords.all(userId),
    queryFn: () => paymentRecordsService.listForUser(userId),
    ...options,
  });
  const ready = !!subscriptions.data && !!currencies.data && !!payments.data;
  const hasError = subscriptions.isError || currencies.isError || payments.isError;

  return {
    data:
      ready && !hasError
        ? paidTotals(
            subscriptions.data!,
            currencies.data!,
            payments.data!,
            new Date(),
            selectedYear,
          )
        : undefined,
    isLoading: subscriptions.isLoading || currencies.isLoading || payments.isLoading,
    hasError,
  };
}
