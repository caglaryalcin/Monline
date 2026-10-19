import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Label, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { STATISTICS_CATEGORY_COLORS } from "@/components/statistics/constants";
import type {
  StatisticsCategoryDetails,
  StatisticsPieDatum,
} from "@/components/statistics/statistics.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemedSelect } from "@/components/ui/themed-select";
import type { CategoryCostMode } from "@/lib/categoryPeriodCosts";
import { cn, formatPrice } from "@/lib/utils";

interface StatisticsDistributionCardProps {
  data: StatisticsPieDatum[];
  mainCode?: string;
  mainSymbol: string;
  title: string;
  year?: number;
  years?: number[];
  onYearChange?: (value: number) => void;
  periodLabel?: string;
  mode?: CategoryCostMode;
  onModeChange?: (mode: CategoryCostMode) => void;
  paymentCount?: number;
  unpricedCount?: number;
  uncategorizedCount?: number;
  categoryDetails?: StatisticsCategoryDetails;
  isLoading?: boolean;
  hasError?: boolean;
}

export function StatisticsDistributionCard({
  data,
  mainCode,
  mainSymbol,
  title,
  year,
  years,
  onYearChange,
  periodLabel,
  mode,
  onModeChange,
  paymentCount,
  unpricedCount = 0,
  uncategorizedCount = 0,
  categoryDetails,
  isLoading,
  hasError,
}: StatisticsDistributionCardProps) {
  const { t, i18n } = useTranslation();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set());
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const language = (i18n?.resolvedLanguage ?? i18n?.language ?? "en").replace("_", "-");
  const percent = (value: number) =>
    new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 1 }).format(value);
  const chartData = data.map((item) => ({ ...item, share: total > 0 ? item.value / total : 0 }));
  const formattedTotal = formatPrice(total, mainSymbol, { currencyCode: mainCode });
  // Reset Recharts' cached sectors and active tooltip when the displayed dataset changes.
  const chartKey = JSON.stringify([
    year,
    mode,
    language,
    chartData.map(({ name, value }) => [name, value]),
  ]);

  return (
    <Card className="monline-distribution overflow-hidden rounded-3xl border bg-card/40 shadow-sm backdrop-blur-md">
      <CardHeader className="border-b bg-muted/30 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">{title}</CardTitle>
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
        {mode && onModeChange && (
          <div
            role="group"
            aria-label={t("statistics_category_source")}
            className="inline-flex w-fit rounded-xl border bg-background p-1"
          >
            {(["paid", "upcoming"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => onModeChange(value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold",
                  mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {t(
                  value === "upcoming"
                    ? "statistics_categories_upcoming"
                    : "statistics_categories_paid",
                )}
              </button>
            ))}
          </div>
        )}
        {periodLabel && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
            {!isLoading && !hasError && (
              <p className="text-sm text-muted-foreground">
                {t(
                  mode === "paid"
                    ? "statistics_categories_paid"
                    : mode === "upcoming"
                      ? "statistics_categories_upcoming"
                      : "statistics_period_total",
                )}
                :{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatPrice(total, mainSymbol, { currencyCode: mainCode })}
                </span>
                {paymentCount !== undefined && (
                  <span className="ml-2 text-xs">
                    · {t("payments_count", { count: paymentCount })}
                  </span>
                )}
              </p>
            )}
          </div>
        )}
        {year && mode === "paid" && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("statistics_category_paid_note")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {!isLoading && !hasError && uncategorizedCount > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p>{t("statistics_category_unassigned_note", { count: uncategorizedCount })}</p>
            <Link
              to="/subscriptions"
              className="mt-1 inline-block font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {t("statistics_category_assign")}
            </Link>
          </div>
        )}
        {isLoading ? (
          <div
            role="status"
            aria-label={t("loading")}
            className="h-[300px] animate-pulse rounded-2xl bg-muted"
          />
        ) : hasError ? (
          <p role="alert" className="py-8 text-sm text-destructive">
            {t("payments_load_error")}
          </p>
        ) : (
          <>
            {total > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart key={chartKey} data={chartData}>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    isAnimationActive={false}
                    label={({ name, payload, percent: share }) =>
                      `${name} (${percent(payload?.share ?? share)})`
                    }
                    labelLine={false}
                  >
                    <Label
                      position="center"
                      dy={-12}
                      value={year ?? t("statistics_period_total")}
                      className="fill-muted-foreground text-[10px]"
                    />
                    <Label
                      position="center"
                      dy={10}
                      value={formattedTotal}
                      className="fill-foreground font-semibold tabular-nums"
                      fontSize={formattedTotal.length > 14 ? 9 : 12}
                    />
                    {chartData.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={STATISTICS_CATEGORY_COLORS[index % STATISTICS_CATEGORY_COLORS.length]}
                        className="stroke-background stroke-[2px]"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                    }}
                    itemStyle={{
                      color: "hsl(var(--foreground))",
                      fontWeight: "bold",
                    }}
                    formatter={(value: number) =>
                      formatPrice(value, mainSymbol, { currencyCode: mainCode })
                    }
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }}
                    formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center">
                <p className="rounded-full bg-muted/50 px-4 py-2 text-center text-sm text-muted-foreground">
                  {t(
                    mode === "paid"
                      ? paymentCount
                        ? "statistics_category_zero_amount"
                        : "statistics_category_no_payments"
                      : mode === "upcoming"
                        ? paymentCount
                          ? "statistics_category_zero_amount"
                          : "statistics_category_no_upcoming"
                        : "no_results",
                  )}
                </p>
              </div>
            )}
            {year && data.length > 0 && (
              <div className="monline-scroll overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("statistics_category_breakdown")}</caption>
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th scope="col" className="py-2 text-left font-medium">
                        {t("category")}
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        {t("amount")}
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        {t("statistics_category_payment_count")}
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        {t("statistics_category_share")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((item, index) => (
                      <Fragment key={item.name}>
                        <tr className="border-b last:border-0">
                          <th scope="row" className="py-2.5 text-left font-medium">
                            <button
                              type="button"
                              disabled={!categoryDetails?.[item.name]?.length}
                              aria-expanded={expandedCategories.has(item.name)}
                              aria-label={t("statistics_category_details", { category: item.name })}
                              onClick={() =>
                                setExpandedCategories((previous) => {
                                  const next = new Set(previous);
                                  if (next.has(item.name)) next.delete(item.name);
                                  else next.add(item.name);
                                  return next;
                                })
                              }
                              className="inline-flex items-center gap-2 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default"
                            >
                              <span
                                aria-hidden="true"
                                className="mr-2 inline-block h-2 w-2 rounded-full"
                                style={{
                                  background:
                                    STATISTICS_CATEGORY_COLORS[
                                      index % STATISTICS_CATEGORY_COLORS.length
                                    ],
                                }}
                              />
                              {item.name}
                              {!!categoryDetails?.[item.name]?.length && (
                                <ChevronDown
                                  aria-hidden="true"
                                  className={cn(
                                    "h-4 w-4 text-muted-foreground",
                                    expandedCategories.has(item.name) && "rotate-180",
                                  )}
                                />
                              )}
                            </button>
                          </th>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                            {formatPrice(item.value, mainSymbol, { currencyCode: mainCode })}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {item.count ?? "—"}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{percent(item.share)}</td>
                        </tr>
                        {expandedCategories.has(item.name) &&
                          categoryDetails?.[item.name]?.map((detail) => (
                            <tr
                              key={detail.id}
                              className="border-b bg-muted/20 text-xs last:border-0"
                            >
                              <th scope="row" className="py-2 pl-6 text-left font-normal">
                                {detail.name}
                              </th>
                              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                                {formatPrice(detail.value, mainSymbol, { currencyCode: mainCode })}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {detail.count ?? "—"}
                              </td>
                              <td className="py-2 text-right tabular-nums">
                                {percent(total > 0 ? detail.value / total : 0)}
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {unpricedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("payments_missing_amount", { count: unpricedCount })}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
