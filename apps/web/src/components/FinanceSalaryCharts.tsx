import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, type TooltipProps,XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { type FinanceData, salaryAnalysis,type SalaryTag } from "@/lib/finance";
import { resolveLocale } from "@/lib/locale";
import { SALARY_TAG_STYLES } from "@/lib/salaryTagStyles";
import { cn, formatCurrency, formatMultiplier } from "@/lib/utils";

type SalaryChartId = "rates" | "currency" | "minimum" | "multiple";
type ChartKey = "salary" | "usdSalary" | "eurSalary" | "minimumWage" | "multiple";
type ChartUnit = "TRY" | "USD" | "EUR" | "multiple";
type ChartSeries = { key: ChartKey; label: string; color: string; unit: ChartUnit };
type ChartPoint = { month: string; salaryTag?: SalaryTag | "" } & Record<ChartKey, number | null>;

function SalaryChartDot({ cx, cy, payload, seriesKey, color, active = false }: {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
  seriesKey: ChartKey;
  color: string;
  active?: boolean;
}) {
  const value = payload?.[seriesKey];
  if (cx == null || cy == null || typeof value !== "number" || !Number.isFinite(value)) return <g />;
  const tag = payload?.salaryTag;
  if (tag) {
    return <circle cx={cx} cy={cy} r={active ? 6 : 3.5}
      className={SALARY_TAG_STYLES[tag].text} fill="currentColor"
      stroke="hsl(var(--card))" strokeWidth={active ? 2 : 1} />;
  }
  return <circle cx={cx} cy={cy} r={active ? 6 : 3.5} fill={color}
    stroke="hsl(var(--card))" strokeWidth={active ? 2 : 1} />;
}

function SalaryChartTooltip({ active, payload, label, series, salaryTag, formatValue, formatMonth }: TooltipProps<number, string> & {
  series: ChartSeries[];
  salaryTag?: SalaryTag | "";
  formatValue: (value: number, unit: ChartUnit) => string;
  formatMonth: (month: string) => string;
}) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const sortedValues = series.flatMap((item) => {
    const value = payload.find((entry) => entry.dataKey === item.key)?.value;
    return typeof value === "number" && Number.isFinite(value) ? [{ item, value }] : [];
  }).sort((a, b) => b.value - a.value);
  return (
    <div className="min-w-44 space-y-2.5 rounded-2xl border border-border/70 bg-card/95 px-4 py-3 text-xs shadow-[0_12px_36px_rgba(0,0,0,0.18)] backdrop-blur-md">
      <p className="border-b border-border/60 pb-2 font-semibold">{formatMonth(String(label))}</p>
      {salaryTag && <p className={`inline-flex rounded px-2 py-1 font-medium ${SALARY_TAG_STYLES[salaryTag].text} ${SALARY_TAG_STYLES[salaryTag].background}`}>{t(`finance_salary_tag_${salaryTag}`)}</p>}
      {sortedValues.map(({ item, value }) => (
        <div key={item.key} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
          <span className="font-semibold tabular-nums">{formatValue(value, item.unit)}</span>
        </div>
      ))}
    </div>
  );
}

