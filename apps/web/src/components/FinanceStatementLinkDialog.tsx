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
  const { t } = useTranslation();
  const label = (key: string) => t(`finance_${key}`);
  const current = links.find((link) => link.row_id === row.id && link.month === month);
  const [selected, setSelected] = useState(current?.statement_id || "");
  const queryClient = useQueryClient();
  const archive = useQuery({
    queryKey: ["bank-statements", userId, "link", month],
    queryFn: () =>
      client
        .collection("bank_statements")
        .getFullList<Pick<SavedStatement, "id" | "bank" | "period" | "file_name">>({
          filter: `period = "${month}"`,
          sort: "bank,-created",
          fields: "id,bank,period,file_name",
        }),
  });
  const mutation = useMutation({
    mutationFn: async (
      action: { type: "unlink"; id: string } | { type: "link"; statementId: string },
    ) => {
      if (action.type === "unlink")
        return financeService.remove("finance_statement_links", action.id);
      return financeService.save(
        "finance_statement_links",
        { row_id: row.id, month, statement_id: action.statementId },
        current?.id,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance", userId] });
      await queryClient.invalidateQueries({ queryKey: spendingKey(userId) });
      onClose();
    },
  });
  const comparison = useQuery({
    queryKey: ["finance-card-payment-check", userId, row.id, selected],
    queryFn: () => financeService.checkCardPayment(row.id, selected),
    enabled: !!selected,
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
              mutation.mutate({ type: "link", statementId: selected });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="finance-statement-source">{label("uploaded_statement")}</Label>
            <select
              id="finance-statement-source"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selected}
              disabled={archive.isPending || archive.isError || mutation.isPending}
              onChange={(event) => {
                setSelected(event.target.value);
                mutation.reset();
              }}
            >
              <option value="">{label("choose_statement")}</option>
              {archive.data?.map((saved) => {
                const used = links.some(
                  (link) => link.statement_id === saved.id && link.id !== current?.id,
                );
                return (
                  <option key={saved.id} value={saved.id} disabled={used}>
                    {saved.bank ? STATEMENT_BANKS[saved.bank] : t("statement_auto_bank")} ·{" "}
                    {saved.file_name}
                    {used ? ` · ${label("statement_already_linked")}` : ""}
                  </option>
                );
              })}
            </select>
          </div>
          {archive.isPending && (
            <Loader2 aria-label={t("loading")} className="h-4 w-4 animate-spin" />
          )}
          {selected && comparison.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" aria-label={label("card_payment_loading")} />
          )}
          {selected && comparison.data && <FinanceCardPaymentComparison check={comparison.data} />}
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
            <p className="text-sm text-muted-foreground">{label("no_statement_for_month")}</p>
          )}
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {label(
                [
                  "statement_link_conflict",
                  "statement_period_mismatch",
                  "invalid_statement_link",
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
            {current && (
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ type: "unlink", id: current.id })}
              >
                {label("unlink_statement")}
              </Button>
            )}
            <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onClose}>
              {label("cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
