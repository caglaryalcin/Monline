import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Eye, FileText } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { editablePaymentNotes } from "@/lib/paymentNotes";
import { toast } from "@/lib/toast";
import { formatDate, formatPrice } from "@/lib/utils";
import { paymentRecordsService } from "@/services/paymentRecords";
import type { PaymentRecord, Subscription } from "@/types";

import { pastePaymentProof, PaymentProofField } from "./PaymentProofField";
import { getLogoUrl, toDateOnly, toDateStr } from "./types";

interface MarkAsPaidModalProps {
  mode?: "confirm" | "edit";
  sub: Subscription;
  date: Date;
  userId: string;
  existingRecord: PaymentRecord | undefined;
  onClose: () => void;
  onSaved: () => void;
  t: (k: string) => string;
}

export function MarkAsPaidModal({
  mode = "confirm",
  sub,
  date,
  userId,
  existingRecord,
  onClose,
  onSaved,
  t,
}: MarkAsPaidModalProps) {
  const cur = sub.expand?.currency;
  const dueDate = toDateStr(date);
  const alreadyPaid = !!existingRecord?.paid_at;
  const editing = mode === "edit" || alreadyPaid;

  const [amount, setAmount] = useState(
    existingRecord?.amount != null ? String(existingRecord.amount) : String(sub.price),
  );
  const [notes, setNotes] = useState(editablePaymentNotes(existingRecord?.notes));
  const [proofFile, setProofFile] = useState<File | null>(null);

  const proofUrl = existingRecord ? paymentRecordsService.proofUrl(existingRecord) : null;

  const mut = useMutation({
    mutationFn: async () => {
      const data: Record<string, unknown> = {
        subscription_id: sub.standalone_payment_id ? "" : sub.id,
        user: userId,
        due_date: dueDate,
        paid_at: editing ? (existingRecord?.paid_at ?? "") : new Date().toISOString(),
        auto_paid: editing ? (existingRecord?.auto_paid ?? false) : false,
        amount: Number.isFinite(parseFloat(amount)) ? parseFloat(amount) : sub.price,
        notes,
        name: existingRecord?.name || sub.name,
        currency: existingRecord?.currency || sub.currency,
        category: existingRecord?.category || sub.category || "",
        payment_method: existingRecord?.payment_method || sub.payment_method || "",
        payer: existingRecord?.payer || sub.payer || "",
      };
      if (proofFile) data.proof = proofFile;

      let recordId = existingRecord?.id ?? sub.standalone_payment_id;

      if (!recordId) {
        const candidates = await paymentRecordsService.listForSubscription(sub.id, userId);

        const matched = candidates.find((r) => toDateOnly(r.due_date) === dueDate);
        recordId = matched?.id;
      }

      if (recordId) {
        const saved = await paymentRecordsService.update(recordId, data as Partial<PaymentRecord>);
        if (!saved?.id) throw new Error("Falha ao atualizar registro de pagamento");
        return;
      }

      const saved = await paymentRecordsService.create(data as Partial<PaymentRecord>);
      if (!saved?.id) throw new Error(t("failed_create_payment_record"));
    },
    onSuccess: () => {
      toast.success(t(editing ? "payment_saved" : "marked_as_paid"));
      onSaved();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : t("error"));
    },
  });

  const logo = getLogoUrl(sub);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        onPaste={(event) => pastePaymentProof(event, setProofFile)}
        className="w-[96vw] max-w-3xl max-h-[90vh] overflow-y-auto p-0"
      >
        <DialogHeader className="border-b bg-card/70 backdrop-blur px-6 py-5">
          <DialogTitle className="flex items-center gap-4">
            {logo ? (
              <div className="h-12 w-12 shrink-0 rounded-2xl overflow-hidden border bg-background p-1.5">
                <img src={logo} alt="" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-base font-bold text-primary">
                {sub.name[0]?.toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight truncate">
                {editing ? t("edit_payment") : t("mark_as_paid")}
              </p>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {sub.name} · {formatDate(dueDate)}
              </p>
            </div>

            <Badge variant="outline" className="shrink-0">
              {formatPrice(existingRecord?.amount ?? sub.price, cur?.symbol ?? "$", {
                currencyCode: cur?.code,
              })}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="paid-amount">{t("amount")}</Label>
                <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30">
                  <span className="text-sm text-muted-foreground shrink-0">
                    {cur?.symbol ?? "$"}
                  </span>
                  <input
                    id="paid-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={mut.isPending}
                    className="flex-1 bg-transparent text-sm font-medium outline-none disabled:opacity-60"
                  />
                  {cur?.code && (
                    <span className="text-xs text-muted-foreground shrink-0 font-medium">
                      {cur.code}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="paid-notes">{t("notes")}</Label>
                <Textarea
                  id="paid-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={mut.isPending}
                  placeholder={t("optional")}
                  rows={5}
                  className="resize-none rounded-xl"
                />
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <Label>{t("payment_proof")}</Label>

              {proofUrl ? (
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-primary transition-colors"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate" title={existingRecord?.proof}>
                    {existingRecord?.proof}
                  </span>
                  <Eye className="h-4 w-4 shrink-0" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">{t("no_proof")}</p>
              )}
              <PaymentProofField file={proofFile} onChange={setProofFile} t={t} />
            </div>
          </div>

          <div className="flex gap-2 justify-end border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              {t("close")}
            </Button>
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className="bg-green-600 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {mut.isPending ? t("saving") : t(editing ? "save_changes" : "confirm_payment")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
