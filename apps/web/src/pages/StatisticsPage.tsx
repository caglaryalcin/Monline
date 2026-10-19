import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { StatisticsDistributionCard } from "@/components/statistics/StatisticsDistributionCard";
import { StatisticsPaymentsCard } from "@/components/statistics/StatisticsPaymentsCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { type CategoryCostMode, categoryPeriodCosts } from "@/lib/categoryPeriodCosts";
import { historyMonth } from "@/lib/costHistory";
import { buildPaymentStatistics } from "@/lib/paymentStatistics";
import { queryKeys } from "@/lib/queryKeys";
import { formatPrice } from "@/lib/utils";
import { currenciesService } from "@/services/currencies";
import { paymentRecordsService } from "@/services/paymentRecords";
import { subscriptionsService } from "@/services/subscriptions";

export function StatisticsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n?.resolvedLanguage ?? i18n?.language ?? "en";
  const [year, month, day] = useLocalToday().split("-").map(Number);
  const [categoryYear, setCategoryYear] = useState(year);
  const [paymentYear, setPaymentYear] = useState(year);
  const [categoryMode, setCategoryMode] = useState<CategoryCostMode>("paid");
  useEffect(() => {
    setCategoryYear(year);
    setPaymentYear(year);
  }, [year]);
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const subscriptionsQuery = useQuery({
    queryKey: queryKeys.subscriptions.all(userId),
    queryFn: () => subscriptionsService.list(userId),
    enabled: !!userId,
  });

  const currenciesQuery = useQuery({
    queryKey: queryKeys.currencies.all(userId),
    queryFn: () => currenciesService.list(userId),
    enabled: !!userId,
  });

  const recordsQuery = useQuery({
    queryKey: queryKeys.paymentRecords.all(userId),
    queryFn: () => paymentRecordsService.listForUser(userId),
    enabled: !!userId,
  });

  const currencies = currenciesQuery.data ?? [];
  const years = [
    ...new Set([
      year,
      ...(recordsQuery.data ?? []).flatMap((record) => {
        const paidYear = record.paid_at
          ? new Date(record.paid_at.replace(" ", "T")).getFullYear()
          : NaN;
        return Number.isInteger(paidYear) && paidYear <= year ? [paidYear] : [];
      }),
    ]),
  ].sort((left, right) => right - left);
  const payments = useMemo(() => {
    const now = new Date();
    now.setFullYear(year, month - 1, day);
    return buildPaymentStatistics(
      subscriptionsQuery.data ?? [],
      currenciesQuery.data ?? [],
      recordsQuery.data ?? [],
      now,
      12,
      12,
      paymentYear,
    );
  }, [
    subscriptionsQuery.data,
    currenciesQuery.data,
    recordsQuery.data,
    year,
    month,
    day,
    paymentYear,
  ]);
  const categories = useMemo(() => {
    const now = new Date();
    now.setFullYear(year, month - 1, day);
    return categoryPeriodCosts(
      subscriptionsQuery.data ?? [],
      currenciesQuery.data ?? [],
      12,
      t,
      now,
      { mode: categoryMode, records: recordsQuery.data ?? [], year: categoryYear },
    );
  }, [
    subscriptionsQuery.data,
    currenciesQuery.data,
    recordsQuery.data,
    categoryYear,
    categoryMode,
    t,
    year,
    month,
    day,
  ]);
  const mainCurrency = currencies.find((currency) => currency.is_main);
  const mainCode = mainCurrency?.code,
    mainSymbol = mainCurrency?.symbol ?? "$";
  const periodLabel =
    categories.from === categories.to
      ? historyMonth(categories.to, language, true)
      : `${historyMonth(categories.from, language)} — ${historyMonth(categories.to, language)}`;

  const loading = subscriptionsQuery.isPending || currenciesQuery.isPending;
  const error = subscriptionsQuery.isError || currenciesQuery.isError;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-6">
        <div>
          <StatisticsPaymentsCard
            data={payments}
            year={paymentYear}
            years={years}
            onYearChange={setPaymentYear}
            formatValue={(value) => formatPrice(value, mainSymbol, { currencyCode: mainCode })}
            isLoading={loading || recordsQuery.isPending}
            hasError={error || recordsQuery.isError}
          />
        </div>
        <div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {t("payments_load_error")}
            </p>
          ) : loading ? (
            <div
              role="status"
              aria-label={t("loading")}
              className="h-96 animate-pulse rounded-3xl bg-muted"
            />
          ) : (
            <StatisticsDistributionCard
              data={categories.data}
              mainCode={mainCode}
              mainSymbol={mainSymbol}
              title={t("cost_by_category")}
              year={categoryYear}
              years={years}
              onYearChange={setCategoryYear}
              periodLabel={periodLabel}
              mode={categoryMode}
              onModeChange={setCategoryMode}
              paymentCount={categories.paymentCount}
              unpricedCount={categories.unpricedCount}
              categoryDetails={categories.categoryDetails}
              uncategorizedCount={categories.uncategorizedCount}
              isLoading={recordsQuery.isPending}
              hasError={recordsQuery.isError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
