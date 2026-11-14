import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinanceCurrencyValue } from "@/contexts/FinanceCurrencyContext";
import { readRentPeriod, type RentPeriod } from "@/lib/loanPeriod";
import { formatNumber } from "@/lib/numberFormat";
import { toast } from "@/lib/toast";

export function RentPeriodFields({ initial }: { initial?: Partial<RentPeriod> }) {
  const { t } = useTranslation();
  const currency = useFinanceCurrencyValue();
  const [amount, setAmount] = useState(() => initial?.rent_amount && currency.available
    ? formatNumber(currency.toDisplay(initial.rent_amount)!, { maximumFractionDigits: currency.precision }) : "");
  const [start, setStart] = useState(initial?.rent_start_date || "");
  const [end, setEnd] = useState(initial?.rent_end_date || "");
  return <div className="grid gap-3 sm:grid-cols-2">
    <div className="space-y-1.5">
      <Label htmlFor="rent-start-date">{t("finance_rent_start_date")}</Label>
      <DatePicker id="rent-start-date" name="rent_start_date" label={t("finance_rent_start_date")}
        value={start} onChange={setStart} required min="1970-01-01" max={end || "2200-12-31"} />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="rent-end-date">{t("finance_rent_end_date")}</Label>
      <DatePicker id="rent-end-date" name="rent_end_date" label={t("finance_rent_end_date")}
        value={end} onChange={setEnd} required min={start || "1970-01-01"} max="2200-12-31" />
    </div>
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor="rent-amount">{t("finance_rent_amount")} ({currency.currency})</Label>
      <Input id="rent-amount" name="rent_amount" inputMode="decimal" required disabled={!currency.available}
        value={amount} onChange={(event) => setAmount(event.target.value)} />
    </div>
    <p className="text-xs text-muted-foreground sm:col-span-2">{t("finance_rent_period_help")}</p>
  </div>;
}

export function RentPeriodDialog({ initial, pending, onClose, onSave }: {
  initial?: Partial<RentPeriod>; pending: boolean; onClose: () => void; onSave: (period: RentPeriod) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const currency = useFinanceCurrencyValue();
  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{t("finance_rent_period")}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        try { void onSave(readRentPeriod(new FormData(event.currentTarget), currency)).catch(() => {}); }
        catch { toast.error(t("finance_rent_period_invalid")); }
      }}>
        <fieldset disabled={pending}><RentPeriodFields initial={initial} /></fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" disabled={pending || !currency.available}>{t("save")}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
