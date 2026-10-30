import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { StatementLink } from "@/components/StatementLink";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import type { FinanceEntry, FinanceRow } from "@/lib/finance";
import { resolveLocale } from "@/lib/locale";
import { spendingKey } from "@/lib/spending";
import { formatCurrency } from "@/lib/utils";
import { type BudgetEvent, budgetService } from "@/services/budget";

/** The selected ledger cell is the scope; no independent budget workspace is needed. */
export function FinanceVerificationDialog({
  userId,
  row,
  month,
  monthLabel,
  entries,
  onCardPayment,
  onClose,
}: {
  userId: string;
  row: FinanceRow;
  month: string;
  monthLabel: string;
  entries: FinanceEntry[];
  onCardPayment?: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const label = (key: string) => t(`finance_${key}`);
  const queryClient = useQueryClient();
  const queryKey = ["finance-verification", userId, month];
  const query = useQuery({ queryKey, queryFn: () => budgetService.get(month) });
  const lock = useRef(false);
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ["finance", userId] }),
        queryClient.invalidateQueries({ queryKey: spendingKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ["budget"] }),
      ]);
    },
  });
  const run = async (action: () => Promise<unknown>) => {
    if (lock.current || query.isFetching) return;
    lock.current = true;
    try {
      await mutation.mutateAsync(action);
    } catch {
      // Keep the selected cell and candidates available for correction or retry.
    } finally {
      lock.current = false;
    }
  };
  const busy = mutation.isPending || query.isFetching;
  const money = (amount: number, currency: string) =>
    formatCurrency(amount, currency, { locale: resolveLocale(i18n) });
  const ids = new Set(
    entries
      .filter((entry) => entry.row_id === row.id && entry.date.startsWith(month))
      .map((entry) => `ledger:${entry.id}`),
  );
  const targets = (query.data?.targets || []).filter(
    (target) => ids.has(target.id) && target.date.startsWith(month),
  );
  return (
    <Dialog
      open
      onOpenChange={dialogDismissHandler(onClose, mutation.isPending)}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {row.name} · {monthLabel} · {label("verify_cell")}
          </DialogTitle>
          <DialogDescription>{label("verify_cell_help")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <p role="status">{label("loading")}</p>
        ) : query.isError ? (
          <div role="alert" className="space-y-2">
            <p>{label("verification_load_error")}</p>
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {label("retry")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {onCardPayment &&
              !row.payment_card &&
              targets.some((target) => target.verification !== "verified") &&
              !targets.some(
                (target) =>
                  matchingTransactions(target, query.data?.statements || [], month).length,
              ) && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <p>{label("card_payment_match_help")}</p>
                  <Button variant="outline" disabled={busy} onClick={onCardPayment}>
                    {label("match_card_payment")}
                  </Button>
                </div>
              )}
            {targets.length === 0 && <p>{label("verification_no_entries")}</p>}
            {targets.map((target) => (
              <VerificationEntry
                key={target.id}
                target={target}
                candidates={query.data?.statements || []}
                month={month}
                label={label}
                money={money}
                busy={busy}
                run={run}
              />
            ))}
          </div>
        )}
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {label("verification_error")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function matchingTransactions(target: BudgetEvent, candidates: BudgetEvent[], month: string) {
  return candidates.filter(
    (source) =>
      source.statement_id &&
      source.currency === target.currency &&
      Math.round(source.amount * 100) === Math.round(target.amount * 100) &&
      (source.date.startsWith(month) || source.statement_period === month) &&
      (!target.card_row_id || source.card_row_id === target.card_row_id) &&
      (!source.verified_target_id || source.verified_target_id === target.id),
  );
}

function VerificationEntry({
  target,
  candidates,
  month,
  label,
  money,
  busy,
  run,
}: {
  target: BudgetEvent;
  candidates: BudgetEvent[];
  month: string;
  label: (key: string) => string;
  money: (amount: number, currency: string) => string;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [chosen, setChosen] = useState("");
  const options = matchingTransactions(target, candidates, month);
  const source = options.find((item) => item.id === chosen);
  const verified = target.verification === "verified";
  return (
    <article className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>
          {target.date} · {money(target.amount, target.currency)}
        </span>
        <span
          className={verified ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}
        >
          {label(
            verified
              ? "statement_verified"
              : target.verification === "changed"
                ? "statement_changed"
                : "verification_pending",
          )}
        </span>
      </div>
      {target.verified_statement_id && (
        <StatementLink statementId={target.verified_statement_id} className="text-xs underline">
          {label("go_statement")}
        </StatementLink>
      )}
      {!verified && (
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={`${target.date} · ${money(target.amount, target.currency)} · ${label("choose_transaction")}`}
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            value={chosen}
            disabled={busy}
            onChange={(event) => setChosen(event.target.value)}
          >
            <option value="">
              {label(options.length ? "choose_transaction" : "no_transaction")}
            </option>
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.date} · {item.name} · {money(item.amount, item.currency)} ·{" "}
                {item.card_name || item.statement_period}
              </option>
            ))}
          </select>
          <Button
            disabled={busy || !source}
            onClick={() => {
              if (!source?.statement_id) return;
              void run(() =>
                budgetService.match({
                  month,
                  target_type: "finance_entries",
                  target_id: target.id.slice("ledger:".length),
                  statement_id: source.statement_id!,
                  transaction_id: source.id.slice(`statement:${source.statement_id}:`.length),
                }),
              );
            }}
          >
            {label("verify_cell")}
          </Button>
        </div>
      )}
      {target.match_id && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void run(() => budgetService.unmatch(target.match_id!))}
        >
          {label("unverify_cell")}
        </Button>
      )}
      {!verified && !options.length && (
        <p className="text-xs text-muted-foreground">{label("no_transaction_help")}</p>
      )}
    </article>
  );
}
