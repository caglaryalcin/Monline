import { X } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { STATISTICS_CATEGORY_COLORS } from "@/components/statistics/constants";
import { Button } from "@/components/ui/button";
import { resolveLocale } from "@/lib/locale";
import { STATEMENT_CATEGORIES, type StatementCategory } from "@/lib/statementCategories";
import type { ReportGroup } from "@/lib/statementReport";
import { cn, formatCurrency, formatMultiplier } from "@/lib/utils";

const COLORS = [...STATISTICS_CATEGORY_COLORS, "#C4B5FD", "#F0ABFC", "#94A3B8", "#E5B87A"];
const categoryColor = (category: StatementCategory) =>
  COLORS[STATEMENT_CATEGORIES.indexOf(category)];

export function StatementCategoryChart({
  groups,
  currency,
  canImport,
  onSubscriptions,
}: {
  groups: ReportGroup[];
  currency: string;
  canImport: boolean;
  onSubscriptions: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<StatementCategory | null>(null);
  const detailsId = useId();
  const language = resolveLocale(i18n);
  const money = (value: number) =>
    formatCurrency(value, currency, { locale: language });
  const percent = (value: number) =>
    new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 1 }).format(value);
  const total = groups.reduce((sum, group) => sum + Math.round(group.total * 100), 0) / 100;
  const positiveTotal =
    groups.reduce((sum, group) => sum + Math.max(0, Math.round(group.total * 100)), 0) / 100;
  const chartData = groups
    .filter((group) => group.total > 0)
    .map((group) => ({
      category: group.category,
      name: t(`statement_category_${group.category}`),
      value: group.total,
      share: group.total / positiveTotal,
    }));
  const chosen = groups.find((group) => group.category === selected);
  const choose = (category: StatementCategory) =>
    setSelected((current) => (current === category ? null : category));
  const formattedTotal = money(total);

  return (
    <section
      aria-label={t("statement_category_chart", { currency })}
      className="overflow-hidden rounded-2xl border bg-card/40"
    >
      <div className="grid items-center gap-4 p-4 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
        <div
          role="group"
          aria-label={t("statement_category_chart", { currency })}
          className="min-w-0"
        >
          {positiveTotal > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={280}
              initialDimension={{ width: 360, height: 280 }}
            >
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={108}
                  paddingAngle={2}
                  cornerRadius={4}
                  isAnimationActive={false}
                  onClick={(entry) => choose(entry.category)}
                >
                  <Label
                    position="center"
                    dy={-14}
                    value={`${t("statement_category_net_total")} · ${currency}`}
                    className="fill-muted-foreground text-[10px]"
                  />
                  <Label
                    position="center"
                    dy={10}
                    value={formattedTotal}
                    className="fill-foreground font-semibold tabular-nums"
                    fontSize={formattedTotal.length > 16 ? 11 : 14}
                  />
                  {chartData.map((group) => (
                    <Cell
                      key={group.category}
                      fill={categoryColor(group.category)}
                      stroke={
                        selected === group.category ? "hsl(var(--foreground))" : "hsl(var(--card))"
                      }
                      strokeWidth={selected === group.category ? 3 : 2}
                      opacity={selected && selected !== group.category ? 0.45 : 1}
                      role="button"
                      tabIndex={0}
                      aria-label={t("statement_category_details", { category: group.name })}
                      aria-pressed={selected === group.category}
                      aria-controls={detailsId}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          choose(group.category);
                        }
                      }}
                      className="cursor-pointer transition-opacity duration-150 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name, item) => [
                    `${money(value)} · ${percent(item.payload.share)}`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
              <p className="text-xs text-muted-foreground">
                {currency} · {t("statement_category_net_total")}
              </p>
              <p className="text-2xl font-semibold tabular-nums">{formattedTotal}</p>
              <p className="text-sm text-muted-foreground">{t("statement_category_no_positive")}</p>
            </div>
          )}
        </div>
        <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
          {groups.map((group) => {
            const active = selected === group.category;
            return (
              <button
                key={group.category}
                type="button"
                aria-expanded={active}
                aria-controls={detailsId}
                aria-label={t("statement_category_details", {
                  category: t(`statement_category_${group.category}`),
                })}
                onClick={() => choose(group.category)}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                  active
                    ? "border-primary/60 bg-primary/5"
                    : "border-transparent hover:bg-muted/50",
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColor(group.category) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">
                    {t(`statement_category_${group.category}`)}
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                    {money(group.total)} ·{" "}
                    {group.total < 0
                      ? t("statement_category_refund")
                      : percent(positiveTotal ? group.total / positiveTotal : 0)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {groups.some((group) => group.total < 0) && (
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          {t("statement_category_positive_only")}
        </p>
      )}
      <div id={detailsId} className="border-t px-4 py-3" aria-live="polite">
        {chosen ? (
          <section
            aria-label={t("statement_category_details", {
              category: t(`statement_category_${chosen.category}`),
            })}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className="text-sm font-semibold">
                  {t(`statement_category_${chosen.category}`)}
                </h4>
                <span className="text-sm font-semibold tabular-nums">{money(chosen.total)}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setSelected(null)}
                aria-label={t("close")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="divide-y text-sm">
              {chosen.items.map((item, index) => (
                <div key={index} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0 break-words">
                    {item.feeType ? t(`statement_financing_${item.feeType}`) : item.merchant}
                    {item.installment && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({item.installment} {t("statement_installment")})
                      </span>
                    )}
                    {item.count > 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">{formatMultiplier(item.count)}</span>
                    )}
                    {item.derived && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("statement_derived_fee_help")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right tabular-nums">{money(item.amount)}</span>
                </div>
              ))}
            </div>
            {chosen.category === "digital" && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <p className="text-xs text-muted-foreground">{t("statement_digital_help")}</p>
                {canImport && (
                  <Button variant="outline" size="sm" onClick={onSubscriptions}>
                    {t("statement_import_title")}
                  </Button>
                )}
              </div>
            )}
          </section>
        ) : (
          <p className="text-xs text-muted-foreground">{t("statement_category_select")}</p>
        )}
      </div>
    </section>
  );
}
