import { ChevronRight, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { resolveLocale } from "@/lib/locale";
import { cn, formatCurrency } from "@/lib/utils";
import type { StatementDuplicateMatch, StatementDuplicateResult } from "@/services/statementDuplicates";

type DuplicateGroup = {
  incoming: StatementDuplicateMatch["incoming"];
  matches: StatementDuplicateMatch[];
};

export function StatementDuplicateDialog({
  result,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  result: StatementDuplicateResult | null;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n, "tr");
  const money = (value: number, currency: string) => formatCurrency(value, currency, { locale });
  const dateLabel = (value: string, period = false) => {
    const date = new Date(`${value}${period ? "-01" : ""}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, {
      ...(period ? {} : { day: "numeric" as const }), month: "short", year: "numeric", timeZone: "UTC",
    }).format(date);
  };
  const grouped = new Map<string, DuplicateGroup>();
  for (const match of result?.matches || []) {
    const group: DuplicateGroup = grouped.get(match.incoming.id) || { incoming: match.incoming, matches: [] };
    group.matches.push(match);
    grouped.set(match.incoming.id, group);
  }
  const groups = [...grouped.values()];
  const review = groups.filter((group) => group.matches.some((match) => match.kind === "possible_duplicate"));
  const installments = groups.filter((group) => group.matches.every((match) => match.kind === "installment_continuation"));
  const reviewCount = review.reduce((count, group) => count + group.matches.filter((match) => match.kind === "possible_duplicate").length, 0);
  const renderTransaction = (
    record: Omit<StatementDuplicateMatch["incoming"], "page"> & { page?: number },
    number: number,
    source: string,
    metadata: string,
    difference?: number,
  ) => <article key={record.id} aria-label={t("statement_duplicates_transaction", { number })}
    className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/70 bg-muted/10 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", number === 1
        ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
        : "border-border bg-muted/30")}>{t("statement_duplicates_transaction", { number })}</span>
      <span className="text-xs text-muted-foreground">{source}</span>
    </div>
    <div className="min-w-0 space-y-1.5">
      <h3 className="break-words text-sm font-semibold">{record.name}</h3>
      <p className="text-xs text-muted-foreground">{dateLabel(record.date)}{record.page ? ` · ${t("statement_duplicates_pdf_page", { page: record.page })}` : ""}</p>
      {metadata && <p className="text-xs text-muted-foreground">{metadata}</p>}
      {record.installment && <p className="text-xs text-muted-foreground">{t("statement_installment")} <span className="font-medium text-foreground">{record.installment}</span></p>}
    </div>
    <dl className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3">
      <dt className="text-xs text-muted-foreground">{t("statement_duplicates_amount")}</dt>
      <dd className="whitespace-nowrap text-lg font-semibold tabular-nums">{money(record.amount, record.currency)}</dd>
    </dl>
    {difference !== undefined && <p className={cn("text-xs", difference === 0 ? "text-muted-foreground" : "font-medium text-amber-700 dark:text-amber-300")}>
      {difference === 0 ? t("statement_duplicates_same_amount") : `${t("statement_duplicates_difference")}: ${money(Math.abs(difference), record.currency)}`}
    </p>}
  </article>;
  const renderGroup = (group: DuplicateGroup) => {
    const needsReview = group.matches.some((match) => match.kind === "possible_duplicate");
    return <li key={group.incoming.id} className={cn("min-w-0 space-y-3 rounded-xl border p-3", needsReview && "border-amber-500/30")}>
      <p className="text-xs font-medium text-muted-foreground">{t("statement_duplicates_record_count", { count: group.matches.length + 1 })}</p>
      {needsReview && <p className="text-xs leading-relaxed text-muted-foreground">
        {t("statement_duplicates_legitimate_help", { count: group.matches.length + 1 })}{" "}
        <mark className="rounded bg-primary/20 px-1 py-0.5 font-semibold text-foreground">{t("statement_duplicates_legitimate_action")}</mark>
      </p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {renderTransaction(group.incoming, 1, t("statement_duplicates_new"), "")}
        {group.matches.map((match, index) => renderTransaction(match.existing, index + 2,
          t(`statement_duplicates_source_${match.existing.source}`),
          [match.existing.source === "statement" && match.existing.statement_period ? dateLabel(match.existing.statement_period, true) : "", match.existing.card_name].filter(Boolean).join(" · "),
          match.difference,
        ))}
      </div>
    </li>;
  };
  return (
    <Dialog
      open={!!result}
      onOpenChange={dialogDismissHandler(onCancel, busy)}
    >
      <DialogContent aria-describedby={undefined} className="flex max-h-[85dvh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:p-0">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <DialogHeader className="space-y-3 pr-8 text-left">
          <div className="text-sm font-semibold">
            <DialogTitle className="inline text-sm font-semibold leading-normal">{t("statement_duplicates_title")}</DialogTitle>
            {review.length > 0 && <>{" "}<h2 className="inline text-sm font-semibold leading-normal tracking-tight">{t("statement_duplicates_review_heading")}</h2></>}
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            {review.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />{t("statement_duplicates_review_count", { count: reviewCount })}
            </span>}
            {installments.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-sky-700 dark:text-sky-300">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />{t("statement_duplicates_installment_count", { count: installments.length })}
            </span>}
          </div>
        </DialogHeader>
          {review.length > 0 && <section className="space-y-3" aria-label={t("statement_duplicates_review_heading")}>
            <ul className="space-y-3">{review.map(renderGroup)}</ul>
          </section>}
          {installments.length > 0 && <details className="group rounded-xl border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {t("statement_duplicates_installment_count", { count: installments.length })}
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
            </summary>
            <div className="space-y-3 border-t p-4">
              <p className="text-xs leading-relaxed text-muted-foreground">{t("statement_duplicates_installment_help")}</p>
              <ul className="space-y-3">{installments.map(renderGroup)}</ul>
            </div>
          </details>}
        {result?.has_more && (
          <p className="text-sm text-muted-foreground">{t("statement_duplicates_more")}</p>
        )}
        </div>
        <div className="shrink-0 space-y-3 border-t bg-background px-5 py-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            {t("statement_duplicates_back")}
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            {t("statement_duplicates_continue")}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
