import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinanceCurrencyValue } from "@/contexts/FinanceCurrencyContext";
import { type LoanPeriod, readLoanPeriod } from "@/lib/loanPeriod";
import { formatNumber } from "@/lib/numberFormat";
import { toast } from "@/lib/toast";

export function LoanPeriodFields({ initial }: { initial?: Partial<LoanPeriod> }) {
  const { t } = useTranslation();
  const currency = useFinanceCurrencyValue();
  const [installment, setInstallment] = useState(() => initial?.loan_installment_amount && currency.available
    ? formatNumber(currency.toDisplay(initial.loan_installment_amount)!, { maximumFractionDigits: currency.precision }) : "");
  const [start, setStart] = useState(initial?.loan_start_date || "");
  const [end, setEnd] = useState(initial?.loan_end_date || "");
  return <div className="grid gap-3 sm:grid-cols-2">
    <div className="space-y-1.5">
      <Label htmlFor="loan-start-date">{t("finance_loan_start_date")}</Label>
      <DatePicker id="loan-start-date" name="loan_start_date" label={t("finance_loan_start_date")}
        required min="1970-01-01" max={end || "2200-12-31"} value={start} onChange={setStart} />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="loan-end-date">{t("finance_loan_end_date")}</Label>
      <DatePicker id="loan-end-date" name="loan_end_date" label={t("finance_loan_end_date")}
        required min={start || "1970-01-01"} max="2200-12-31" value={end} onChange={setEnd} />
    </div>
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor="loan-installment-amount">{t("finance_loan_installment_amount")} ({currency.currency})</Label>
      <Input id="loan-installment-amount" name="loan_installment_amount" inputMode="decimal" required
        disabled={!currency.available} value={installment} onChange={(event) => setInstallment(event.target.value)} />
    </div>
    <p className="text-xs text-muted-foreground sm:col-span-2">{t("finance_loan_period_help")}</p>
  </div>;
}

export function LoanPeriodDialog({ initial, pending, onClose, onSave }: {
  initial?: Partial<LoanPeriod>; pending: boolean; onClose: () => void;
  onSave: (period: LoanPeriod) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const currency = useFinanceCurrencyValue();
  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{t("finance_loan_period")}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try { void onSave(readLoanPeriod(form, currency)).catch(() => {}); }
        catch { toast.error(t("finance_loan_period_invalid")); }
      }}>
        <fieldset disabled={pending}><LoanPeriodFields initial={initial} /></fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" disabled={pending || !currency.available}>{t("save")}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
