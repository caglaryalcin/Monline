import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { FinancialStatistics } from "@/components/statistics/FinancialStatistics";
import { StatisticsDistributionCard } from "@/components/statistics/StatisticsDistributionCard";
import { StatisticsPaymentsCard } from "@/components/statistics/StatisticsPaymentsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { type CategoryCostMode, categoryPeriodCosts } from "@/lib/categoryPeriodCosts";
import { historyMonth } from "@/lib/costHistory";
import { resolveLocale } from "@/lib/locale";
import { buildPaymentStatistics } from "@/lib/paymentStatistics";
import { queryKeys } from "@/lib/queryKeys";
import { formatPrice } from "@/lib/utils";
import { currenciesService } from "@/services/currencies";
import { paymentRecordsService } from "@/services/paymentRecords";
import { subscriptionsService } from "@/services/subscriptions";

export function StatisticsPage() {
  const { t, i18n } = useTranslation();
  const language = resolveLocale(i18n);
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
  // Both category views cover the selected calendar year.
  const periodLabel = `${historyMonth(categories.from, language)} — ${historyMonth(categories.to, language)}`;

  const loading = subscriptionsQuery.isPending || currenciesQuery.isPending;
  const error = subscriptionsQuery.isError || currenciesQuery.isError;

  return (
    <div className="space-y-8">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">{t("statistics_overview")}</TabsTrigger>
          <TabsTrigger value="loans">{t("spending_section_loans")}</TabsTrigger>
          <TabsTrigger value="installments">{t("spending_section_installments")}</TabsTrigger>
          <TabsTrigger value="bills">{t("spending_section_bills")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
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
        </TabsContent>
        {(["loans", "installments", "bills"] as const).map((section) => (
          <TabsContent key={section} value={section}>
            <FinancialStatistics section={section} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
