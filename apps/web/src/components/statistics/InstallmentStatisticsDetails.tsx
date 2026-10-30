import { useTranslation } from "react-i18next";

import { type FinancialStatisticsRow,financialStatisticsSum } from "@/lib/financialStatistics";
import { resolveLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

export function InstallmentStatisticsDetails({
  rows, yearRows, months, period, year, onMonthChange, money, monthName,
}: {
  rows: FinancialStatisticsRow[];
  yearRows: FinancialStatisticsRow[];
  months: string[];
  period: string;
  year: number;
  onMonthChange: (month: string) => void;
  money: (amount: number) => string;
  monthName: (month: string, short?: boolean) => string;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n);
  const monthly = months.map((month) => ({
    month,
    amount: financialStatisticsSum(yearRows.filter((row) => row.month === month), "amount"),
  }));
  const total = financialStatisticsSum(rows, "amount");
  const future = financialStatisticsSum(rows, "futureAmount");
  const purchases = [...rows].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, locale));

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5" aria-label={t("installment_stats_monthly")}>
        <div>
          <h3 className="text-sm font-semibold">{year} · {t("installment_stats_monthly")}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("installment_stats_recorded_only")}</p>
        </div>
        {monthly.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("finance_stats_no_statement")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label={t("finance_stats_select_month")}>
            {monthly.map((entry) => (
              <button key={entry.month} type="button" aria-pressed={entry.month === period}
                onClick={() => onMonthChange(entry.month)}
                className={cn("min-w-0 space-y-3 rounded-2xl border p-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  entry.month === period ? "border-primary/60 bg-muted/30" : "border-border")}>
                <span className="block text-xs text-muted-foreground">{monthName(entry.month)}</span>
                <span className="block break-words text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{money(entry.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border bg-card" aria-label={t("installment_stats_purchases")}>
        <div className="border-b bg-muted/20 px-5 py-4">
          <h3 className="text-sm font-semibold">{t("installment_stats_purchases")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {period ? t("installment_stats_period", { month: monthName(period) }) : t("finance_stats_no_statement")}
          </p>
        </div>
        {purchases.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("installment_stats_empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-xs">
              <caption className="sr-only">{t("installment_stats_purchases")}</caption>
              <thead className="border-b bg-muted/10 text-muted-foreground">
                <tr>
                  {["purchase", "month_amount", "progress", "future"].map((key) => (
                    <th key={key} scope="col" className="px-5 py-3 font-medium">{t(`installment_stats_${key}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchases.map((row) => {
                  const progress = row.installmentTotal ? Math.min(100, (row.installmentCurrent ?? 0) / row.installmentTotal * 100) : 0;
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <th scope="row" className="max-w-xs px-5 py-4 text-left font-medium whitespace-normal">
                        <span className="block break-words">{row.name}</span>
                        {row.card && <span className="mt-1 block text-[11px] font-normal text-muted-foreground">{row.card}</span>}
                      </th>
                      <td className="px-5 py-4">
                        <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{money(row.amount)}</span>
                        <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">
                          {new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(total > 0 ? row.amount / total : 0)}
                          {" · "}{t("installment_stats_month_share")}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-medium tabular-nums">{row.progress || "—"}</span>
                        <span className="mt-2 block h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {(row.futureCount ?? 0) > 0 ? (
                          <>
                            <span className="font-semibold tabular-nums text-rose-700 dark:text-rose-400">{money(row.futureAmount ?? 0)}</span>
                            <span className="mt-1 block text-[11px] text-muted-foreground">{t("installment_stats_remaining_count", { count: row.futureCount })}</span>
                          </>
                        ) : <span className="text-muted-foreground">{t("installment_stats_final")}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <th scope="row" className="px-5 py-4 font-semibold">{t("loans_sum")}</th>
                  <td className="px-5 py-4 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{money(total)}</td>
                  <td className="px-5 py-4 text-muted-foreground">{t("installment_stats_purchase_count", { count: purchases.length })}</td>
                  <td className={cn("px-5 py-4 font-semibold tabular-nums", future > 0 ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground")}>{money(future)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
