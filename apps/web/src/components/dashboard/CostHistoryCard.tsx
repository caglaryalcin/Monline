import { TrendingUp } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  DefaultTooltipContent,
  Dot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalToday } from "@/hooks/useLocalToday";
import { type CostHistoryPoint, historyMonth, yearMonths } from "@/lib/costHistory";
import { resolveLocale } from "@/lib/locale";
import { getCurrencySymbol } from "@/lib/utils";

interface CostHistoryCardProps {
  data: CostHistoryPoint[];
  formatValue: (value: number) => string;
  currencySymbol?: string;
  isLoading?: boolean;
  hasError?: boolean;
  className?: string;
  variant?: "classic" | "sparkline";
  selectedYear?: number;
  onYearChange?: (year: number) => void;
  forecasts?: CostHistoryPoint[];
}

export function CostHistoryCard({
  data,
  formatValue,
  currencySymbol = "$",
  isLoading,
  hasError,
  className = "lg:col-span-2",
  variant = "sparkline",
  selectedYear: controlledYear,
  onYearChange,
  forecasts,
}: CostHistoryCardProps) {
  const { t, i18n } = useTranslation();
  const language = resolveLocale(i18n);
  const fillId = `history-${useId().replace(/:/g, "")}`;
  const currentYear = Number(useLocalToday().slice(0, 4));
  const [localYear, setLocalYear] = useState(currentYear);
  useEffect(() => setLocalYear(currentYear), [currentYear]);
  const selectedYear = controlledYear ?? localYear;
  const years = [
    ...new Set([
      currentYear,
      selectedYear,
      ...data.flatMap((point) => {
        const match = /^(\d{4})\/(0[1-9]|1[0-2])$/.exec(point.name);
        const year = match ? Number(match[1]) : NaN;
        return Number.isInteger(year) && year <= currentYear ? [year] : [];
      }),
    ]),
  ].sort((left, right) => right - left);
  const chartData = yearMonths(data, selectedYear, forecasts);
  const hasForecast = chartData.some((point) => point.isForecast);
  const recordedCount = chartData.filter((point) => point.cost !== null).length;
  const classic = variant === "classic";
  const lineColor = classic ? "hsl(var(--primary))" : "var(--history-line)";
  const forecastColor = "hsl(var(--muted-foreground))";
  const axisNumber = new Intl.NumberFormat(language.replace("_", "-"), {
    notation: "standard",
    useGrouping: false,
    maximumFractionDigits: 0,
  });
  const groupedAxisNumber = new Intl.NumberFormat(language.replace("_", "-"), {
    notation: "standard",
    useGrouping: true,
    maximumFractionDigits: 0,
  });
  const formatAxisValue = (value: number) =>
    `${(Math.abs(Math.round(value)) >= 10000 ? groupedAxisNumber : axisNumber).format(value)}${getCurrencySymbol(currencySymbol, language)}`;
  const maximum = Math.max(
    0,
    ...chartData.flatMap((point) => [point.cost ?? 0, point.forecast ?? 0]),
  );
  const axisWidth = Math.max(64, formatAxisValue(Math.ceil(maximum * 1.25)).length * 7 + 12);
  return (
    <Card
      className={`${classic ? "" : "history-chart-card"} overflow-hidden rounded-3xl border shadow-sm ${className}`}
    >
      <CardHeader
        className={`flex-row flex-wrap items-center justify-between gap-3 space-y-0 ${classic ? "border-b bg-muted/30 pb-4" : "pb-5"}`}
      >
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            {classic && <TrendingUp className="h-5 w-5 text-primary" />}
            <Select
              value={String(selectedYear)}
              onValueChange={(value) => {
                setLocalYear(Number(value));
                onYearChange?.(Number(value));
              }}
            >
              <SelectTrigger
                aria-label={t("history_select_year")}
                className="h-9 w-auto min-w-[6.5rem] gap-2 rounded-xl text-base font-semibold"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardTitle>
          {!classic && (
            <p className="text-xs text-muted-foreground">
              {historyMonth(chartData[0].name, language)} —{" "}
              {historyMonth(chartData.at(-1)!.name, language)}
            </p>
          )}
        </div>
        {hasForecast && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="w-6 border-t-2 border-dashed border-muted-foreground"
            />
            {t("history_upcoming_payment")}
          </div>
        )}
      </CardHeader>
      <CardContent className={classic ? "pt-6" : "px-3 pb-3 sm:px-5 sm:pb-5"}>
        {hasError && (
          <p role="alert" className="px-4 pb-2 text-sm text-destructive">
            {t("history_load_error")}
          </p>
        )}
        {isLoading ? (
          <div
            role="status"
            aria-label={t("loading")}
            className={`${classic ? "h-[280px]" : "h-[240px]"} animate-pulse rounded-2xl bg-muted`}
          />
        ) : recordedCount || hasForecast ? (
          <div
            className={
              classic
                ? "h-[280px] w-full"
                : "h-[240px] w-full rounded-2xl border border-border/50 bg-muted/10 pt-2 dark:bg-[#15191a] sm:h-[260px]"
            }
            role="img"
            aria-label={t("history_year_chart_label", { year: selectedYear })}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={
                  classic
                    ? { top: 20, right: 12, left: 0, bottom: 8 }
                    : { top: 24, right: 22, left: 22, bottom: 12 }
                }
              >
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={classic ? 0.3 : 0.14} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={classic ? 0 : 0.01} />
                  </linearGradient>
                  <linearGradient id={`${fillId}-forecast`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={forecastColor} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={forecastColor} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                {classic && (
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--muted-foreground))"
                    opacity={0.2}
                  />
                )}
                <XAxis
                  dataKey="name"
                  tickFormatter={(name) =>
                    historyMonth(
                      String(name),
                      language,
                      false,
                      !String(name).startsWith(`${selectedYear}/`),
                    )
                  }
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                  dy={8}
                />
                <YAxis
                  hide={!classic}
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
                  labelFormatter={(name) => historyMonth(String(name), language, true)}
                  formatter={(value: number, _name, item) => [
                    formatValue(value),
                    t(item?.dataKey === "forecast" ? "history_upcoming_payment" : "amount"),
                  ]}
                  content={(props) => (
                    <DefaultTooltipContent<number, string>
                      {...props}
                      payload={props.payload?.filter(
                        (entry) => entry.dataKey !== "forecast" || entry.payload?.isForecast,
                      )}
                    />
                  )}
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    padding: "12px 16px",
                    boxShadow: "0 8px 30px rgb(0 0 0 / 0.12)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  cursor={{
                    stroke: lineColor,
                    strokeOpacity: 0.3,
                    strokeDasharray: "3 5",
                  }}
                />
                <Area
                  type={classic ? "monotone" : "linear"}
                  dataKey="cost"
                  stroke={lineColor}
                  strokeWidth={classic ? 3 : 1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={`url(#${fillId})`}
                  dot={{
                    r: classic ? 3 : 2,
                    fill: lineColor,
                    strokeWidth: 0,
                  }}
                  activeDot={{
                    r: classic ? 6 : 5,
                    fill: lineColor,
                    stroke: "hsl(var(--card))",
                    strokeWidth: 3,
                  }}
                  label={
                    recordedCount === 1
                      ? {
                          position: "top",
                          formatter: (value: number | null) =>
                            value === null ? "" : formatValue(value),
                          fill: "hsl(var(--foreground))",
                          fontSize: 14,
                          fontWeight: 600,
                        }
                      : false
                  }
                  isAnimationActive={false}
                  connectNulls={false}
                />
                {hasForecast && (
                  <Area
                    type="linear"
                    dataKey="forecast"
                    stroke={forecastColor}
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    fill={`url(#${fillId}-forecast)`}
                    dot={({ cx, cy, payload }) => (
                      <Dot
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill={payload?.isForecast ? forecastColor : "hsl(var(--primary))"}
                        strokeWidth={0}
                      />
                    )}
                    activeDot={({ cx, cy, payload }) => (
                      <Dot
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={payload?.isForecast ? forecastColor : "hsl(var(--primary))"}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      />
                    )}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div
            className={
              classic
                ? "flex h-[280px] items-center justify-center px-4 text-center text-sm text-muted-foreground"
                : "flex h-[240px] items-center justify-center rounded-2xl border border-border/50 bg-muted/10 px-4 text-center text-sm text-muted-foreground dark:bg-[#15191a]"
            }
          >
            {t("history_year_empty", { year: selectedYear })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
