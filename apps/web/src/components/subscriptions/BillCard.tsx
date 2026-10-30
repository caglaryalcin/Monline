import { BadgeCheck, Building2, CalendarDays, Check, Clock, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { StatementLink } from "@/components/StatementLink";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Button } from "@/components/ui/button";
import { resolveLocale } from "@/lib/locale";
import type { SpendingEvent } from "@/lib/spending";
import { cn, formatCurrency } from "@/lib/utils";

import { ManualBillActions } from "./ManualBillActions";
import { SubscriptionSourceBadge } from "./SubscriptionSourceBadge";

export function BillCard({ bill, layout, providerName, providerKnown, onChooseProvider }: {
  bill: SpendingEvent;
  layout: "grid" | "list";
  providerName?: string;
  providerKnown: boolean;
  onChooseProvider: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n);
  const settled = bill.status === "settled";
  const amount = formatCurrency(bill.amount, bill.currency , { locale: locale });
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${bill.date}T12:00:00Z`));
  const providerLabel = t(providerKnown ? "spending_provider_change" : "spending_provider_choose");

  return (
    <article className={cn(
      "group relative min-w-0 overflow-hidden border bg-card/60 backdrop-blur-sm",
      layout === "grid"
        ? "flex flex-col justify-between rounded-2xl p-4 transition-all duration-300"
        : "flex flex-col gap-3 rounded-xl p-3 transition-colors xl:flex-row xl:items-center",
    )}>
      <div className={cn("flex flex-wrap items-start justify-between gap-3", layout === "list" && "min-w-0 flex-1")}>
        <div className="flex min-w-[min(100%,8rem)] flex-1 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background text-xl font-bold shadow-sm">
            <SubscriptionLogo sub={{ name: bill.name, url: "" }} month={bill.date.slice(0, 7)} rowId={bill.provider_row_id} className="h-full w-full object-contain p-1" />
          </span>
          <div className="min-w-0">
            <h3 className={cn("line-clamp-1 font-bold leading-tight", layout === "grid" ? "text-lg" : "text-sm")} title={bill.name}>{bill.name}</h3>
            <div className="mt-1"><SubscriptionSourceBadge source={bill.source} /></div>
            {providerName && <p className="mt-1 truncate text-[11px] text-muted-foreground" title={providerName}>{providerName}</p>}
          </div>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <p className={cn("whitespace-nowrap font-mono text-xl font-extrabold tracking-tight", settled ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>{amount}</p>
          {bill.card_name && <p className="mt-1 max-w-40 truncate text-[11px] text-muted-foreground" title={bill.card_name}>{bill.card_name}</p>}
        </div>
      </div>

      <div className={cn("flex flex-wrap items-center justify-between gap-3", layout === "grid" ? "mt-4 border-t pt-4" : "xl:ml-4 xl:shrink-0")}>
        <div className="space-y-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{date}</span>
          <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
            settled ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400")}>
            {settled ? <Check className="h-3 w-3" aria-hidden="true" /> : <Clock className="h-3 w-3" aria-hidden="true" />}
            {t(`spending_status_${bill.status}`)}
          </span>
          {bill.verification === "verified" && <span className="ml-2 inline-flex text-emerald-700 dark:text-emerald-400" title={t("budget_verified")} aria-label={t("budget_verified")}>
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
          </span>}
        </div>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1 rounded-2xl border bg-background/80 p-1 shadow-sm backdrop-blur sm:rounded-full">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title={providerLabel} aria-label={`${providerLabel} · ${bill.name}`} onClick={onChooseProvider}>
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          {bill.statement_id && <StatementLink statementId={bill.statement_id}
            title={t("finance_go_statement")} aria-label={`${t("finance_go_statement")} · ${bill.name}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </StatementLink>}
          {bill.manual_bill_id && <ManualBillActions bill={bill} compact />}
        </div>
      </div>
    </article>
  );
}
