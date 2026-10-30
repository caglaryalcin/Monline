import { useTranslation } from "react-i18next";

import type { CardPaymentCheck } from "@/lib/finance";
import { resolveLocale } from "@/lib/locale";
import { cn, formatCurrency } from "@/lib/utils";

export function FinanceCardPaymentComparison({ check, compact = false }: { check: CardPaymentCheck; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n, "tr");
  const money = (amount: number | null) => amount === null ? "—" : formatCurrency(amount, "TRY", { locale });
  const monthName = (month: string) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T12:00:00Z`));
  return <div className={cn("space-y-3 rounded-xl border p-3 text-sm",
    check.status === "matched" ? "border-emerald-500/30 bg-emerald-500/5"
      : check.status === "mismatch" ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-muted/10",
    compact && "space-y-2 rounded-none border-0 bg-transparent p-0 text-xs")}
    role={compact ? undefined : "status"}>
    <p className={cn("font-semibold", check.status === "matched" && "text-emerald-700 dark:text-emerald-400",
      check.status === "mismatch" && "text-rose-700 dark:text-rose-400")}>
      {t(`finance_card_payment_status_${check.status}`)}
    </p>
    <p className="text-xs text-muted-foreground">
      {t("finance_card_payment_period", { month: (check.payment_months?.length ? check.payment_months : [check.ledger_month]).map(monthName).join(" / ") })}
    </p>
    {check.ledger_month !== check.statement_month && <p className="text-xs text-muted-foreground">{t("finance_card_payment_statement_period", { month: monthName(check.statement_month) })}</p>}
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
      <dt>{t("finance_card_payment_ledger")}<span className="block text-[11px] text-muted-foreground">{check.ledger_row_name}</span></dt>
      <dd className="text-right font-medium tabular-nums">{money(check.ledger_amount)}</dd>
      <dt>{t("finance_card_payment_statement")}</dt>
      <dd className="text-right font-medium tabular-nums">{money(check.statement_card_payments ?? null)}</dd>
      {check.difference !== null && <>
        <dt className="border-t pt-2">{t("finance_card_payment_difference")}</dt>
        <dd className="border-t pt-2 text-right font-semibold tabular-nums">{money(Math.abs(check.difference))}</dd>
      </>}
    </dl>
    {check.status === "mismatch" && check.difference !== null && <p className="text-xs text-rose-700 dark:text-rose-400">
      {t(check.difference > 0 ? "finance_card_payment_more" : "finance_card_payment_less", { amount: money(Math.abs(check.difference)) })}
    </p>}
    {check.pending_count > 0 && <p className="text-xs text-muted-foreground">
      {t("finance_card_payment_pending", { amount: money(check.pending_amount) })}
    </p>}
  </div>;
}
