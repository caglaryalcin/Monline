import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThemedSelect } from "@/components/ui/themed-select";
import { useNumberLocale } from "@/hooks/useNumberLocale";
import { formatNumber, parseNumberInput } from "@/lib/numberFormat";
import {
  isGoldSavingsAsset,
  isSavingsCurrency,
  type Saving,
  SAVINGS_ASSETS,
  type SavingsAsset,
  savingsPrecision,
  type SavingsRates,
  savingsValue,
  validSavingsQuantity,
} from "@/lib/savings";
import { formatCurrency, getCurrencySymbol } from "@/lib/utils";
import { savingsService } from "@/services/savings";

export function SavingsEditor({
  saving, rates, currency = "TRY", onSaved, onCancel, onPendingChange,
}: {
  saving?: Saving;
  rates?: SavingsRates;
  currency?: string;
  onSaved: () => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const { t } = useTranslation();
  const locale = useNumberLocale();
  const [name, setName] = useState(saving?.name || "");
  const [asset, setAsset] = useState<SavingsAsset>(saving?.asset || "GRA");
  const [quantity, setQuantity] = useState(saving
    ? formatNumber(saving.quantity, { useGrouping: false, maximumFractionDigits: 4 }, locale) : "");
  const [notes, setNotes] = useState(saving?.notes || "");
  const [invalid, setInvalid] = useState(false);
  const parsed = /^[\p{Nd}\s.,'’\u066b\u066c]+$/u.test(quantity.trim())
    ? parseNumberInput(quantity, locale) : NaN;
  const valid = validSavingsQuantity(asset, parsed);
  const preview = valid ? savingsValue({ asset, quantity: parsed }, rates, currency) : null;
  const unit = isGoldSavingsAsset(asset)
    ? t(asset === "GRA" ? "savings_unit_gram" : "savings_unit_piece") : asset === "TRY" ? "TL" : asset;
  const assetOptions = [...new Set([
    ...SAVINGS_ASSETS, ...Object.keys(rates?.currency_rates || {}).filter(isSavingsCurrency).sort(), asset,
  ])];
  const save = useMutation({
    mutationFn: () => {
      const value = { name: name.trim(), asset, quantity: parsed, notes };
      return saving ? savingsService.update(saving.id, value) : savingsService.create(value);
    },
    onSuccess: () => { toast.success(t("savings_saved")); onSaved(); },
    onError: (error) => toast.error(t(error.message === "savings_invalid" ? "savings_invalid" : "savings_save_error")),
    onSettled: () => onPendingChange(false),
  });

  return (
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault();
      if (save.isPending) return;
      if (!name.trim() || !valid) { setInvalid(true); return; }
      setInvalid(false);
      onPendingChange(true);
      save.mutate();
    }}>
      <DialogHeader>
        <DialogTitle>{t(saving ? "savings_edit" : "savings_add")}</DialogTitle>
        <DialogDescription>{t("savings_empty_help")}</DialogDescription>
      </DialogHeader>
      <fieldset disabled={save.isPending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="saving-name">{t("name")}</Label>
          <Input id="saving-name" value={name} onChange={(event) => setName(event.target.value)}
            maxLength={160} required autoFocus placeholder={t("savings_name_placeholder")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="saving-asset">{t("savings_asset")}</Label>
            <ThemedSelect id="saving-asset" value={asset}
              onChange={(event) => setAsset(event.target.value as SavingsAsset)}
              className="h-10 w-full rounded-xl">
              {assetOptions.map((value) => {
                const label = t(`savings_asset_${value}`, { defaultValue: value });
                const symbol = getCurrencySymbol(value, locale);
                const text = isGoldSavingsAsset(value) ? label : label !== value ? `${label} (${value})`
                  : symbol !== value ? `${value} (${symbol})` : value;
                return <option key={value} value={value}>{text}</option>;
              })}
            </ThemedSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="saving-quantity">{t("savings_quantity")} ({unit})</Label>
            <Input id="saving-quantity" value={quantity} inputMode="decimal" required
              onChange={(event) => setQuantity(event.target.value)}
              aria-invalid={invalid && !valid} aria-describedby="saving-quantity-help" />
          </div>
        </div>
        <p id="saving-quantity-help" className="text-xs text-muted-foreground">{t(savingsPrecision(asset) === 0 ? "savings_quantity_whole" : "savings_quantity_help", { decimals: savingsPrecision(asset) })}</p>
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">{t("savings_value", { currency: currency === "TRY" ? "TL" : currency })}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {preview === null ? t("savings_rate_missing") : formatCurrency(preview, currency, { locale })}
          </p>
          {rates?.stale && preview !== null && <p className="mt-2 text-xs text-muted-foreground">{t("savings_rates_stale")}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="saving-notes">{t("notes")}</Label>
          <Textarea id="saving-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} />
        </div>
      </fieldset>
      {invalid && <p role="alert" className="text-sm text-destructive">{t("savings_invalid")}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={save.isPending} onClick={onCancel}>{t("cancel")}</Button>
        <Button type="submit" disabled={save.isPending}>{t(save.isPending ? "loading" : "save")}</Button>
      </DialogFooter>
    </form>
  );
}
