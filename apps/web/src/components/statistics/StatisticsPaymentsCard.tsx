import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { STATISTICS_COLORS } from "@/components/statistics/constants";
import { StatisticsPaymentDates } from "@/components/statistics/StatisticsPaymentDates";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemedSelect } from "@/components/ui/themed-select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocalToday } from "@/hooks/useLocalToday";
import { categoryLabel } from "@/lib/categoryLabel";
import { historyMonth } from "@/lib/costHistory";
import {
  statisticsPaymentItems,
  type StatisticsPaymentsData,
} from "@/lib/financePaymentStatistics";
import { resolveLocale } from "@/lib/locale";
import { cn, formatDate } from "@/lib/utils";

interface StatisticsPaymentsCardProps {
  data: StatisticsPaymentsData;
  formatValue: (value: number) => string;
  isLoading?: boolean;
  hasError?: boolean;
  year?: number;
  years?: number[];
  upcomingYears?: number[];
  onYearChange?: (year: number) => void;
}

export function StatisticsPaymentsCard({
  data,
  formatValue,
  isLoading,
  hasError,
  year,
  years,
  upcomingYears,
  onYearChange,
}: StatisticsPaymentsCardProps) {
  const { t, i18n } = useTranslation();
  const currentPeriod = useLocalToday().slice(0, 7);
  const currentYear = Number(currentPeriod.slice(0, 4));
  const language = resolveLocale(i18n);
  const [mode, setMode] = useState<"paid" | "upcoming" | "income">(
    year && year > currentYear ? "upcoming" : "paid",
  );
  const availableYears =
    mode !== "paid"
      ? [
          ...new Set([
            currentYear + 1,
            ...(years ?? [year ?? currentYear]),
            ...(upcomingYears ?? []),
          ]),
        ].sort((left, right) => right - left)
      : (years ?? [year ?? currentYear]);
  const [selected, setSelected] = useState<Record<"paid" | "upcoming" | "income", string | null>>({
    paid: null,
    upcoming: null,
    income: null,
  });
  useEffect(() => {
    setSelected({ paid: null, upcoming: null, income: null });
  }, [year, currentPeriod]);
  const months = data[mode] ?? [];
  const includesLedger = data.income !== undefined;
  const labels = {
    paid: {
      button: "budget_paid",
      sentence: "payments_month_sentence",
      empty: "payments_month_empty",
      none: "payments_no_record",
      note: "payments_paid_note",
    },
    upcoming: {
      button: "payments_upcoming",
      none: "payments_upcoming_none",
      sentence: includesLedger
        ? "statistics_ledger_upcoming_sentence"
        : "payments_upcoming_sentence",
      empty: includesLedger ? "statistics_ledger_upcoming_empty" : "payments_upcoming_empty",
      note: includesLedger ? "statistics_ledger_upcoming_note" : "payments_upcoming_note",
    },
    income: {
      button: "statistics_expected_income",
      sentence: "statistics_income_sentence",
      empty: "statistics_income_empty",
      none: "statistics_income_none",
      note: "statistics_income_note",
    },
  }[mode];
  const modes = includesLedger
    ? (["paid", "upcoming", "income"] as const)
    : (["paid", "upcoming"] as const);
  const columns = Math.max(1, Math.min(months.length, 6));
  const current =
    months.find((month) => month.name === selected[mode]) ??
    months.find(
      (month) => month.name === `${year ?? currentPeriod.slice(0, 4)}/${currentPeriod.slice(5)}`,
    ) ??
    months[0];
  const currentItems = current ? statisticsPaymentItems(current) : [];
  const ids = [
    ...new Set(
      [...data.paid, ...data.upcoming, ...(data.income ?? [])].flatMap((month) =>
        statisticsPaymentItems(month).map((item) => item.id),
      ),
    ),
  ].sort();
  const color = (id: string) => STATISTICS_COLORS[ids.indexOf(id) % STATISTICS_COLORS.length];
  return (
    <Card className="overflow-hidden rounded-3xl border shadow-sm">
      <CardHeader className="gap-4 border-b bg-muted/20 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">
            {t(includesLedger ? "statistics_monthly_payments_income" : "payments_by_month")}
          </CardTitle>
          {year && onYearChange && (
            <ThemedSelect
              aria-label={t("history_select_year")}
              value={year}
              onChange={(event) => onYearChange(Number(event.target.value) as number)}
              className="h-10 rounded-xl px-3 text-sm"
            >
              {availableYears.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </ThemedSelect>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div
            className="inline-flex rounded-xl border bg-background p-1"
            role="group"
            aria-label={t("payments_view")}
          >
            {modes.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  if (value === "paid" && year && year > currentYear) onYearChange?.(currentYear);
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {t(
                  value === "paid"
                    ? "budget_paid"
                    : value === "income"
                      ? "statistics_expected_income"
                      : "payments_upcoming",
                )}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {isLoading ? (
          <div
            role="status"
            aria-label={t("loading")}
            className="h-64 animate-pulse rounded-2xl bg-muted"
          />
        ) : hasError ? (
          <p role="alert" className="text-sm text-destructive">
            {t("payments_load_error")}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto pb-2">
              <ol
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  minWidth: columns * 130,
                }}
                aria-label={t("payments_by_month")}
              >
                {months.map((month) => {
                  const items = statisticsPaymentItems(month);
                  const positiveTotal = items.reduce(
                    (sum, item) => sum + Math.max(0, item.amount),
                    0,
                  );
                  return (
                    <li key={month.name}>
                      <button
                        type="button"
                        aria-pressed={current?.name === month.name}
                        onClick={() =>
                          setSelected((currentSelection) => ({
                            ...currentSelection,
                            [mode]: month.name,
                          }))
                        }
                        className={cn(
                          "flex min-h-[140px] w-full flex-col items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2",
                          current?.name === month.name
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-transparent",
                        )}
                      >
                        <span className="text-xs font-medium">
                          {historyMonth(month.name, language)}
                        </span>
                        <span className="text-base font-bold tabular-nums sm:text-lg">
                          {month.count
                            ? formatValue(month.total)
                            : t(month.unpricedCount ? "payments_incomplete" : labels.none)}
                        </span>
                        <TooltipProvider delayDuration={100}>
                          <span className="flex h-2 w-full rounded-full bg-muted">
                            {items
                              .filter((item) => item.amount > 0)
                              .map((item) => {
                                const category = item.subscription?.expand?.category;
                                const label = item.row
                                  ? t("finance_workspace_ledger")
                                  : category
                                    ? categoryLabel(category, t)
                                    : t("statistics_category_uncategorized");
                                return (
                                  <Tooltip key={item.id}>
                                    <TooltipTrigger asChild>
                                      <span
                                        tabIndex={0}
                                        role="img"
                                        aria-label={`${item.name} · ${label} · ${formatValue(item.amount)}`}
                                        style={{
                                          width: `${positiveTotal > 0 ? (item.amount / positiveTotal) * 100 : 0}%`,
                                          backgroundColor: color(item.id),
                                        }}
                                        className="relative block h-full shrink-0 first:rounded-l-full last:rounded-r-full transition-[transform,border-radius,box-shadow] duration-200 ease-out hover:z-10 hover:scale-y-[1.75] hover:rounded-sm hover:shadow-sm focus-visible:z-10 focus-visible:scale-y-[1.75] focus-visible:rounded-sm focus-visible:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
                                      />
                                    </TooltipTrigger>
                                    <TooltipPortal>
                                      <TooltipContent
                                        side="top"
                                        sideOffset={10}
                                        className="max-w-64"
                                      >
                                        <span className="block font-semibold">{item.name}</span>
                                        <span className="block text-xs text-muted-foreground">
                                          {label}
                                        </span>
                                        <span className="block mt-1 font-semibold tabular-nums">
                                          {formatValue(item.amount)}
                                        </span>
                                      </TooltipContent>
                                    </TooltipPortal>
                                  </Tooltip>
                                );
                              })}
                          </span>
                        </TooltipProvider>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
            {current && (
              <section
                className="space-y-4 rounded-2xl border bg-muted/15 p-4"
                aria-label={historyMonth(current.name, language, true)}
              >
                <p className="text-sm leading-relaxed font-medium">
                  {current.count
                    ? t(labels.sentence, {
                        month: historyMonth(current.name, language, true),
                        count: currentItems.length,
                        amount: formatValue(current.total),
                      })
                    : t(current.unpricedCount ? "payments_month_unpriced" : labels.empty, {
                        month: historyMonth(current.name, language, true),
                      })}
                </p>
                {current.unpricedCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("payments_missing_amount", { count: current.unpricedCount })}
                  </p>
                )}
                {currentItems.length > 0 && (
                  <ul
                    className="monline-scroll grid max-h-72 grid-cols-1 gap-y-1 overflow-y-auto"
                    aria-label={t(
                      includesLedger && mode !== "paid"
                        ? "statistics_payment_items"
                        : "subscriptions",
                    )}
                  >
                    {currentItems.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 rounded-xl py-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color(item.id) }}
                          aria-hidden="true"
                        />
                        {item.subscription && (
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border bg-background">
                            <SubscriptionLogo sub={item.subscription} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.row && <span>{t("finance_workspace_ledger")} · </span>}
                            {mode !== "paid" && item.nextDate && !item.dates?.length && (
                              <span>
                                {t("next_payment")}: {formatDate(item.nextDate, language)} ·{" "}
                              </span>
                            )}
                            {t(item.row ? "statistics_entry_count" : "payments_count", {
                              count: item.count,
                            })}
                          </p>
                          <StatisticsPaymentDates
                            dates={item.dates}
                            language={language}
                            upcoming={mode !== "paid"}
                            label={mode === "income" ? t("statistics_planned_dates") : undefined}
                          />
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatValue(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">{t(labels.note)}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
