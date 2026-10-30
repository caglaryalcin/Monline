import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Globe, Landmark, Lightbulb, TrendingUp } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { YearHistoryCard } from "@/components/dashboard/YearHistoryCard";
import { Button } from "@/components/ui/button";
import { ThemedSelect } from "@/components/ui/themed-select";
import client from "@/lib/client";
import {
  dashboardPaymentHistory,
  type DashboardPaymentSection,
  type DashboardStatement,
  dashboardYearPayments,
  dashboardYearSalary,
} from "@/lib/dashboardYear";
import { type FinanceData, percentChange } from "@/lib/finance";
import { resolveLocale } from "@/lib/locale";
import { queryKeys } from "@/lib/queryKeys";
import { EMPTY_SPENDING, spendingKey } from "@/lib/spending";
import { cn, formatCurrency, getCurrencySymbol } from "@/lib/utils";
import { currenciesService } from "@/services/currencies";
import { financeService } from "@/services/finance";
import { paymentRecordsService } from "@/services/paymentRecords";
import { spendingService } from "@/services/spending";
import { subscriptionsService } from "@/services/subscriptions";

const EMPTY_FINANCE: FinanceData = {
  finance_rows: [],
  finance_entries: [],
  salary_history: [],
  finance_benchmarks: [],
};
const PAYMENT_GRAPH_COLORS: Record<DashboardPaymentSection, string> = {
  online: "hsl(var(--primary))",
  cards: "hsl(var(--primary))",
  bills: "hsl(var(--primary))",
  loans: "hsl(var(--primary))",
};
const paymentSectionKey = (userId: string) => `monline-dashboard-payment-section:${userId}`;
function savedPaymentSection(userId: string): DashboardPaymentSection {
  try {
    const saved = localStorage.getItem(paymentSectionKey(userId));
    if (saved && Object.prototype.hasOwnProperty.call(PAYMENT_GRAPH_COLORS, saved))
      return saved as DashboardPaymentSection;
  } catch {
    /* Keep the chart usable when browser storage is unavailable. */
  }
  return "cards";
}

