import { Lightbulb, Receipt } from "lucide-react";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { MerchantLogosContext } from "@/contexts/MerchantLogosContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { installmentSchedule } from "@/lib/installmentSchedule";
import { findLogoService } from "@/lib/logoServices";
import { type MerchantLogoTarget, resolveMerchantLogo } from "@/lib/merchantLogo";
import {
  currentSpendingMonth,
  estimatedInstallmentTotal,
  isBillRecord,
  type SpendingData,
  spendingTotals,
} from "@/lib/spending";
import { formatCurrency } from "@/lib/utils";

import { BillCard } from "./BillCard";
import { MerchantProviderDialog } from "./MerchantProviderDialog";
import { SubscriptionSourceBadge } from "./SubscriptionSourceBadge";

export function StatementCommitments({
  data,
  section,
  search,
  month = currentSpendingMonth(),
  layout = "grid",
  year,
}: {
  data: SpendingData;
  section: "installments" | "bills";
  search: string;
  month?: string;
  layout?: "grid" | "list";
  year?: number;
}) {
  const { t, i18n } = useTranslation();
  const currentMonth = useLocalToday().slice(0, 7);
  const [limit, setLimit] = useState(20);
  const [providerFor, setProviderFor] = useState<({ name: string } & MerchantLogoTarget) | null>(
    null,
  );
  const { choices } = useContext(MerchantLogosContext);
  const choiceFor = (bill: SpendingData["events"][number]) =>
    resolveMerchantLogo(choices, bill.name, {
      month: bill.date.slice(0, 7),
      rowId: bill.provider_row_id,
    });
  const matches = (name: string) => name.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const plans =
    section === "installments"
      ? installmentSchedule(data, currentMonth).filter(
          (plan) => plan.period === month && matches(`${plan.name} ${plan.card_name}`),
        )
      : [];
  const recordedIds = new Set(data.events.map((event) => event.id));
  const billCandidates = [
    ...data.events,
    ...(data.pending_bills ?? []).filter((bill) => !recordedIds.has(bill.id)),
  ]
    .filter(
      (event) =>
        isBillRecord(event) &&
        event.date.startsWith(year ? `${year}-` : month) &&
        matches(event.name),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const billIds = new Set(billCandidates.map((event) => event.id));
  const bills = billCandidates.filter(
    (event) => !event.duplicate_of || !billIds.has(event.duplicate_of),
  );
  const billGroups = new Map<string, typeof bills>();
  for (const bill of bills.slice(0, limit)) {
    const period = year ? bill.date.slice(0, 7) : "";
    const group = billGroups.get(period) ?? [];
    group.push(bill);
    billGroups.set(period, group);
  }
  const money = (amount: number, currency: string) => formatCurrency(amount, currency, {});
  const periodName = (period: string) =>
    new Intl.DateTimeFormat(i18n.language.replace("_", "-"), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${period}-01T12:00:00Z`));
  const totals = spendingTotals(
    section === "installments" ? plans : bills.filter((bill) => !bill.amount_pending),
  );
  const amountsPending = bills.filter((bill) => bill.amount_pending).length;

  return (
    <section className="space-y-4" aria-label={t(`spending_${section}_source`)}>
      {section === "installments" ? (
        plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("spending_installment_month_empty")}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.id} className="space-y-4 rounded-2xl border p-4">
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white p-1">
                    <SubscriptionLogo
                      sub={{ name: plan.name, url: "" }}
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold break-words">{plan.name}</h3>
                    <SubscriptionSourceBadge
                      source="statement"
                      label={`${plan.card_name ? `${plan.card_name} · ` : ""}${t("spending_installment_statement", { period: periodName(plan.source_period) })}`}
                    />
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt>{t("spending_installment_progress")}</dt>
                  <dd className="text-right tabular-nums">
                    <span className="amount-marker-highlight">
                      {plan.current}/{plan.total}
                    </span>
                  </dd>
                  <dt>{t("spending_remaining_count")}</dt>
                  <dd className="text-right tabular-nums">{plan.remaining}</dd>
                  <dt>{t("spending_installment_amount")}</dt>
                  <dd className="text-right tabular-nums">{money(plan.amount, plan.currency)}</dd>
                  <dt>{t("spending_purchase_total")}</dt>
                  <dd className="text-right tabular-nums">
                    {estimatedInstallmentTotal(plan) == null
                      ? "-"
                      : money(estimatedInstallmentTotal(plan)!, plan.currency)}
                  </dd>
                  <dt>{t("spending_next_period")}</dt>
                  <dd className="text-right">
                    {plan.remaining ? plan.next_month : t("spending_completed")}
                  </dd>
                </dl>
              </article>
            ))}
          </div>
        )
      ) : (
        <>
          {!bills.length && (
            <div className="rounded-2xl border border-dashed bg-card/30 p-12 text-center backdrop-blur-md">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Receipt className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
              </span>
              <p className="text-lg font-medium text-foreground">{t("spending_no_bills")}</p>
            </div>
          )}
          <div className="space-y-4">
            {[...billGroups].map(([period, group], index) => (
              <div key={period || month} className="space-y-3">
                {index > 0 && <Separator className="w-60 max-w-full" />}
                {year && (
                  <h3 className="text-sm font-medium capitalize text-muted-foreground">
                    {periodName(period)}
                  </h3>
                )}
                <div
                  className={
                    layout === "list"
                      ? "space-y-2"
                      : "grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3"
                  }
                >
                  {group.map((bill) => (
                    <BillCard
                      key={bill.id}
                      bill={bill}
                      layout={layout}
                      providerName={choiceFor(bill)?.provider_name}
                      providerKnown={!!findLogoService(bill.name) || !!choiceFor(bill)}
                      onChooseProvider={() =>
                        setProviderFor({
                          name: bill.name,
                          month: bill.date.slice(0, 7),
                          rowId: bill.provider_row_id,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {bills.length > limit && (
            <Button variant="outline" onClick={() => setLimit((value) => value + 20)}>
              {t("spending_show_more")}
            </Button>
          )}
        </>
      )}
      <footer className="flex items-start gap-2 border-t pt-2 text-xs">
        {section === "installments" ? (
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start gap-2">
              <Lightbulb
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <p className="leading-relaxed text-muted-foreground">
                {t("spending_installments_info")}
              </p>
            </div>
            {totals.length > 0 && (
              <dl className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <dt className="text-muted-foreground">{t("spending_installments_month_total")}</dt>
                <dd className="flex flex-wrap gap-x-3 text-sm font-semibold tabular-nums">
                  {totals.map((total) => (
                    <span key={total.currency} className="amount-marker-highlight">
                      {money(total.amount, total.currency)}
                    </span>
                  ))}
                </dd>
              </dl>
            )}
          </div>
        ) : (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-label={t("more_info")}
                  title={t("more_info")}
                >
                  <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="max-w-[calc(100vw-2rem)] p-3 text-xs leading-relaxed text-muted-foreground"
              >
                {t("spending_bills_info")}
              </PopoverContent>
            </Popover>
            <div className="min-w-0 space-y-0.5 pt-0.5">
              {totals.length > 0 && (
                <dl className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <dt className="text-muted-foreground">
                    {t(year ? "spending_year_total" : "spending_month_total")}
                  </dt>
                  <dd className="flex flex-wrap gap-x-3 text-sm font-semibold tabular-nums">
                    {totals.map((total) => (
                      <span
                        key={total.currency}
                        className={!year ? "amount-marker-highlight" : undefined}
                      >
                        {total.currency === "TRY"
                          ? `${total.amount.toFixed(2)}TL`
                          : money(total.amount, total.currency)}
                      </span>
                    ))}
                  </dd>
                </dl>
              )}
              {amountsPending > 0 && (
                <p className="leading-relaxed text-muted-foreground">
                  {t("spending_bills_amounts_pending", { count: amountsPending })}
                </p>
              )}
            </div>
          </>
        )}
      </footer>
      {providerFor && (
        <MerchantProviderDialog
          key={`${providerFor.name}-${providerFor.month}-${providerFor.rowId}`}
          {...providerFor}
          onClose={() => setProviderFor(null)}
        />
      )}
    </section>
  );
}
