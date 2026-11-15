import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { LoanSummary } from "@/lib/spending";
import { loansService } from "@/services/loans";

export function LoanPaymentDayDialog({ loan, onClose }: {
  loan: LoanSummary; onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(loan.payment_day || 1);
  const mutation = useMutation({
    mutationFn: () => loansService.savePaymentDay(loan.row_id, day),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      onClose();
    },
  });
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("finance_loan_payment_day")}</DialogTitle>
        <DialogDescription>
          <span className="mb-1 block font-medium text-foreground">{loan.name}</span>
          {t("loans_payment_day_help")}
        </DialogDescription>
      </DialogHeader>
      <form className="space-y-4" aria-busy={mutation.isPending} onSubmit={(event) => {
        event.preventDefault();
        if (!mutation.isPending && Number.isInteger(day) && day >= 1 && day <= 31) mutation.mutate();
      }}>
        <div className="space-y-1.5">
          <Label htmlFor="existing-loan-payment-day">{t("finance_loan_payment_day")}</Label>
          <select id="existing-loan-payment-day" required disabled={mutation.isPending}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={day} onChange={(event) => setDay(Number(event.target.value))}>
            {Array.from({ length: 31 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{t("loans_payment_day_failed")}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" disabled={mutation.isPending}>{t("save")}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