export function DashboardYearOverview({
  userId,
  today,
  sidebar,
}: {
  userId: string;
  today: string;
  sidebar?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n, "tr");
  const year = Number(today.slice(0, 4));
  const queryClient = useQueryClient();
  const [section, setSection] = useState<DashboardPaymentSection>(() =>
    savedPaymentSection(userId),
  );
  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(paymentSectionKey(userId), section);
    } catch {
      /* The selection still works for this page visit. */
    }
  }, [userId, section]);
  const [chosenCurrency, setChosenCurrency] = useState("TRY");
  const [historyYear, setHistoryYear] = useState(year);
  const options = { enabled: !!userId };
  const finance = useQuery({
    queryKey: ["finance", userId],
    queryFn: financeService.get,
    ...options,
  });
  const spending = useQuery({
    queryKey: spendingKey(userId),
    queryFn: spendingService.get,
    ...options,
  });
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
  const statements = useQuery({
    queryKey: ["bank-statements", userId, "dashboard-minimums"],
    queryFn: () =>
      client
        .collection("bank_statements")
        .getFullList<DashboardStatement>({ fields: "id,period,summary", sort: "-period,-created" }),
    ...options,
  });
  const payments = useMemo(
    () =>
      dashboardYearPayments({
        finance: finance.data ?? EMPTY_FINANCE,
        spending: spending.data ?? EMPTY_SPENDING,
        subscriptions: subscriptions.data ?? [],
        currencies: currencies.data ?? [],
        records: records.data ?? [],
        statements: statements.data ?? [],
        today,
      }),
    [
      finance.data,
      spending.data,
      subscriptions.data,
      currencies.data,
      records.data,
      statements.data,
      today,
    ],
  );
  const historyPayments = useMemo(
    () =>
      historyYear === year
        ? payments
        : dashboardYearPayments({
            finance: finance.data ?? EMPTY_FINANCE,
            spending: spending.data ?? EMPTY_SPENDING,
            subscriptions: subscriptions.data ?? [],
            currencies: currencies.data ?? [],
            records: records.data ?? [],
            today,
            year: historyYear,
          }),
    [
      payments,
      finance.data,
      spending.data,
      subscriptions.data,
      currencies.data,
      records.data,
      today,
      year,
      historyYear,
    ],
  );
  const historyYears = [
    ...new Set([
      year,
      ...(finance.data?.finance_entries ?? []).map((entry) => Number(entry.date.slice(0, 4))),
      ...(spending.data?.events ?? []).map((event) => Number(event.date.slice(0, 4))),
      ...(records.data ?? []).map((record) => Number(record.due_date.slice(0, 4))),
    ]),
  ]
    .filter((value) => Number.isInteger(value) && value >= 1900 && value <= year)
    .sort((a, b) => b - a);
  const salary = useMemo(
    () => dashboardYearSalary(finance.data ?? EMPTY_FINANCE, today),
    [finance.data, today],
  );
  const previousDecember = `${year - 1}-12`;
  const currentMonth = today.slice(0, 7);
  const wageMonths = [previousDecember, currentMonth];
  const missingWageMonths = wageMonths.filter(
    (month) =>
      !finance.data?.finance_benchmarks.some(
        (item) => item.month === month && item.minimum_wage > 0,
      ),
  );
  const wages = useQuery({
    queryKey: ["dashboard-minimum-wage", userId, previousDecember, currentMonth],
    enabled: !!userId && finance.isSuccess && missingWageMonths.length > 0,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const results = await Promise.allSettled(
        missingWageMonths.map((month) => financeService.rates(month)),
      );
      const saved = results.flatMap((result) =>
        result.status === "fulfilled" && result.value.minimum_wage > 0 ? [result.value] : [],
      );
      if (saved.length) await queryClient.invalidateQueries({ queryKey: ["finance", userId] });
      return saved;
    },
  });
  const minimumWage = (month: string) =>
    finance.data?.finance_benchmarks.find((item) => item.month === month && item.minimum_wage > 0)
      ?.minimum_wage ??
    wages.data?.find((item) => item.month === month)?.minimum_wage ??
    null;
  const previousWage = minimumWage(previousDecember);
  const currentWage = minimumWage(currentMonth);
  const minimumWageChange = percentChange(currentWage, previousWage);

  const money = (amount: number, currency = "TRY") =>
    formatCurrency(amount, currency, {
      locale,
      minimumFractionDigits: Math.round(amount * 100) % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  const monthName = (month: string) =>
    new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${month}-01T12:00:00Z`),
    );
  const formatTotals = (key: DashboardPaymentSection) =>
    payments[key].totals.length
      ? payments[key].totals.map((total) => money(total.amount, total.currency)).join(" · ")
      : payments[key].unpriced
        ? "—"
        : money(0);
  const onlineLoading = subscriptions.isPending || currencies.isPending || records.isPending;
  const onlineError = subscriptions.isError || currencies.isError || records.isError;
  const anyError = spending.isError || onlineError || finance.isError || statements.isError;
  const sourceError =
    section === "online"
      ? onlineError
      : finance.isError ||
        (section === "bills" && spending.isError) ||
        (section === "cards" && statements.isError);
  const sourceLoading =
    section === "online"
      ? onlineLoading
      : finance.isPending ||
        (section === "bills" && spending.isPending) ||
        (section === "cards" && statements.isPending);
  const historyCurrencies = [
    ...new Set(
      [...historyPayments[section].items, ...historyPayments[section].upcoming].map(
        (item) => item.currency,
      ),
    ),
  ].sort();
  const currency = historyCurrencies.includes(chosenCurrency)
    ? chosenCurrency
    : historyCurrencies[0] || "TRY";
  const history = dashboardPaymentHistory(historyPayments[section], historyYear, currency, today);
  const minimumWageText = wages.isFetching
    ? "…"
    : minimumWageChange == null
      ? t("finance_salary_no_comparison_data")
      : new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 1,
          signDisplay: "exceptZero",
        }).format(minimumWageChange / 100);
  const minimumWageTitle =
    previousWage != null && currentWage != null
      ? `${monthName(previousDecember)} ${money(previousWage)} → ${monthName(currentMonth)} ${money(currentWage)}`
      : t("dashboard_year_minimum_wage_missing");
  const missingAmounts = Object.values(payments).reduce((sum, group) => sum + group.unpriced, 0);

  return (
    <section className="space-y-6" aria-label={t("dashboard_year_overview", { year })}>
      <div className={cn("grid items-start gap-6", sidebar && "xl:grid-cols-12")}>
        <div className={cn("min-w-0 space-y-6", sidebar && "xl:col-span-8")}>
          {anyError && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm"
            >
              <p className="text-destructive">{t("dashboard_year_load_error")}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void Promise.all([
                    finance.refetch(),
                    spending.refetch(),
                    subscriptions.refetch(),
                    currencies.refetch(),
                    records.refetch(),
                    statements.refetch(),
                  ])
                }
              >
                {t("finance_retry")}
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <SummaryCard
              title={t("dashboard_year_cards_paid")}
              year={year}
              value={finance.isError ? "—" : formatTotals("cards")}
              icon={<CreditCard className="h-6 w-6" />}
              loading={finance.isPending}
              accent="var(--chart-2)"
            />
            <SummaryCard
              title={t("dashboard_year_online_paid")}
              year={year}
              value={onlineError ? "—" : formatTotals("online")}
              icon={<Globe className="h-6 w-6" />}
              loading={onlineLoading}
              accent="var(--chart-3)"
            />
            <SummaryCard
              title={t("dashboard_year_loans_paid")}
              year={year}
              value={finance.isError ? "—" : formatTotals("loans")}
              icon={<Landmark className="h-6 w-6" />}
              loading={finance.isPending}
              accent="var(--chart-2)"
            />
            <SummaryCard
              title={t("dashboard_year_raise")}
              year={year}
              value={
                finance.isError || salary.change == null
                  ? "—"
                  : new Intl.NumberFormat(locale, {
                      style: "percent",
                      maximumFractionDigits: 1,
                      signDisplay: "exceptZero",
                    }).format(salary.change / 100)
              }
              icon={<TrendingUp className="h-6 w-6" />}
              loading={finance.isPending}
              accent="var(--chart-1)"
              comparison={
                finance.isError
                  ? undefined
                  : {
                      value: minimumWageText,
                      label: t("dashboard_year_minimum_wage_label"),
                      title: minimumWageTitle,
                    }
              }
              valueLabel={t("finance_salary")}
            />
          </div>
          {missingAmounts > 0 && (
            <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
              {t("dashboard_year_unpriced", { count: missingAmounts })}
            </p>
          )}
          <YearHistoryCard
            title={t("dashboard_year_payment_history")}
            year={historyYear}
            data={history}
            color={PAYMENT_GRAPH_COLORS[section]}
            forecastColor="hsl(var(--muted-foreground))"
            currencySymbol={getCurrencySymbol(currency, locale)}
            yearControl={
              <ThemedSelect
                aria-label={t("history_select_year")}
                value={historyYear}
                onChange={(event) => setHistoryYear(Number(event.target.value))}
                className="h-9 rounded-xl px-3 text-xs"
              >
                {historyYears.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </ThemedSelect>
            }
            formatValue={(amount) => money(amount, currency)}
            isLoading={sourceLoading}
            hasError={sourceError}
            emptyText={t("dashboard_year_payments_empty")}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="flex flex-wrap gap-1 rounded-xl bg-muted p-1"
                role="group"
                aria-label={t("dashboard_year_payment_history")}
              >
                {(["online", "cards", "bills", "loans"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={section === key}
                    onClick={() => setSection(key)}
                    className={cn(
                      "rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      section === key
                        ? "border-primary/60 bg-background text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(`dashboard_year_section_${key}`)}
                  </button>
                ))}
              </div>
              {historyCurrencies.length > 1 && (
                <ThemedSelect
                  aria-label={t("finance_stats_currency")}
                  value={currency}
                  onChange={(event) => setChosenCurrency(event.target.value)}
                  className="h-9 rounded-xl px-3 text-xs"
                >
                  {historyCurrencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </ThemedSelect>
              )}
            </div>
          </YearHistoryCard>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            {t("dashboard_year_overlap_note")}
          </p>
        </div>
        {sidebar && <div className="min-w-0 xl:col-span-4">{sidebar}</div>}
      </div>
    </section>
  );
}
