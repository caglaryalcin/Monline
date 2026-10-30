import { Check, ChevronRight, Landmark, Lightbulb } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import type { LoanSummary } from "@/lib/spending";
import { cn, formatCurrency } from "@/lib/utils";

import { SubscriptionSourceBadge } from "./SubscriptionSourceBadge";

function isCompleted(loan: LoanSummary) {
  return loan.total_installments > 0 &&
    loan.remaining_installments === 0 && Math.round(loan.remaining_amount * 100) === 0;
}

export function LoansSection({
  loans,
  month,
  search,
}: {
  loans: LoanSummary[];
  month: string;
  search: string;
}) {
  const { t, i18n } = useTranslation();
  const [expandedCompleted, setExpandedCompleted] = useState<Record<string, boolean>>({});
  const locale = i18n.language.replace("_", "-");
  const money = (amount: number) =>
    formatCurrency(amount, "TRY" , { locale: locale });
  const monthName = (value: string) =>
    new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${value}-01T12:00:00Z`),
    );
  const visible = loans.filter((loan) =>
    loan.name.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)),
  );
  const active = visible.filter((loan) => !isCompleted(loan));
  const completed = visible.filter(isCompleted);
  const annual = new Map<string, {
    total: number;
    paid: number;
    remaining: number;
    installments: number;
    paidInstallments: number;
    remainingInstallments: number;
    loanIds: Set<string>;
    paidLoanIds: Set<string>;
  }>();
  for (const loan of visible) {
    for (const payment of loan.months) {
      const year = payment.month.slice(0, 4);
      const summary = annual.get(year) ?? {
        total: 0, paid: 0, remaining: 0,
        installments: 0, paidInstallments: 0, remainingInstallments: 0,
        loanIds: new Set<string>(),
        paidLoanIds: new Set<string>(),
      };
      summary.total += Math.round(payment.amount * 100);
      summary.paid += Math.round(payment.paid_amount * 100);
      if (payment.paid_amount > 0) summary.paidLoanIds.add(loan.row_id);
      summary.remaining += Math.round(payment.remaining_amount * 100);
      summary.installments++;
      if (payment.status === "settled") summary.paidInstallments++;
      else summary.remainingInstallments++;
      summary.loanIds.add(loan.row_id);
      annual.set(year, summary);
    }
  }
  const yearlyTotals = [...annual.entries()].sort(([a], [b]) => a.localeCompare(b));
  const status = (value: "settled" | "partial" | "planned") => t(`loans_status_${value}`);
  const statusClass = (value: "settled" | "partial" | "planned") =>
    value === "settled"
      ? "text-emerald-700 dark:text-emerald-400"
      : value === "partial"
        ? "text-amber-700 dark:text-amber-400"
        : "text-rose-700 dark:text-rose-400";

  const renderLoan = (loan: LoanSummary, finished: boolean) => {
    const monthsExpanded = !finished || !!expandedCompleted[loan.row_id];
    const start = loan.start_month ?? loan.months[0]?.month;
    const end = loan.end_month ?? loan.months.at(-1)?.month;
    return (
      <article
        key={loan.row_id}
        className={cn(
          "min-w-0 overflow-hidden rounded-2xl border bg-card",
          finished && "bg-muted/40 text-muted-foreground",
        )}
      >
        <div className="space-y-5 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground"
              >
                <Landmark className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h4 className="break-words font-semibold leading-snug">{loan.name}</h4>
                  <span
                    className="rounded-md bg-muted/50 px-2 py-1 text-[11px] font-medium tabular-nums text-muted-foreground"
                    title={t("loans_paid_progress", { paid: loan.paid_installments, total: loan.total_installments })}
                  >
                    {t("loans_month_summary", { total: loan.total_installments, remaining: loan.remaining_installments })}
                    <span className="sr-only">
                      {" · "}{t("loans_paid_progress", { paid: loan.paid_installments, total: loan.total_installments })}
                    </span>
                  </span>
                </div>
                <div className="mt-1"><SubscriptionSourceBadge source="ledger" label={t("loans_source")} /></div>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
                !finished && loan.total_installments > 0 && "border-emerald-500/50",
              )}
            >
              {finished ? (
                <Check className="h-3 w-3" aria-hidden="true" />
              ) : (
                <span className={cn("h-1.5 w-1.5 rounded-full", loan.total_installments > 0 ? "bg-emerald-500" : "bg-amber-500")} aria-hidden="true" />
              )}
              {t(finished ? "loans_completed_status" : loan.total_installments ? "loans_in_progress" : "loans_unplanned")}
            </span>
          </div>

          <p className="text-left text-xs font-medium">
            <span aria-label={t("loans_start")}>{start ? monthName(start) : "—"}</span>
            {" / "}
            <span aria-label={t("loans_end")}>{end ? monthName(end) : "—"}</span>
          </p>
        </div>

        {finished && (
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 border-t px-4 py-3 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
            aria-expanded={monthsExpanded}
            aria-controls={`loan-months-${loan.row_id}`}
            onClick={() => setExpandedCompleted((current) => ({ ...current, [loan.row_id]: !current[loan.row_id] }))}
          >
            {t("loans_month_details")}
            <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", monthsExpanded && "rotate-90")} aria-hidden="true" />
          </button>
        )}
        <div className="overflow-x-auto border-t">
              <table className="w-full whitespace-nowrap text-left text-xs">
                <caption className="sr-only">{t("loans_months_for", { name: loan.name })}</caption>
                <thead hidden={!monthsExpanded} className="bg-muted/30 text-muted-foreground">
                  <tr>
                    {["month", "amount", "status"].map((key) => (
                      <th key={key} scope="col" className="px-4 py-2.5 font-medium">{t(`loans_${key}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody id={`loan-months-${loan.row_id}`} hidden={!monthsExpanded}>
                  {loan.months.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-muted-foreground">{t("loans_unplanned")}</td>
                    </tr>
                  )}
                  {loan.months.map((item) => (
                    <tr key={item.month} className={cn("border-t", item.month === month && "bg-muted/35")}>
                      <th scope="row" className="px-4 py-3 font-medium">{monthName(item.month)}</th>
                      <td className="px-4 py-3 tabular-nums">
                        <span className={cn(
                          item.status === "settled" && statusClass("settled"),
                          item.status === "planned" && !finished && statusClass("planned"),
                        )}>
                          {money(item.amount)}
                        </span>
                        {item.status === "partial" && (
                          <span className={cn("mt-1 block text-[11px]", statusClass("settled"))}>
                            {t("loans_paid")}: {money(item.paid_amount)}
                          </span>
                        )}
                      </td>
                      <td className={cn("px-4 py-3", !finished && statusClass(item.status))}>{status(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/30">
                  <tr>
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {t("loans_sum")}
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        {t("loans_installment_count", { count: loan.total_installments })}
                      </span>
                    </th>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      <span className={cn(finished && statusClass("settled"))}>
                        {money(loan.total_amount)}
                      </span>
                      {!finished && (
                        <span className={cn("mt-1 block text-[11px] font-normal", statusClass("settled"))}>
                          {t("loans_paid")}: {money(loan.paid_amount)}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        {t("loans_installment_count", { count: loan.paid_installments })}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 font-semibold tabular-nums", !finished && statusClass("planned"))}>
                      <span className="mb-1 block text-[11px] font-normal text-muted-foreground">{t("loans_remaining")}</span>
                      {money(loan.remaining_amount)}
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        {t("loans_installment_count", { count: loan.remaining_installments })}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
        </div>
      </article>
    );
  };

  return (
    <section className="space-y-6" aria-label={t("spending_section_loans")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full rounded-xl border bg-muted/10 px-3 py-2 text-xs sm:w-auto sm:max-w-md">
          <p className="flex items-center gap-2 font-medium text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            {t("loans_calculation")}
          </p>
          <p className="pt-2 leading-relaxed text-muted-foreground">{t("loans_help")}</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border bg-muted/10 p-6 text-sm text-muted-foreground">
          {t(loans.length ? "loans_no_results" : "loans_empty")}
        </p>
      ) : (
        <>
          {[
            { key: "active", items: active, finished: false },
            { key: "completed", items: completed, finished: true },
          ].filter((group) => group.items.length > 0).map((group) => (
            <section
              key={group.key}
              aria-label={t(`loans_${group.key}`)}
              className={cn("space-y-3", group.finished && "border-t pt-6")}
            >
              <div className="flex items-center gap-2.5">
                <span className={cn("h-2 w-2 rounded-full", group.finished ? "bg-muted-foreground/50" : "bg-amber-500")} aria-hidden="true" />
                <h3 className="text-sm font-semibold">{t(`loans_${group.key}`)}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {group.items.length}
                </span>
              </div>
              <div className="grid items-start gap-4 xl:grid-cols-2">
                {group.items.map((loan) => renderLoan(loan, group.finished))}
              </div>
            </section>
          ))}
          {yearlyTotals.length > 0 && (
            <section className="space-y-3 border-t pt-6" aria-label={t("loans_yearly_summary")}>
              <h3 className="text-sm font-semibold">{t("loans_yearly_summary")}</h3>
              <div className="overflow-x-auto rounded-2xl border bg-card">
                <table className="w-full whitespace-nowrap text-left text-sm">
                  <caption className="sr-only">{t("loans_yearly_summary")}</caption>
                  <thead className="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">{t("loans_year")}</th>
                      {["paid", "remaining", "total"].map((key) => (
                        <th key={key} scope="col" className="px-5 py-3 font-medium">{t(`loans_${key}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyTotals.map(([year, summary]) => (
                      <tr key={year} className={cn("border-t", year === month.slice(0, 4) && "bg-muted/20")}>
                        <th scope="row" className="px-5 py-4 font-semibold tabular-nums">{year}</th>
                        <td className="px-5 py-4">
                          <span className={cn("font-semibold tabular-nums", statusClass("settled"))}>{money(summary.paid / 100)}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            <Trans
                              i18nKey="loans_credit_installment_summary"
                              values={{ loans: summary.paidLoanIds.size, installments: summary.paidInstallments }}
                              components={{ strong: <strong className="font-bold" /> }}
                            />
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn("font-semibold tabular-nums", summary.remaining > 0 ? statusClass("planned") : "text-muted-foreground")}>
                            {money(summary.remaining / 100)}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {t("loans_installment_count", { count: summary.remainingInstallments })}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-semibold tabular-nums">{money(summary.total / 100)}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {t("loans_count", { count: summary.loanIds.size })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
