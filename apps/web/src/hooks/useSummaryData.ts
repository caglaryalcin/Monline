import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { upcomingMonthCosts } from "@/lib/nextMonthCost";
import { queryKeys } from "@/lib/queryKeys";
import { currentMonthKey, isCredit, isDateInMonth } from "@/lib/recordTypes";
import { toMonthly } from "@/lib/utils";
import { currenciesService } from "@/services/currencies";
import { subscriptionsService } from "@/services/subscriptions";
import type { Subscription } from "@/types";

export function useSummaryData(userId: string) {
  const monthKey = currentMonthKey();
  // Share the source queries with subscriptions, calendar and budget. A saved
  // change must update every total, rather than leave a second summary cache stale.
  const subscriptions = useQuery({
    queryKey: queryKeys.subscriptions.all(userId),
    queryFn: () => subscriptionsService.list(userId),
    enabled: !!userId,
  });
  const currenciesQuery = useQuery({
    queryKey: queryKeys.currencies.all(userId),
    queryFn: () => currenciesService.list(userId),
    enabled: !!userId,
  });

  const data = useMemo(() => {
    if (!subscriptions.data || !currenciesQuery.data) return undefined;
    const subs = subscriptions.data.filter((sub) => !sub.inactive);
    const currencies = currenciesQuery.data;
    const currencyById = new Map(currencies.map((currency) => [currency.id, currency]));
    const currentMonth = new Date(`${monthKey}-01T12:00:00`);

    const mainCurrency = currencies.find((c) => c.is_main);
    const mainRate = mainCurrency?.rate ?? 1;
    const mainSymbol = mainCurrency?.symbol ?? "$";
    const mainCode = mainCurrency?.code;

    let totalMonthly = 0;
    let totalCredits = 0;
    let expenseCount = 0;
    let mostExpensive: {
      id: string;
      name: string;
      monthly: number;
      logo?: string;
      record: Subscription;
    } | null = null;

    for (const sub of subs) {
      const currency = currencyById.get(sub.currency) ?? sub.expand?.currency;
      const rate = currency?.rate ?? 1;
      const priceMain = (sub.price / rate) * mainRate;

      if (isCredit(sub)) {
        if (isDateInMonth(sub.next_payment, currentMonth)) {
          totalCredits += priceMain;
        }
        continue;
      }

      expenseCount += 1;
      const cycleName = sub.expand?.cycle?.name ?? "Monthly";
      const monthly = toMonthly(sub.price, cycleName, sub.frequency || 1);
      const monthlyMain = (monthly / rate) * mainRate;
      totalMonthly += monthlyMain;

      if (!mostExpensive || monthlyMain > mostExpensive.monthly) {
        mostExpensive = {
          id: sub.id,
          name: sub.name,
          monthly: monthlyMain,
          logo: sub.logo,
          record: sub,
        };
      }
    }

    const forecasts = upcomingMonthCosts(subscriptions.data, currencies, currentMonth);
    return {
      totalMonthly,
      nextMonthTotal: forecasts[0].cost,
      forecasts,
      totalYearly: totalMonthly * 12,
      totalWeekly: (totalMonthly * 12) / 52,
      totalDaily: (totalMonthly * 12) / 365,
      totalCredits,
      mainSymbol,
      mainCode,
      // Credits are income, not subscriptions: counting them here would
      // disagree with every total on the same card, which excludes them.
      count: expenseCount,
      mostExpensive,
    };
  }, [subscriptions.data, currenciesQuery.data, monthKey]);

  return {
    data,
    isLoading: subscriptions.isLoading || currenciesQuery.isLoading,
    isFetching: subscriptions.isFetching || currenciesQuery.isFetching,
    isError: subscriptions.isError || currenciesQuery.isError,
    error: subscriptions.error ?? currenciesQuery.error,
  };
}