export function FinanceSalaryCharts({ data, year, years, today, decimalPlaces }: {
  data: FinanceData;
  year: number;
  years: number[];
  today: string;
  decimalPlaces: number;
}) {
  const { t, i18n } = useTranslation();
  const gradientId = `salary-${useId().replace(/:/g, "")}`;
  const [allYears, setAllYears] = useState(true);
  const [selectedChart, setSelectedChart] = useState<SalaryChartId>("rates");
  const locale = resolveLocale(i18n, "tr");
  if (!years.length) return null;

  const firstYear = allYears ? Math.min(...years) : year;
  const currentMonth = today.slice(0, 7);
  const lastYear = Math.min(allYears ? Math.max(...years) : year, Number(today.slice(0, 4)));
  const months = Array.from({ length: Math.max(0, lastYear - firstYear + 1) }, (_, index) => salaryAnalysis(data, firstYear + index)).flat()
    .filter((month) => month.month <= currentMonth);
  const firstIndex = months.findIndex((month) => month.salary != null);
  const lastIndex = months.reduce((last, month, index) => month.salary != null ? index : last, -1);
  const points: ChartPoint[] = firstIndex < 0 ? [] : months.slice(firstIndex, lastIndex + 1).map((month) => ({
    month: month.month,
    salaryTag: month.reference?.salary_tag,
    salary: month.salary,
    usdSalary: month.usd,
    eurSalary: month.eur,
    minimumWage: month.salary != null && month.reference?.minimum_wage && month.reference.minimum_wage > 0 ? month.reference.minimum_wage : null,
    multiple: month.minimum,
  }));
  const multiYear = points.length > 0 && points[0].month.slice(0, 4) !== points[points.length - 1].month.slice(0, 4);
  const tickMonths = multiYear
    ? points.filter((point, index) => index === 0 || point.month.endsWith("-01")).map((point) => point.month)
    : undefined;
  const formatMonth = (month: string) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
  const formatValue = (value: number, unit: ChartUnit) => unit === "multiple"
    ? formatMultiplier(value)
    : formatCurrency(value, unit, { locale, minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces });
  const salary: ChartSeries = { key: "salary", label: t("finance_salary_chart_salary_tl"), color: "var(--salary-chart-tl)", unit: "TRY" };
  const charts: Record<SalaryChartId, { id: SalaryChartId; title: string; series: ChartSeries[] }> = {
    rates: { id: "rates", title: t("finance_salary_chart_rates"), series: [
      salary,
      { key: "eurSalary", label: t("finance_salary_eur_value"), color: "var(--salary-chart-eur)", unit: "EUR" },
      { key: "usdSalary", label: t("finance_salary_usd_value"), color: "var(--salary-chart-usd)", unit: "USD" },
    ] },
    currency: { id: "currency", title: t("finance_salary_chart_currency"), series: [
      { key: "eurSalary", label: t("finance_salary_eur_value"), color: "var(--salary-chart-eur)", unit: "EUR" },
      { key: "usdSalary", label: t("finance_salary_usd_value"), color: "var(--salary-chart-usd)", unit: "USD" },
    ] },
    minimum: { id: "minimum", title: t("finance_salary_chart_minimum"), series: [
      { key: "minimumWage", label: t("finance_salary_chart_minimum_wage"), color: "var(--salary-chart-minimum)", unit: "TRY" },
      salary,
    ] },
    multiple: { id: "multiple", title: t("finance_salary_minimum_multiple"), series: [
      { key: "multiple", label: t("finance_salary_chart_ratio"), color: "var(--salary-chart-multiple)", unit: "multiple" },
    ] },
  };
  const chart = charts[selectedChart];
  const hasData = points.some((point) => chart.series.some((item) => point[item.key] != null));

  return <section className="finance-salary-charts min-w-0 overflow-hidden rounded-2xl border bg-card/30" aria-label={t("finance_salary_charts")}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
      <div className="space-y-1">
        <h3 className="font-semibold">{t("finance_salary_charts")}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("finance_salary_charts_help")}</p>
      </div>
      <div className="flex gap-1 rounded-xl border bg-muted/20 p-1" role="group" aria-label={t("finance_salary_chart_period")}>
        <Button type="button" size="sm" variant={!allYears ? "default" : "ghost"} aria-pressed={!allYears} onClick={() => setAllYears(false)}>{year}</Button>
        <Button type="button" size="sm" variant={allYears ? "default" : "ghost"} aria-pressed={allYears} onClick={() => setAllYears(true)}>{t("finance_salary_chart_all_years")}</Button>
      </div>
    </div>
    <figure className="min-w-0 p-3 sm:p-5">
          <figcaption className="mb-3 space-y-2 text-center">
            <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1 text-left sm:w-fit" role="group" aria-label={t("finance_salary_chart_select")}>
              {Object.values(charts).map((item) => <button key={item.id} type="button" aria-pressed={selectedChart === item.id}
                onClick={() => setSelectedChart(item.id)}
                className={cn("rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selectedChart === item.id ? "border-primary/60 bg-background text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {t(`finance_salary_chart_tab_${item.id}`)}
              </button>)}
            </div>
            <h4 className="sr-only">{chart.title}</h4>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 py-2 text-xs text-muted-foreground">
              {chart.series.map((item) => <span key={item.key} className="inline-flex items-center gap-2"><span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
            </div>
          </figcaption>
          {hasData ? <div className="h-[280px] min-w-0 overflow-hidden rounded-xl border border-border/40 bg-muted/10 dark:bg-[#151a1c] sm:h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart key={chart.id} data={points} margin={{ top: 18, right: 16, left: 16, bottom: 8 }} accessibilityLayer>
                <defs>
                  {chart.series.map((item) => <linearGradient key={item.key} id={`${gradientId}-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={item.color} stopOpacity={0.2} />
                    <stop offset="70%" stopColor={item.color} stopOpacity={0.06} />
                    <stop offset="100%" stopColor={item.color} stopOpacity={0} />
                  </linearGradient>)}
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.55} strokeWidth={0.75}
                  verticalCoordinatesGenerator={({ offset }) => {
                    const divisions = Math.min(12, Math.max(1, points.length - 1));
                    return Array.from({ length: divisions + 1 }, (_, index) => (offset.left ?? 0) + (offset.width ?? 0) * index / divisions);
                  }} />
                <XAxis dataKey="month" ticks={tickMonths} tickFormatter={(month: string) => multiYear ? month.slice(0, 4) : new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`))}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} minTickGap={28} interval="preserveStartEnd" dy={6} />
                <YAxis hide={chart.id !== "multiple"} domain={[0, "auto"]} tickCount={6}
                  width={56} tickFormatter={formatMultiplier}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip<number, string> filterNull content={(props) => <SalaryChartTooltip {...props} series={chart.series} salaryTag={points.find((point) => point.month === props.label)?.salaryTag} formatValue={formatValue} formatMonth={formatMonth} />}
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.45, strokeWidth: 1, strokeDasharray: "3 4" }} />
                {chart.series.map((item) => <Area key={item.key} type="linear" dataKey={item.key} name={item.label}
                  stroke={item.color} fill={`url(#${gradientId}-${item.key})`} fillOpacity={1} strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round"
                  dot={(props) => <SalaryChartDot {...props} seriesKey={item.key} color={item.color} />}
                  activeDot={(props) => <SalaryChartDot {...props} seriesKey={item.key} color={item.color} active />}
                  connectNulls={false} isAnimationActive={false} />)}
              </AreaChart>
            </ResponsiveContainer>
          </div> : <div className="flex h-[280px] items-center justify-center rounded-xl border border-border/40 bg-muted/10 text-sm text-muted-foreground dark:bg-[#151a1c] sm:h-[340px]" role="status">{t(points.length ? "finance_salary_no_comparison_data" : "finance_salary_chart_no_past_data")}</div>}
    </figure>
  </section>;
}
