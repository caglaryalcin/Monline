import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { FinanceCardPaymentComparison } from "@/components/FinanceCardPaymentComparison";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import client from "@/lib/client";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import type { FinanceRow, FinanceStatementLink } from "@/lib/finance";
import { resolveLocale } from "@/lib/locale";
import { spendingKey } from "@/lib/spending";
import { type SavedStatement, STATEMENT_BANKS } from "@/lib/statements";
import { financeService } from "@/services/finance";

export function FinanceStatementLinkDialog({
  userId,
  row,
  month,
  monthLabel,
  links,
  onClose,
}: {
  userId: string;
  row: FinanceRow;
  month: string;
  monthLabel: string;
  links: FinanceStatementLink[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const label = (key: string) => t(`finance_${key}`);
  const current = links.find((link) => link.row_id === row.id && link.month === month);
  const [selected, setSelected] = useState(current?.statement_id || "");
  const [allowMonthBoundary, setAllowMonthBoundary] = useState(!!current?.allow_month_boundary);
  const queryClient = useQueryClient();
  const archive = useQuery({
    queryKey: ["bank-statements", userId, "link", "all-periods"],
    queryFn: () =>
      client
        .collection("bank_statements")
        .getFullList<Pick<SavedStatement, "id" | "bank" | "period" | "file_name">>({
          sort: "-period,bank,-created",
          fields: "id,bank,period,file_name",
        }),
    enabled: !!userId,
    staleTime: 0,
  });
  const periodFormatter = new Intl.DateTimeFormat(resolveLocale(i18n), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const previousMonth = new Date(`${month}-01T12:00:00Z`);
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const statementGroups = [
    {
      label: t("finance_statement_same_month", { month: monthLabel }),
      statements: (archive.data ?? []).filter((saved) => saved.period === month),
    },
    {
      label: label("statement_other_months"),
      statements: (archive.data ?? []).filter((saved) => saved.period !== month),
    },
  ];
  const mutation = useMutation({
    mutationFn: (statementId: string) =>
      financeService.save(
        "finance_statement_links",
        { row_id: row.id, month, statement_id: statementId, allow_month_boundary: allowMonthBoundary },
        current?.id,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance", userId] });
      await queryClient.invalidateQueries({ queryKey: spendingKey(userId) });
      onClose();
    },
  });
  const comparison = useQuery({
    queryKey: ["finance-card-payment-check", userId, row.id, month, selected, allowMonthBoundary],
    queryFn: () => financeService.checkCardPayment(row.id, selected, month, allowMonthBoundary),
    enabled: !!selected,
    staleTime: 0,
    gcTime: 0,
  });
  const error =
    mutation.error instanceof Error ? mutation.error.message.replace(/^finance_/, "") : "error";
  return (
    <Dialog open onOpenChange={dialogDismissHandler(onClose, mutation.isPending)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {label("link_statement")} · {row.name} · {monthLabel}
          </DialogTitle>
          <DialogDescription>{label("link_statement_help")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected && !mutation.isPending)
              mutation.mutate(selected);
          }}
        >
          <div className="space-y-1 rounded-xl border bg-muted/20 p-3 text-sm">
            <p className="font-medium">
              {t("finance_card_payment_ledger_period", { month: monthLabel })}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("finance_statement_cycle_example", {
                previousMonth: periodFormatter.format(previousMonth),
                month: monthLabel,
              })}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="finance-statement-source">{label("statement_payment_source")}</Label>
            <select
              id="finance-statement-source"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selected}
              disabled={archive.isPending || archive.isError || mutation.isPending}
              onChange={(event) => {
                setSelected(event.target.value);
                setAllowMonthBoundary(false);
                mutation.reset();
              }}
            >
              <option value="">{label("choose_statement")}</option>
              {statementGroups.filter((group) => group.statements.length > 0).map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.statements.map((saved) => {
                    const used = links.some(
                      (link) => link.statement_id === saved.id && link.id !== current?.id,
                    );
                    return (
                      <option key={saved.id} value={saved.id} disabled={used}>
                        {saved.bank ? STATEMENT_BANKS[saved.bank] : t("statement_auto_bank")} ·{" "}
                        {periodFormatter.format(new Date(`${saved.period}-01T12:00:00Z`))} ·{" "}
                        {saved.file_name}
                        {used ? ` · ${label("statement_already_linked")}` : ""}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>
          {archive.isPending && (
            <Loader2 aria-label={t("loading")} className="h-4 w-4 animate-spin" />
          )}
          {selected && comparison.isFetching && (
            <Loader2 className="h-4 w-4 animate-spin" aria-label={label("card_payment_loading")} />
          )}
          {selected && !comparison.isFetching && !comparison.isError && comparison.data && (
            <FinanceCardPaymentComparison check={comparison.data} />
          )}
          {selected && !comparison.isError && (comparison.data?.month_boundary_eligible || allowMonthBoundary) && (
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-start gap-2">
                <input
                  id="finance-statement-month-boundary"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  checked={allowMonthBoundary}
                  disabled={comparison.isFetching || mutation.isPending}
                  onChange={(event) => setAllowMonthBoundary(event.target.checked)}
                />
                <Label htmlFor="finance-statement-month-boundary" className="leading-relaxed">
                  {label("accept_month_boundary")}
                </Label>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {label("month_boundary_help")}
              </p>
            </div>
          )}
          {selected && comparison.isError && (
            <p role="alert" className="text-sm text-destructive">
              {label("card_payment_check_error")}
            </p>
          )}
          {archive.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("statement_load_failed")}
            </p>
          )}
          {archive.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">{label("no_statements_to_link")}</p>
          )}
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {label(
                [
                  "statement_link_conflict",
                  "invalid_statement_link",
                  "invalid_month_boundary",
                ].includes(error)
                  ? error
                  : "error",
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={!selected || archive.isError || archive.isPending || mutation.isPending}
            >
              {label("save")}
            </Button>
            <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onClose}>
              {label("cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
