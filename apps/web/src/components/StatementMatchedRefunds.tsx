import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { reviewStatementRows } from "@/lib/statementReport";

type MatchedRefund = ReturnType<typeof reviewStatementRows>["matchedRefunds"][number];
type MerchantRefundGroup = ReturnType<typeof reviewStatementRows>["merchantRefundGroups"][number];

export function StatementMatchedRefunds({ matches, groups = [], money }: {
  matches: MatchedRefund[];
  groups?: MerchantRefundGroup[];
  money: (amount: number, currency: string) => string;
}) {
  const { t } = useTranslation();
  const groupedIds = new Set(groups.flatMap((group) => group.refunds.map((refund) => refund.id)));
  const individualMatches = matches.filter((match) => !groupedIds.has(match.refund.id));
  const count = individualMatches.length + groupedIds.size;
  if (!count) return null;
  return <section className="space-y-3 rounded-xl border p-4 text-sm" aria-label={t("statement_matched_refunds_title", { count })}>
    <h3 className="font-medium">{t("statement_matched_refunds_title", { count })}</h3>
    <ul className="space-y-3">
      {groups.map((group) => <li key={group.id}
        className="space-y-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          <div className="min-w-0">
            <p className="break-words font-medium">{group.charges[0].merchant}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("statement_refund_merchant_info")}</p>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("statement_refund_charge_total")}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{money(group.chargeTotal, group.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("statement_refund_refund_total")}</dt>
            <dd className="mt-1 font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">−{money(group.refundTotal, group.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("statement_refund_remaining")}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{money(group.netAmount, group.currency)}</dd>
          </div>
        </dl>
        <details className="border-t border-emerald-500/15 pt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">{t("statement_refund_group_rows", { count: group.charges.length + group.refunds.length })}</summary>
          <ul className="mt-2 space-y-2">
            {[...group.charges, ...group.refunds].map((row) => <li key={row.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 break-words">{row.date} · {row.merchant}{row.installment ? ` · ${row.installment}` : ""}</span>
              <span className="shrink-0 tabular-nums">{row.kind === "refund" ? "−" : ""}{money(row.amount, row.currency)}</span>
            </li>)}
          </ul>
        </details>
      </li>)}
      {individualMatches.map(({ charge, refund, reason, netAmount, originalAmount, originalCurrency }) => <li key={refund.id}
        className="space-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            <div className="min-w-0">
              <p className="break-words font-medium">{refund.merchant}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t(reason === "amount_proximity" ? "statement_refund_proximity_info" : reason === "installment"
                ? "statement_refund_installment_info"
                : netAmount === 0 ? "statement_refund_returned_info" : "statement_refund_difference_info")}</p>
            </div>
          </div>
          <span className="shrink-0 font-semibold tabular-nums">{money(refund.amount, refund.currency)}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{t("statement_kind_charge")}: {money(charge.amount, charge.currency)} · {charge.date}{charge.installment ? ` · ${charge.installment}` : ""}</span>
          <span>{t("statement_kind_refund")}: {money(refund.amount, refund.currency)} · {refund.date}{refund.installment ? ` · ${refund.installment}` : ""}</span>
          {originalCurrency && originalAmount !== undefined && <span>{t("statement_refund_original_amount", { amount: money(originalAmount, originalCurrency) })}</span>}
        </div>
      </li>)}
    </ul>
  </section>;
}
