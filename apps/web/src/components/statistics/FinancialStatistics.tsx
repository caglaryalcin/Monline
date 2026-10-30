import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { STATISTICS_COLORS } from "@/components/statistics/constants";
import { InstallmentStatisticsDetails } from "@/components/statistics/InstallmentStatisticsDetails";
import { Button } from "@/components/ui/button";
import { ThemedSelect } from "@/components/ui/themed-select";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import {
  financialStatisticsRows,
  type FinancialStatisticsSection,
  financialStatisticsSum,
} from "@/lib/financialStatistics";
import { resolveLocale } from "@/lib/locale";
import { EMPTY_SPENDING, spendingKey } from "@/lib/spending";
import { cn, formatCurrency } from "@/lib/utils";
import { spendingService } from "@/services/spending";

export function FinancialStatistics({ section }: { section: FinancialStatisticsSection }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const today = useLocalToday();
  const locale = resolveLocale(i18n);
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [chosenMonth, setChosenMonth] = useState("");
  const [chosenCurrency, setChosenCurrency] = useState("TRY");
  const [drilldown, setDrilldown] = useState({ key: "", name: "" });
  const query = useQuery({
    queryKey: spendingKey(user?.id || ""),
    queryFn: spendingService.get,
    enabled: !!user?.id,
  });
  const data = query.data ?? EMPTY_SPENDING;
  const allRows = financialStatisticsRows(data, section);
  const currencies = [...new Set(allRows.map((row) => row.currency))].sort();
  const currency = currencies.includes(chosenCurrency) ? chosenCurrency : currencies[0] || "TRY";
  const sourceRows = allRows.filter((row) => row.currency === currency);
  const years = [
    ...new Set([
      Number(today.slice(0, 4)),
      year,
      ...sourceRows.map((row) => Number(row.month.slice(0, 4))),
      ...(section === "installments"
        ? (data.statement_months ?? []).map((value) => Number(value.slice(0, 4)))
        : []),
    ]),
  ].sort((a, b) => b - a);
  const months = Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  );
  const recordedMonths = [
    ...new Set(data.statement_months ?? data.installments.map((plan) => plan.period)),
  ]
    .filter((value) => value.startsWith(`${year}-`))
    .sort();
  const installmentMonth = recordedMonths.includes(chosenMonth)
    ? chosenMonth
    : recordedMonths.includes(today.slice(0, 7))
      ? today.slice(0, 7)
      : recordedMonths.at(-1) || "";
  const period =
    section === "installments"
      ? installmentMonth
      : chosenMonth.startsWith(`${year}-`)
        ? chosenMonth
        : "";
  const yearRows = sourceRows.filter((row) => row.month.startsWith(`${year}-`));
  const rows =
    section === "installments"
      ? yearRows.filter((row) => row.month === period)
      : period
        ? yearRows.filter((row) => row.month === period)
        : yearRows;
  const money = (amount: number) => formatCurrency(amount, currency, { locale: locale });
  const monthName = (value: string, short = false) =>
    new Intl.DateTimeFormat(locale, {
      month: short ? "short" : "long",
      ...(short ? {} : { year: "numeric" as const }),
      timeZone: "UTC",
    }).format(new Date(`${value}-01T12:00:00Z`));
  const sum = (field: "amount" | "paid" | "remaining" | "futureAmount") =>
    financialStatisticsSum(rows, field);
  const monthly = months.map((value) => {
    const entries = yearRows.filter((row) => row.month === value);
    return {
      month: value,
      total: financialStatisticsSum(entries, "amount"),
      paid: financialStatisticsSum(entries, "paid"),
      remaining: financialStatisticsSum(entries, "remaining"),
    };
  });
  const maxMonth = Math.max(1, ...monthly.map((value) => value.total));
  const distribution = new Map<string, { name: string; cents: number; count: number }>();
  for (const row of rows) {
    const group = distribution.get(row.name) ?? { name: row.name, cents: 0, count: 0 };
    group.cents += Math.round(row.amount * 100);
    group.count++;
    distribution.set(row.name, group);
  }
  const groups = [...distribution.values()]
    .map((group) => ({ ...group, value: group.cents / 100 }))
    .filter((group) => group.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, locale));
  const context = `${section}:${year}:${period}:${currency}`;
  const selectedName =
    drilldown.key === context && distribution.has(drilldown.name) ? drilldown.name : "";
  const details = rows
    .filter((row) => !selectedName || row.name === selectedName)
    .sort((a, b) => a.month.localeCompare(b.month) || a.name.localeCompare(b.name, locale));
  const detailsByMonth = new Map<string, typeof details>();
  for (const row of details) {
    const entries = detailsByMonth.get(row.month) ?? [];
    entries.push(row);
    detailsByMonth.set(row.month, entries);
  }
  const detailPeriods = [...detailsByMonth.entries()].map(([value, entries]) => ({
    month: value,
    entries,
    amount: financialStatisticsSum(entries, "amount"),
    paid: financialStatisticsSum(entries, "paid"),
    remaining: financialStatisticsSum(entries, "remaining"),
    futureAmount: financialStatisticsSum(entries, "futureAmount"),
  }));
  const selectGroup = (name: string) =>
    setDrilldown({ key: context, name: selectedName === name ? "" : name });
  const cards =
    section === "installments"
      ? [
          {
            label: "installment_stats_month_amount",
            value: money(sum("amount")),
            note: period ? monthName(period) : t("finance_stats_no_statement"),
            color: "text-emerald-700 dark:text-emerald-400",
          },
          {
            label: "installment_stats_future",
            value: money(sum("futureAmount")),
            note: t("installment_stats_excludes_current"),
            color: "text-rose-700 dark:text-rose-400",
          },
          {
            label: "installment_stats_purchase_total",
            value: String(rows.length),
            note: t("installment_stats_final_count", {
              count: rows.filter((row) => row.futureCount === 0).length,
            }),
            color: "",
          },
        ]
      : [
          {
            label: "loans_paid",
            value: money(sum("paid")),
            note: t("finance_stats_records", { count: rows.filter((row) => row.paid > 0).length }),
            color: "text-emerald-700 dark:text-emerald-400",
          },
          {
            label: "loans_remaining",
            value: money(sum("remaining")),
            note: t("finance_stats_records", {
              count: rows.filter((row) => row.remaining > 0).length,
            }),
            color: "text-rose-700 dark:text-rose-400",
          },
          {
            label: "loans_sum",
            value: money(sum("amount")),
            note: t("finance_stats_records", { count: rows.length }),
            color: "",
          },
        ];

  if (query.isPending)
    return (
      <div
        role="status"
        aria-label={t("loading")}
        className="h-80 animate-pulse rounded-3xl bg-muted motion-reduce:animate-none"
      />
    );
  if (query.isError)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border p-5">
        <p className="text-sm text-destructive">{t("finance_stats_error")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("finance_retry")}
        </Button>
      </div>
    );

  return (
    <section className="space-y-5" aria-label={t(`finance_stats_${section}`)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t(`finance_stats_${section}`)}</h2>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {t(`finance_stats_${section}_source`)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ThemedSelect
            value={year}
            aria-label={t("history_select_year")}
            className="h-10 rounded-xl px-3 text-sm"
            onChange={(event) => {
              setYear(Number(event.target.value));
              setChosenMonth("");
            }}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </ThemedSelect>
          <ThemedSelect
            value={period}
            aria-label={t(
              section === "installments" ? "finance_stats_statement_period" : "spending_month",
            )}
            className="h-10 rounded-xl px-3 text-sm"
            onChange={(event) => setChosenMonth(event.target.value)}
            disabled={section === "installments" && !recordedMonths.length}
          >
            {section !== "installments" ? (
              <option value="">{t("finance_stats_whole_year")}</option>
            ) : (
              !recordedMonths.length && <option value="">{t("finance_stats_no_statement")}</option>
            )}
            {(section === "installments" ? recordedMonths : months).map((value) => (
              <option key={value} value={value}>
                {monthName(value)}
              </option>
            ))}
          </ThemedSelect>
          {currencies.length > 1 && (
            <ThemedSelect
              value={currency}
              aria-label={t("finance_stats_currency")}
              className="h-10 rounded-xl px-3 text-sm"
              onChange={(event) => setChosenCurrency(event.target.value)}
            >
              {currencies.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </ThemedSelect>
          )}
        </div>
      </div>

      <dl className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="min-w-0 bg-card px-5 py-4">
            <dt className="text-xs text-muted-foreground">{t(card.label)}</dt>
            <dd
              className={cn(
                "mt-2 break-words text-2xl font-semibold tracking-tight tabular-nums",
                card.color,
              )}
            >
              {card.value}
            </dd>
            <dd className="mt-1 text-xs text-muted-foreground">{card.note}</dd>
          </div>
        ))}
      </dl>

      {section === "installments" ? (
        <InstallmentStatisticsDetails
          rows={rows}
          yearRows={yearRows}
          months={recordedMonths}
          period={period}
          year={year}
          onMonthChange={setChosenMonth}
          money={money}
          monthName={monthName}
        />
      ) : (
        <>
          <div className="space-y-4 overflow-hidden rounded-3xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{t("finance_stats_monthly", { year })}</h3>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {t("loans_paid")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  {t("loans_remaining")}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto p-1">
              <div
                className="grid min-w-[660px] grid-cols-12 gap-2"
                role="group"
                aria-label={t("finance_stats_select_month")}
              >
                {monthly.map((value) => (
                  <button
                    key={value.month}
                    type="button"
                    aria-pressed={period === value.month}
                    aria-label={`${monthName(value.month)} · ${money(value.total)}`}
                    title={`${monthName(value.month)} · ${money(value.total)}`}
                    onClick={() => setChosenMonth(value.month)}
                    className={cn(
                      "min-w-0 rounded-xl px-2 py-3 text-center transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default disabled:opacity-40",
                      period === value.month && "bg-muted/50 ring-1 ring-inset ring-primary/50",
                    )}
                  >
                    <span className="flex h-36 flex-col justify-end" aria-hidden="true">
                      <span
                        className="flex w-full flex-col overflow-hidden rounded-t-md"
                        style={{
                          height:
                            value.total > 0
                              ? `${Math.max(2, (value.total / maxMonth) * 100)}%`
                              : "2px",
                        }}
                      >
                        {value.total > 0 ? (
                          <>
                            <span
                              className="bg-rose-500"
                              style={{ height: `${(value.remaining / value.total) * 100}%` }}
                            />
                            <span
                              className="bg-emerald-500"
                              style={{ height: `${(value.paid / value.total) * 100}%` }}
                            />
                          </>
                        ) : (
                          <span className="h-full bg-muted" />
                        )}
                      </span>
                    </span>
                    <span className="mt-3 block text-xs font-medium">
                      {monthName(value.month, true)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("finance_stats_click_month")}</p>
          </div>

          <div className="overflow-hidden rounded-3xl border bg-card">
            <div className="border-b bg-muted/20 px-5 py-4">
              <h3 className="text-sm font-semibold">{t("finance_stats_distribution")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {period ? monthName(period) : String(year)}
              </p>
            </div>
            {groups.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("finance_stats_empty")}</p>
            ) : (
              <>
                <div className="grid items-center gap-4 p-5 lg:grid-cols-[280px_1fr]">
                  <div className="relative h-64 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={groups}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={72}
                          outerRadius={100}
                          paddingAngle={2}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {groups.map((group, index) => (
                            <Cell
                              key={group.name}
                              fill={STATISTICS_COLORS[index % STATISTICS_COLORS.length]}
                              opacity={!selectedName || selectedName === group.name ? 1 : 0.3}
                              onClick={() => selectGroup(group.name)}
                              className="cursor-pointer"
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => money(Number(value))}
                          contentStyle={{
                            background: "hsl(var(--background))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground">{t("loans_sum")}</span>
                      <span
                        className="mt-1 max-w-36 truncate text-sm font-semibold tabular-nums"
                        title={money(sum("amount"))}
                      >
                        {money(sum("amount"))}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {groups.map((group, index) => (
                      <button
                        key={group.name}
                        type="button"
                        aria-pressed={selectedName === group.name}
                        onClick={() => selectGroup(group.name)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selectedName === group.name && "bg-muted/50",
                        )}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            background: STATISTICS_COLORS[index % STATISTICS_COLORS.length],
                          }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 break-words">{group.name}</span>
                        <span className="shrink-0 text-right">
                          <span className="block font-medium tabular-nums">
                            {money(group.value)}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {new Intl.NumberFormat(locale, {
                              style: "percent",
                              maximumFractionDigits: 1,
                            }).format(group.value / sum("amount"))}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
                  <h4 className="text-sm font-medium">
                    {selectedName || t("finance_stats_details")}
                  </h4>
                  {selectedName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDrilldown({ key: context, name: "" })}
                    >
                      {t("finance_stats_show_all")}
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-left text-xs">
                    <caption className="sr-only">{t("finance_stats_details")}</caption>
                    <thead className="border-y bg-muted/20 text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-medium">
                          {t("loans_month")}
                        </th>
                        <th scope="col" className="px-5 py-3 font-medium">
                          {t("finance_stats_name")}
                        </th>
                        <th scope="col" className="px-5 py-3 font-medium">
                          {t("loans_amount")}
                        </th>
                        <th scope="col" className="px-5 py-3 font-medium">
                          {t("loans_paid")}
                        </th>
                        <th scope="col" className="px-5 py-3 font-medium">
                          {t("loans_remaining")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailPeriods.map((entry) => (
                        <tr key={entry.month} className="border-b last:border-0">
                          <th scope="row" className="px-5 py-3 align-top font-medium">
                            {monthName(entry.month)}
                          </th>
                          <td className="px-5 py-3 align-top whitespace-normal">
                            <ul className="flex min-w-64 max-w-3xl flex-wrap gap-2">
                              {entry.entries.map((row) => (
                                <li
                                  key={row.id}
                                  className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <span className="break-words font-medium">{row.name}</span>
                                    <span
                                      className={cn(
                                        "whitespace-nowrap font-medium tabular-nums",
                                        row.status === "settled"
                                          ? "text-emerald-700 dark:text-emerald-400"
                                          : row.status === "planned"
                                            ? "text-rose-700 dark:text-rose-400"
                                            : "text-amber-700 dark:text-amber-400",
                                      )}
                                    >
                                      {money(row.amount)}
                                    </span>
                                  </div>
                                  {row.status === "partial" && (
                                    <span className="mt-1 block text-[11px] text-emerald-700 dark:text-emerald-400">
                                      {t("loans_paid")}: {money(row.paid)}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="px-5 py-3 align-top tabular-nums">
                            {money(entry.amount)}
                          </td>
                          <td className="px-5 py-3 align-top tabular-nums text-emerald-700 dark:text-emerald-400">
                            {money(entry.paid)}
                          </td>
                          <td
                            className={cn(
                              "px-5 py-3 align-top tabular-nums",
                              entry.remaining > 0 && "text-rose-700 dark:text-rose-400",
                            )}
                          >
                            {money(entry.remaining)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
