import { Github } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import type { StatementAccountingInspection, StatementReconciliationCheck } from "../../../backend/src/domain/lib/pure/statement-accounting.mjs";

export function StatementReconciliationNotice({ checks, inspection, money, viewing, busy, accepted, onAcceptedChange }: {
  checks: StatementReconciliationCheck[];
  inspection?: StatementAccountingInspection;
  money: (amount: number, currency: string) => string;
  viewing: boolean;
  busy: boolean;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
}) {
  const { t } = useTranslation();
  if (inspection?.status === "verified" || (!inspection && !checks.length)) return null;
  const incomplete = inspection?.status === "incomplete";
  return <section role="alert" className="space-y-3 rounded-xl border border-amber-500/40 p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold">{t(incomplete ? "statement_totals_unverified" : "statement_totals_mismatch")}</h3>
      <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
        <a
          href={`https://github.com/caglaryalcin/Monline/issues/new?${new URLSearchParams({ title: t(incomplete ? "statement_totals_unverified" : "statement_totals_mismatch") })}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github className="h-4 w-4" aria-hidden="true" />
          {t("statement_reconciliation_report_issue")}
        </a>
      </Button>
    </div>
    {!!inspection?.issues.length && <ul className="space-y-1 text-xs text-muted-foreground">
      {inspection.issues.map((issue) => <li key={issue}>{t(`statement_verification_issue_${issue}`)}</li>)}
    </ul>}
    {checks.map((check) => <div key={check.key} className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
      <h4 className="font-medium">{t(check.key === "payments" ? "statement_summary_payments" : `statement_verification_check_${check.key}`)}</h4>
      <dl className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
        {[
          ["statement_reconciliation_pdf", check.expected],
          [check.key === "summary_balance" ? "statement_verification_from_summary" : "statement_reconciliation_calculated", check.actual],
          ["statement_duplicates_difference", Math.abs(check.difference)],
        ].map(([key, amount]) => <div key={String(key)}>
          <dt className="text-xs text-muted-foreground">{t(String(key))}</dt>
          <dd className="mt-1 font-semibold tabular-nums">{money(Number(amount), "TRY")}</dd>
        </div>)}
      </dl>
    </div>)}
    {!viewing && <details className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer">{t(incomplete ? "statement_verification_override" : "statement_reconciliation_override")}</summary>
      <label className="mt-3 flex items-start gap-2 leading-relaxed">
        <input type="checkbox" checked={accepted} disabled={busy} onChange={(event) => onAcceptedChange(event.target.checked)} />
        {t(incomplete ? "statement_verification_confirm" : "statement_reconciliation_confirm")}
      </label>
    </details>}
  </section>;
}
