import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { StatementCategoryChart } from "@/components/statements/StatementCategoryChart";
import { statementReport } from "@/lib/statementReport";
import { type StatementAccountSummary, type StatementTransaction } from "@/lib/statements";
import { cn, formatCurrency } from "@/lib/utils";

const summaryColors = {
  previous_balance: "text-slate-600 dark:text-slate-300",
  payments: "text-emerald-700 dark:text-emerald-300",
  purchases: "text-sky-700 dark:text-sky-300",
  cash: "text-orange-700 dark:text-orange-300",
  fees: "text-amber-700 dark:text-amber-300",
  balance: "text-rose-700 dark:text-rose-300",
  minimum_payment: "text-violet-700 dark:text-violet-300",
};

export function StatementOverview({
  rows,
  summary,
  excluded,
  onSubscriptions,
  canImport,
}: {
  rows: StatementTransaction[];
  summary: StatementAccountSummary;
  excluded?: StatementTransaction[];
  onSubscriptions: () => void;
  canImport: boolean;
  bank?: string;
}) {
  const { t, i18n } = useTranslation();
  const groups = useMemo(() => statementReport(rows, summary, excluded), [rows, summary, excluded]);
  const money = (value: number, currency = "TRY") =>
    formatCurrency(value, currency, { locale: i18n.language.replace("_", "-") });
  const fields = [
    "previous_balance",
    "payments",
    "purchases",
    "cash",
    "fees",
    "balance",
  ] as const;
  const equation = [
    summary.previous_balance,
    summary.payments,
    summary.purchases,
    summary.cash,
    summary.fees,
    summary.balance,
  ];
  const balanceDifference = equation.every((value) => value !== undefined)
    ? Math.round(summary.previous_balance! * 100) -
      Math.round(summary.payments! * 100) +
      Math.round(summary.purchases! * 100) +
      Math.round(summary.cash! * 100) +
      Math.round(summary.fees! * 100) -
      Math.round(summary.balance! * 100)
    : null;
  const mismatch = balanceDifference !== null && balanceDifference !== 0;
  return (
    <div className="space-y-4">
      {Object.keys(summary).length > 0 && (
        <section className="rounded-2xl border p-4" aria-label={t("statement_account_summary")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-sm font-semibold">{t("statement_account_summary")}</h3>
            {summary.minimum_payment !== undefined && <dl className="text-right">
              <dt className="text-xs text-muted-foreground">{t("statement_summary_minimum_payment")}</dt>
              <dd className={cn("mt-1 text-base font-semibold tabular-nums", summaryColors.minimum_payment)}>{money(summary.minimum_payment)}</dd>
            </dl>}
          </div>
          <div className="mt-4 overflow-x-auto pb-1">
            <div role="group" aria-label={t("statement_balance_formula_help")} className="flex min-w-[64rem] items-stretch gap-2 xl:min-w-0">
              {fields.map((key, index) => (
                <Fragment key={key}>
                  {index > 0 && <span className="flex shrink-0 items-center justify-center text-xl font-medium text-muted-foreground" aria-hidden="true">
                    {key === "payments" ? "−" : key === "balance" ? "=" : "+"}
                  </span>}
                  <dl className={cn("flex min-w-0 flex-1 flex-col justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 p-3",
                    key === "balance" && "border-rose-500/25 bg-rose-500/5")}>
                    <dt className="text-xs leading-relaxed text-muted-foreground">{t(`statement_summary_${key}`)}</dt>
                    <dd className={cn("whitespace-nowrap text-base font-semibold tabular-nums", summaryColors[key], key === "balance" && "font-bold")}>
                      {summary[key] === undefined ? "—" : money(summary[key])}
                    </dd>
                  </dl>
                </Fragment>
              ))}
            </div>
          </div>
          {mismatch && (
            <p role="status" className="mt-3 text-sm text-amber-700 dark:text-amber-400">
              {t("statement_summary_mismatch")}
            </p>
          )}
        </section>
      )}
      <section className="space-y-4" aria-label={t("statement_category_summary")}>
        <h3 className="font-semibold">{t("statement_category_summary")}</h3>
        {[...new Set(groups.map((group) => group.currency))]
          .sort((a, b) => (a === "TRY" ? -1 : b === "TRY" ? 1 : a.localeCompare(b)))
          .map((currency) => {
            const currencyGroups = groups.filter((group) => group.currency === currency);
            return (
              <StatementCategoryChart
                key={JSON.stringify(currencyGroups)}
                currency={currency}
                groups={currencyGroups}
                canImport={canImport}
                onSubscriptions={onSubscriptions}
              />
            );
          })}
        {groups.length === 0 && <p className="text-sm text-muted-foreground">{t("no_results")}</p>}
      </section>
    </div>
  );
}
