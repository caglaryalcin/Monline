import { TrendingUp } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Dot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalaryTag } from "@/lib/finance";
import { resolveLocale } from "@/lib/locale";
import { SALARY_TAG_STYLES } from "@/lib/salaryTagStyles";

export interface DashboardYearPoint {
  month: string;
  value: number | null;
  usd?: number | null;
  forecast?: number | null;
  isForecast?: boolean;
  salaryTag?: SalaryTag | "";
}
interface YearHistorySeries {
  key: "value" | "usd" | "forecast";
  name: string;
  color: string;
  formatValue: (value: number) => string;
}

export function YearHistoryCard({
  title,
  year,
  data,
  color,
  forecastColor,
  currencySymbol = "₺",
  formatValue,
  series,
  isLoading,
  hasError,
  emptyText,
  children,
  yearControl,
}: {
  title: string;
  year: number;
  data: DashboardYearPoint[];
  color: string;
  forecastColor?: string;
  currencySymbol?: string;
  formatValue: (value: number) => string;
  series?: YearHistorySeries[];
  isLoading?: boolean;
  hasError?: boolean;
  emptyText: string;
  children?: ReactNode;
  yearControl?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n, "tr");
  const fillId = `year-history-${useId().replace(/:/g, "")}`;
  const chartSeries: YearHistorySeries[] = [
    ...(series ?? [{ key: "value" as const, name: t("paid"), color, formatValue }]),
  ];
  if (data.some((point) => point.isForecast && point.forecast != null))
    chartSeries.push({
      key: "forecast",
      name: t("history_upcoming_payment"),
      color: forecastColor ?? "hsl(var(--muted-foreground))",
      formatValue,
    });
  const axisNumber = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 0,
  });
  const groupedAxisNumber = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  });
  const formatAxisValue = (value: number) =>
    `${(Math.abs(Math.round(value)) >= 10000 ? groupedAxisNumber : axisNumber).format(value)} ${currencySymbol}`;
  const maximum = Math.max(
    0,
    ...data.flatMap((point) => chartSeries.map((item) => point[item.key] ?? 0)),
  );
  const axisWidth = Math.max(64, formatAxisValue(Math.ceil(maximum * 1.25)).length * 7 + 12);
  const monthName = (month: string, short = false) =>
    new Intl.DateTimeFormat(locale, {
      month: short ? "short" : "long",
      ...(short ? {} : { year: "numeric" as const }),
      timeZone: "UTC",
    }).format(new Date(`${month}-01T12:00:00Z`));
  const dot = (
    { cx, cy, payload }: { cx?: number; cy?: number; payload?: DashboardYearPoint },
    item: YearHistorySeries,
    active = false,
  ) => {
    if (cx == null || cy == null || payload?.[item.key] == null) return <g />;
    if (item.key === "forecast" && !payload.isForecast) return <g />;
    const tag = payload.salaryTag;
    return (
      <Dot
        cx={cx}
        cy={cy}
        r={active ? (item.key === "forecast" ? 5 : 6) : tag ? 4 : 3}
        className={tag ? SALARY_TAG_STYLES[tag].text : undefined}
        style={tag ? undefined : { color: item.color }}
        fill="currentColor"
        stroke={active || tag ? "hsl(var(--card))" : "none"}
        strokeWidth={active ? (item.key === "forecast" ? 2 : 3) : tag ? 1.5 : 0}
      />
    );
  };
  return (
    <Card className="h-full overflow-hidden rounded-3xl border shadow-sm">
      <CardHeader className="gap-3 border-b bg-muted/30 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-5 w-5 shrink-0" style={{ color }} />
            {title}
          </CardTitle>
          {yearControl ?? (
            <span className="text-sm font-semibold text-muted-foreground">{year}</span>
          )}
        </div>
        {children}
        {chartSeries.length > 1 && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {chartSeries.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div
            role="status"
            aria-label={t("loading")}
            className="h-[280px] animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
          />
        ) : hasError ? (
          <p
            role="alert"
            className="flex h-[280px] items-center justify-center text-sm text-destructive"
          >
            {t("dashboard_year_load_error")}
          </p>
        ) : !data.some((point) => chartSeries.some((item) => point[item.key] != null)) ? (
          <p className="flex h-[280px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <div className="h-[280px] w-full min-w-0" role="img" aria-label={`${title} · ${year}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 20, right: 12, left: 0, bottom: 8 }}
                accessibilityLayer
              >
                <defs>
                  {chartSeries.map((item) => (
                    <linearGradient
                      key={item.key}
                      id={`${fillId}-${item.key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={item.color}
                        stopOpacity={item.key === "forecast" ? 0.2 : 0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor={item.color}
                        stopOpacity={item.key === "forecast" ? 0.01 : 0}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--muted-foreground))"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={(month: string) => monthName(month, true)}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  interval={0}
                  dy={8}
                />
                <YAxis
                  width={axisWidth}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={formatAxisValue}
                  allowDecimals={false}
                  tickCount={6}
                  domain={[0, "auto"]}
                />
                <Tooltip<number, string>
                  filterNull
                  cursor={{ stroke: color, strokeOpacity: 0.3, strokeDasharray: "3 4" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const point = data.find((point) => point.month === label);
                    const values = chartSeries
                      .flatMap((item) => {
                        if (item.key === "forecast" && !point?.isForecast) return [];
                        const value = payload.find((entry) => entry.dataKey === item.key)?.value;
                        return typeof value === "number" && Number.isFinite(value)
                          ? [{ item, value }]
                          : [];
                      })
                      .sort((a, b) => b.value - a.value);
                    const tag = point?.salaryTag;
                    return (
                      <div className="space-y-2 rounded-xl border bg-card px-4 py-3 text-xs shadow-lg">
                        <p className="font-semibold">{monthName(String(label))}</p>
                        {tag && (
                          <p
                            className={`rounded px-2 py-1 ${SALARY_TAG_STYLES[tag].text} ${SALARY_TAG_STYLES[tag].background}`}
                          >
                            {t(`finance_salary_tag_${tag}`)}
                          </p>
                        )}
                        {values.map(({ item, value }) => (
                          <div key={item.key} className="flex items-center justify-between gap-6">
                            {chartSeries.length > 1 && (
                              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                                {item.name}
                              </span>
                            )}
                            <span
                              className="font-semibold tabular-nums"
                              style={{ color: item.color }}
                            >
                              {item.formatValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {chartSeries.map((item) => (
                  <Area
                    key={item.key}
                    type={item.key === "forecast" ? "linear" : "monotone"}
                    dataKey={item.key}
                    name={item.name}
                    stroke={item.color}
                    strokeWidth={item.key === "forecast" ? 2 : 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill={`url(#${fillId}-${item.key})`}
                    strokeDasharray={item.key === "forecast" ? "6 5" : undefined}
                    dot={(props) => dot(props, item)}
                    activeDot={(props) => dot(props, item, true)}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
