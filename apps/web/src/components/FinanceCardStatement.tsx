import { Pencil, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import type { FinanceCardTransaction, FinanceRow } from "@/lib/finance";
import { parseClipboardAmount } from "@/lib/financeClipboard";
import { financeService } from "@/services/finance";

export function FinanceCardStatement({
  row,
  month,
  monthLabel,
  transactions,
  ledgerAmount,
  today,
  money,
  label,
  pending,
  run,
  undo,
  redo,
  canUndo,
  canRedo,
}: {
  row: FinanceRow;
  month: string;
  monthLabel: string;
  transactions: FinanceCardTransaction[];
  ledgerAmount: number;
  today: string;
  money: (value: number) => string;
  label: (key: string) => string;
  pending: boolean;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const [editing, setEditing] = useState<FinanceCardTransaction | null>(null);
  const [revision, setRevision] = useState(0);
  const [invalid, setInvalid] = useState<"" | "purchase_invalid" | "invalid_card_transaction">("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const reset = () => {
    setEditing(null);
    setRevision((value) => value + 1);
    setInvalid("");
  };
  const total = transactions.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {row.name} · {monthLabel} · {label("card_statement")}
        </DialogTitle>
        <DialogDescription>{label("card_statement_help")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted/40 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label("statement_total")}</p>
          <p className="text-xl font-semibold tabular-nums">{money(total)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label("ledger_amount")}</p>
          <p className="text-lg font-medium tabular-nums">{money(ledgerAmount)}</p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={label("undo")}
            disabled={pending || !canUndo}
            onClick={() => void undo()}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={label("redo")}
            disabled={pending || !canRedo}
            onClick={() => void redo()}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <form
        key={`${editing?.id || "new"}-${revision}`}
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          let amount: number | null;
          try {
            amount = parseClipboardAmount(String(form.get("amount") || ""));
          } catch {
            setInvalid("purchase_invalid");
            return;
          }
          const merchant = String(form.get("merchant") || "").trim();
          if (!merchant) {
            setInvalid("invalid_card_transaction");
            return;
          }
          if (amount === null || amount <= 0) {
            setInvalid("purchase_invalid");
            return;
          }
          setInvalid("");
          void run(() =>
            financeService.save(
              "finance_card_transactions",
              {
                row_id: row.id,
                month,
                date: String(form.get("date")),
                merchant,
                amount,
                notes: String(form.get("notes") || ""),
              },
              editing?.id,
            ),
          ).then((saved) => {
            if (saved) reset();
          });
        }}
      >
        <fieldset disabled={pending} className="space-y-3">
          <h3 className="text-sm font-semibold">
            {label(editing ? "edit_purchase" : "add_purchase")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-[150px_1fr_150px]">
            <div className="space-y-1">
              <Label htmlFor="card-date">{label("purchase_date")}</Label>
              <Input
                id="card-date"
                name="date"
                type="date"
                required
                defaultValue={editing?.date || (today.startsWith(month) ? today : `${month}-01`)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="card-merchant">{label("merchant")}</Label>
              <Input
                id="card-merchant"
                name="merchant"
                required
                maxLength={160}
                defaultValue={editing?.merchant || ""}
                aria-invalid={invalid === "invalid_card_transaction" || undefined}
                onChange={() => setInvalid("")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="card-amount">{label("amount")}</Label>
              <Input
                id="card-amount"
                name="amount"
                inputMode="decimal"
                required
                maxLength={32}
                className="text-right tabular-nums"
                defaultValue={editing?.amount.toFixed(2) || ""}
                aria-invalid={invalid === "purchase_invalid" || undefined}
                onChange={() => setInvalid("")}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="card-notes">{label("notes")}</Label>
            <Input
              id="card-notes"
              name="notes"
              maxLength={2000}
              defaultValue={editing?.notes || ""}
            />
          </div>
          {invalid && (
            <p role="alert" className="text-sm text-destructive">
              {label(invalid)}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              {!editing && <Plus className="mr-1 h-4 w-4" />}
              {label(editing ? "save" : "add_purchase")}
            </Button>
            {editing && (
              <Button type="button" size="sm" variant="outline" onClick={reset}>
                {label("cancel")}
              </Button>
            )}
          </div>
        </fieldset>
      </form>
      {transactions.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 text-left">{label("purchase_date")}</th>
                <th className="p-3 text-left">{label("merchant")}</th>
                <th className="p-3 text-right">{label("amount")}</th>
                <th className="p-3">
                  <span className="sr-only">{label("actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...transactions]
                .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
                .map((item) => (
                  <tr key={item.id} className="border-t" title={item.notes || undefined}>
                    <td className="whitespace-nowrap p-3 tabular-nums">
                      {item.date.split("-").reverse().join(".")}
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{item.merchant}</p>
                      {item.notes && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                          {item.notes}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3 text-right tabular-nums">
                      {money(item.amount)}
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`${label("edit")} · ${item.merchant}`}
                          disabled={pending}
                          onClick={() => {
                            setEditing(item);
                            setInvalid("");
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`${label("delete")} · ${item.merchant}`}
                          disabled={pending}
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{label("statement_empty")}</p>
      )}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={dialogDismissHandler(() => setDeleteId(null))}
        title={label("delete_purchase")}
        description={label("delete_purchase_help")}
        onConfirm={() => {
          if (!deleteId || pending) return;
          const id = deleteId;
          void run(() => financeService.remove("finance_card_transactions", id)).then((saved) => {
            if (saved && editing?.id === id) reset();
          });
        }}
      />
    </>
  );
}
