import { Receipt } from "lucide-react";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { StatementLink } from "@/components/StatementLink";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Button } from "@/components/ui/button";
import { MerchantLogosContext } from "@/contexts/MerchantLogosContext";
import { findLogoService } from "@/lib/logoServices";
import { type MerchantLogoTarget,resolveMerchantLogo } from "@/lib/merchantLogo";
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
}: {
  data: SpendingData;
  section: "installments" | "bills";
  search: string;
  month?: string;
  layout?: "grid" | "list";
}) {
  const { t, i18n } = useTranslation();
  const [limit, setLimit] = useState(20);
  const [providerFor, setProviderFor] = useState<({ name: string } & MerchantLogoTarget) | null>(null);
  const { choices } = useContext(MerchantLogosContext);
  const choiceFor = (bill: SpendingData["events"][number]) =>
    resolveMerchantLogo(choices, bill.name, { month: bill.date.slice(0, 7), rowId: bill.provider_row_id });
  const matches = (name: string) => name.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const plans = data.installments.filter(
    (plan) => plan.period === month && matches(`${plan.name} ${plan.card_name}`),
  );
  const billCandidates = data.events
    .filter((event) => isBillRecord(event) && event.date.startsWith(month) && matches(event.name))
    .sort((a, b) => b.date.localeCompare(a.date));
  const billIds = new Set(billCandidates.map((event) => event.id));
  const bills = billCandidates.filter(
    (event) => !event.duplicate_of || !billIds.has(event.duplicate_of),
  );
  const money = (amount: number, currency: string) =>
    formatCurrency(amount, currency, { locale: i18n.language.replace("_", "-") });
  const periodName = (period: string) =>
    new Intl.DateTimeFormat(i18n.language.replace("_", "-"), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${period}-01T12:00:00Z`));
  const totals = spendingTotals(section === "installments" ? plans : bills);
  const remainingTotals = spendingTotals(
    plans.map((plan) => ({ currency: plan.currency, amount: plan.remaining_amount })),
  );
  if (section === "installments" && plans.length === 0) return null;

  return (
    <section className="space-y-4" aria-label={t(`spending_${section}_source`)}>
      {totals.length > 0 && (
        <dl className="flex flex-wrap gap-6 rounded-xl border p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">
              {t(
                section === "installments"
                  ? "spending_installments_month_total"
                  : "spending_month_total",
              )}
            </dt>
            <dd className="flex flex-wrap gap-3 font-semibold tabular-nums">
              {totals.map((total) => (
                <span key={total.currency}>{money(total.amount, total.currency)}</span>
              ))}
            </dd>
          </div>
          {section === "installments" && (
            <div>
              <dt className="text-muted-foreground">{t("spending_remaining_amount")}</dt>
              <dd className="flex flex-wrap gap-3 font-semibold tabular-nums">
                {remainingTotals.map((total) => (
                  <span key={total.currency}>{money(total.amount, total.currency)}</span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
      {section === "installments" ? (
        <>
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
                      label={`${plan.card_name ? `${plan.card_name} · ` : ""}${t("spending_installment_statement", { period: periodName(plan.period) })}`}
                    />
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt>{t("spending_installment_progress")}</dt>
                  <dd className="text-right tabular-nums">
                    {plan.current} / {plan.total}
                  </dd>
                  <dt>{t("spending_remaining_count")}</dt>
                  <dd className="text-right tabular-nums">{plan.remaining}</dd>
                  <dt>{t("spending_purchase_total")}</dt>
                  <dd className="text-right tabular-nums">
                    {estimatedInstallmentTotal(plan) == null
                      ? "—"
                      : money(estimatedInstallmentTotal(plan)!, plan.currency)}
                  </dd>
                  <dt>{t("spending_installment_amount")}</dt>
                  <dd className="text-right tabular-nums">{money(plan.amount, plan.currency)}</dd>
                  <dt>{t("spending_remaining_amount")}</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {money(plan.remaining_amount, plan.currency)}
                  </dd>
                  <dt>{t("spending_next_period")}</dt>
                  <dd className="text-right">
                    {plan.remaining ? plan.next_month : t("spending_completed")}
                  </dd>
                </dl>
                <StatementLink
                  statementId={plan.statement_id}
                  className="text-sm text-primary underline underline-offset-4"
                >
                  {t("finance_go_statement")}
                </StatementLink>
                <Button variant="ghost" size="sm" onClick={() => setProviderFor({ name: plan.name })}>
                  {t("spending_provider_change")}
                </Button>
              </article>
            ))}
          </div>
        </>
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
          <div className={layout === "list" ? "space-y-2" : "grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3"}>
            {bills.slice(0, limit).map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
                layout={layout}
                providerName={choiceFor(bill)?.provider_name}
                providerKnown={!!findLogoService(bill.name) || !!choiceFor(bill)}
                onChooseProvider={() => setProviderFor({ name: bill.name, month: bill.date.slice(0, 7), rowId: bill.provider_row_id })}
              />
            ))}
          </div>
          {bills.length > limit && (
            <Button variant="outline" onClick={() => setLimit((value) => value + 20)}>
              {t("spending_show_more")}
            </Button>
          )}
        </>
      )}
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
