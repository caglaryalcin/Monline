import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { STATISTICS_COLORS } from "@/components/statistics/constants";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemedSelect } from "@/components/ui/themed-select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { categoryLabel } from "@/lib/categoryLabel";
import { historyMonth } from "@/lib/costHistory";
import type { MonthlyPaymentTotal } from "@/lib/paymentStatistics";
import { cn, formatDate } from "@/lib/utils";

interface StatisticsPaymentsCardProps {
  data: { paid: MonthlyPaymentTotal[]; upcoming: MonthlyPaymentTotal[] };
  formatValue: (value: number) => string;
  isLoading?: boolean;
  hasError?: boolean;
  year?: number;
  years?: number[];
  onYearChange?: (year: number) => void;
}

export function StatisticsPaymentsCard({
  data,
  formatValue,
  isLoading,
  hasError,
  year,
  years,
  onYearChange,
}: StatisticsPaymentsCardProps) {
  const { t, i18n } = useTranslation();
  const language = i18n?.resolvedLanguage ?? i18n?.language ?? "en";
  const [mode, setMode] = useState<"paid" | "upcoming">("paid");
  const [selected, setSelected] = useState<{ paid: string | null; upcoming: string | null }>({
    paid: null,
    upcoming: null,
  });
  const months = data[mode];
  const columns = Math.max(1, Math.min(months.length, 6));
  const current =
    months.find((month) => month.name === selected[mode]) ??
    (mode === "paid"
      ? (months.find(
          (month) =>
            month.name ===
            `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}`,
        ) ?? months.at(-1))
      : (months.find((month) => month.count > 0) ?? months[0]));
  const ids = [
    ...new Set(
      [...data.paid, ...data.upcoming].flatMap((month) =>
        month.subscriptions.map((item) => item.subscription.id),
      ),
    ),
  ].sort();
  const color = (id: string) => STATISTICS_COLORS[ids.indexOf(id) % STATISTICS_COLORS.length];
  return (
    <Card className="overflow-hidden rounded-3xl border shadow-sm">
      <CardHeader className="gap-4 border-b bg-muted/20 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{t("payments_by_month")}</CardTitle>
          {year && onYearChange && (
            <ThemedSelect
              aria-label={t("history_select_year")}
              value={year}
              onChange={(event) => onYearChange(Number(event.target.value) as number)}
              className="h-10 rounded-xl px-3 text-sm"
            >
              {(years ?? [year]).map((value) => (
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
            {(["paid", "upcoming"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {t(value === "paid" ? "budget_paid" : "payments_upcoming")}
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
                {months.map((month) => (
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
                          : t(
                              month.unpricedCount
                                ? "payments_incomplete"
                                : mode === "paid"
                                  ? "payments_no_record"
                                  : "payments_upcoming_none",
                            )}
                      </span>
                      <TooltipProvider delayDuration={100}>
                        <span className="flex h-2 w-full rounded-full bg-muted">
                          {month.subscriptions
                            .filter((item) => item.amount > 0)
                            .map((item) => {
                              const category = item.subscription.expand?.category;
                              const label = category
                                ? categoryLabel(category, t)
                                : t("statistics_category_uncategorized");
                              return (
                                <Tooltip key={item.subscription.id}>
                                  <TooltipTrigger asChild>
                                    <span
                                      tabIndex={0}
                                      role="img"
                                      aria-label={`${item.subscription.name} · ${label} · ${formatValue(item.amount)}`}
                                      style={{
                                        width: `${month.total > 0 ? (item.amount / month.total) * 100 : 0}%`,
                                        backgroundColor: color(item.subscription.id),
                                      }}
                                      className="relative block h-full shrink-0 first:rounded-l-full last:rounded-r-full transition-[transform,border-radius,box-shadow] duration-200 ease-out hover:z-10 hover:scale-y-[1.75] hover:rounded-sm hover:shadow-sm focus-visible:z-10 focus-visible:scale-y-[1.75] focus-visible:rounded-sm focus-visible:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
                                    />
                                  </TooltipTrigger>
                                  <TooltipPortal>
                                    <TooltipContent side="top" sideOffset={10} className="max-w-64">
                                      <span className="block font-semibold">
                                        {item.subscription.name}
                                      </span>
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
                ))}
              </ol>
            </div>
            {current && (
              <section
                className="space-y-4 rounded-2xl border bg-muted/15 p-4"
                aria-label={historyMonth(current.name, language, true)}
              >
                <p className="text-sm leading-relaxed font-medium">
                  {current.count
                    ? t(
                        mode === "paid" ? "payments_month_sentence" : "payments_upcoming_sentence",
                        {
                          month: historyMonth(current.name, language, true),
                          count: current.subscriptions.length,
                          amount: formatValue(current.total),
                        },
                      )
                    : t(
                        current.unpricedCount
                          ? "payments_month_unpriced"
                          : mode === "paid"
                            ? "payments_month_empty"
                            : "payments_upcoming_empty",
                        {
                          month: historyMonth(current.name, language, true),
                        },
                      )}
                </p>
                {current.unpricedCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("payments_missing_amount", { count: current.unpricedCount })}
                  </p>
                )}
                {current.subscriptions.length > 0 && (
                  <ul
                    className="monline-scroll grid max-h-72 grid-cols-1 gap-y-1 overflow-y-auto"
                    aria-label={t("subscriptions")}
                  >
                    {current.subscriptions.map((item) => (
                      <li
                        key={item.subscription.id}
                        className="flex items-center gap-3 rounded-xl py-2"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color(item.subscription.id) }}
                          aria-hidden="true"
                        />
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border bg-background">
                          <SubscriptionLogo sub={item.subscription} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.subscription.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {mode === "upcoming" && item.nextDate && (
                              <span>
                                {t("next_payment")}: {formatDate(item.nextDate, language)} ·{" "}
                              </span>
                            )}
                            {t("payments_count", { count: item.count })}
                          </p>
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
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(mode === "paid" ? "payments_paid_note" : "payments_upcoming_note")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
