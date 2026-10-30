import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidISODate } from "@/lib/dateInput";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { parseClipboardAmount } from "@/lib/financeClipboard";
import type { SpendingEvent } from "@/lib/spending";
import { billsService } from "@/services/bills";

export function ManualBillDialog({
  month,
  bill,
  onClose,
  onSaved,
}: {
  month: string;
  bill?: SpendingEvent;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(bill?.name || "");
  const [date, setDate] = useState(bill?.date || `${month}-01`);
  const [amount, setAmount] = useState(bill ? String(bill.amount) : "");
  const [currency, setCurrency] = useState(bill?.currency || "TRY");
  const [status, setStatus] = useState<"planned" | "settled">(
    bill?.status === "settled" ? "settled" : "planned",
  );
  const [notes, setNotes] = useState(bill?.notes || "");
  const queryClient = useQueryClient();
  let parsed: number | null = null;
  try {
    parsed = parseClipboardAmount(amount);
  } catch {
    /* Invalid amounts cannot be submitted. */
  }
  const valid =
    !!name.trim() &&
    name.length <= 250 &&
    isValidISODate(date) &&
    date >= "1970-01-01" &&
    date <= "2200-12-31" &&
    parsed != null &&
    parsed > 0;
  const mutation = useMutation({
    mutationFn: () =>
      billsService.save(
        { name: name.trim(), date, amount: parsed!, currency, status, notes: notes.trim() },
        bill?.manual_bill_id,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["spending"] });
      onClose();
      onSaved?.();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={dialogDismissHandler(onClose, mutation.isPending)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(bill ? "spending_edit_bill" : "spending_add_bill")}</DialogTitle>
          <DialogDescription>{t("spending_manual_bill_help")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !mutation.isPending) mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="manual-bill-name">{t("spending_bill_name")}</Label>
            <Input
              id="manual-bill-name"
              autoFocus
              value={name}
              maxLength={250}
              disabled={mutation.isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-bill-date">{t("statement_date")}</Label>
            <Input
              id="manual-bill-date"
              type="date"
              min="1970-01-01"
              max="2200-12-31"
              value={date}
              disabled={mutation.isPending}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="manual-bill-amount">{t("statement_amount")}</Label>
              <Input
                id="manual-bill-amount"
                inputMode="decimal"
                placeholder="1.250,50"
                value={amount}
                disabled={mutation.isPending}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-bill-currency">{t("currency")}</Label>
              <select
                id="manual-bill-currency"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={currency}
                disabled={mutation.isPending}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {[...new Set(["TRY", "USD", "EUR", "GBP", currency])].map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-bill-status">{t("spending_bill_status")}</Label>
            <select
              id="manual-bill-status"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={status}
              disabled={mutation.isPending}
              onChange={(event) => setStatus(event.target.value as "planned" | "settled")}
            >
              <option value="planned">{t("spending_status_planned")}</option>
              <option value="settled">{t("spending_status_settled")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-bill-notes">{t("spending_bill_notes")}</Label>
            <Textarea
              id="manual-bill-notes"
              value={notes}
              maxLength={2000}
              disabled={mutation.isPending}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("spending_bill_failed")}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {t("finance_save")}
            </Button>
            <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onClose}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
