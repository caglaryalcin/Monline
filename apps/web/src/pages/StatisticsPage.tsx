import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { FinancialStatistics } from "@/components/statistics/FinancialStatistics";
import { StatisticsDistributionCard } from "@/components/statistics/StatisticsDistributionCard";
import { StatisticsPaymentsCard } from "@/components/statistics/StatisticsPaymentsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useFinanceCurrency } from "@/hooks/useFinanceCurrency";
import { useLocalToday } from "@/hooks/useLocalToday";
import { type CategoryCostMode, categoryPeriodCosts } from "@/lib/categoryPeriodCosts";
import { historyMonth } from "@/lib/costHistory";
import { buildFinancePaymentStatistics } from "@/lib/financePaymentStatistics";
import { resolveLocale } from "@/lib/locale";
import { queryKeys } from "@/lib/queryKeys";
import { formatPrice } from "@/lib/utils";
import { financeService } from "@/services/finance";
import { paymentRecordsService } from "@/services/paymentRecords";
import { subscriptionsService } from "@/services/subscriptions";

export function StatisticsPage() {
  const { t, i18n } = useTranslation();
  const language = resolveLocale(i18n);
  const [year, month, day] = useLocalToday().split("-").map(Number);
  const [categoryYear, setCategoryYear] = useState(year);
  const [paymentYear, setPaymentYear] = useState(year);
  const [categoryMode, setCategoryMode] = useState<CategoryCostMode>("paid");
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const financeCurrency = useFinanceCurrency();
  useEffect(() => {
    setCategoryYear(year);
    setPaymentYear(year);
  }, [year, month, userId]);

  const subscriptionsQuery = useQuery({
    queryKey: queryKeys.subscriptions.all(userId),
    queryFn: () => subscriptionsService.list(userId),
    enabled: !!userId,
  });

  const currenciesQuery = financeCurrency.currencies;
  const ledgerQuery = useQuery({
    queryKey: ["finance", userId],
    queryFn: financeService.get,
    enabled: !!userId,
  });

  const recordsQuery = useQuery({
    queryKey: queryKeys.paymentRecords.all(userId),
    queryFn: () => paymentRecordsService.listForUser(userId),
    enabled: !!userId,
  });

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
  const ledgerYears = [
    ...new Set(
      (ledgerQuery.data?.finance_entries ?? [])
        .map((entry) => Number(entry.date.slice(0, 4)))
        .filter((value) => Number.isInteger(value) && value >= 1970 && value <= 2200),
    ),
  ];
  const paymentYears = [
    ...new Set([...years, ...ledgerYears.filter((value) => value <= year)]),
  ].sort((left, right) => right - left);
  const payments = useMemo(() => {
    const now = new Date();
    now.setFullYear(year, month - 1, day);
    return buildFinancePaymentStatistics({
      subscriptions: subscriptionsQuery.data ?? [],
      currencies: currenciesQuery.data ?? [],
      records: recordsQuery.data ?? [],
      ledger: ledgerQuery.data,
      ledgerRate: financeCurrency.rate,
      now,
      year: paymentYear,
    });
  }, [
    subscriptionsQuery.data,
    currenciesQuery.data,
    recordsQuery.data,
    ledgerQuery.data,
    financeCurrency.rate,
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
      {
        mode: categoryMode,
        records: recordsQuery.data ?? [],
        year: categoryYear,
        upcoming:
          categoryMode === "upcoming"
            ? buildFinancePaymentStatistics({
                subscriptions: subscriptionsQuery.data ?? [],
                currencies: currenciesQuery.data ?? [],
                records: recordsQuery.data ?? [],
                ledger: ledgerQuery.data,
                ledgerRate: financeCurrency.rate,
                now,
                year: categoryYear,
              }).upcoming
            : undefined,
      },
    );
  }, [
    subscriptionsQuery.data,
    currenciesQuery.data,
    recordsQuery.data,
    categoryYear,
    categoryMode,
    ledgerQuery.data,
    financeCurrency.rate,
    t,
    year,
    month,
    day,
  ]);
  const mainCurrency = financeCurrency.main;
  const mainCode = mainCurrency?.code,
    mainSymbol = mainCurrency?.symbol ?? "$";
  // Both category views cover the selected calendar year.
  const periodLabel = `${historyMonth(categories.from, language)} - ${historyMonth(categories.to, language)}`;

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
                years={paymentYears}
                upcomingYears={ledgerYears}
                onYearChange={setPaymentYear}
                formatValue={(value) => formatPrice(value, mainSymbol, { currencyCode: mainCode })}
                isLoading={
                  loading ||
                  recordsQuery.isPending ||
                  ledgerQuery.isPending ||
                  financeCurrency.pending
                }
                hasError={
                  error || recordsQuery.isError || ledgerQuery.isError || financeCurrency.failed
                }
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
                  userId={userId}
                  data={categories.data}
                  mainCode={mainCode}
                  mainSymbol={mainSymbol}
                  title={t("cost_by_category")}
                  year={categoryYear}
                  years={
                    categoryMode === "upcoming"
                      ? [...new Set([...paymentYears, year + 1, ...ledgerYears])].sort(
                          (left, right) => right - left,
                        )
                      : years
                  }
                  onYearChange={setCategoryYear}
                  periodLabel={periodLabel}
                  mode={categoryMode}
                  onModeChange={(mode) => {
                    setCategoryMode(mode);
                    if (mode === "paid" && categoryYear > year) setCategoryYear(year);
                  }}
                  sourceNote={
                    categoryMode === "upcoming" ? t("statistics_ledger_category_note") : undefined
                  }
                  paymentCount={categories.paymentCount}
                  unpricedCount={categories.unpricedCount}
                  categoryDetails={categories.categoryDetails}
                  uncategorizedCount={categories.uncategorizedCount}
                  isLoading={
                    recordsQuery.isPending ||
                    (categoryMode === "upcoming" &&
                      (ledgerQuery.isPending || financeCurrency.pending))
                  }
                  hasError={
                    recordsQuery.isError ||
                    (categoryMode === "upcoming" && (ledgerQuery.isError || financeCurrency.failed))
                  }
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
