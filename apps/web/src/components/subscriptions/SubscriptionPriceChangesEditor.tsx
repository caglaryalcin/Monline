import { Plus, Trash2 } from "lucide-react";
import { type Control, Controller, type FieldErrors, useFieldArray, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import type { SubscriptionFormValues } from "@/hooks/useSubscriptionForm";
import { localToday } from "@/lib/backfillPayments";
import { subscriptionPrice } from "@/lib/subscriptionTrial";
import { formatPrice } from "@/lib/utils";
import type { Currency, Subscription } from "@/types";

export function SubscriptionPriceChangesEditor({ control, errors, currency, savedChanges }: {
  control: Control<SubscriptionFormValues>;
  errors: FieldErrors<SubscriptionFormValues>;
  currency?: Currency;
  savedChanges?: Subscription["price_changes"];
}) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({ control, name: "price_changes" });
  const price = useWatch({ control, name: "price" });
  const changes = useWatch({ control, name: "price_changes" });
  const today = localToday();
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-3" aria-labelledby="subscription-price-changes-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="subscription-price-changes-title" className="text-sm font-medium">{t("price_changes_title")}</h3>
        <Button type="button" variant="outline" size="sm" disabled={fields.length >= 100}
          onClick={() => append({ effective_date: "", price: null })}>
          <Plus className="mr-1 h-3.5 w-3.5" />{t("price_changes_add")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("price_changes_help")}</p>
      {fields.length > 0 && price !== null && (
        <p className="text-sm font-medium">{t("price_changes_current", { amount: formatPrice(subscriptionPrice({
          price, price_changes: changes.filter((change): change is { effective_date: string; price: number } => change.price !== null),
        }), currency?.symbol || "", { currencyCode: currency?.code }) })}</p>
      )}
      {fields.map((item, index) => {
        const locked = !!savedChanges?.some((saved) => saved.effective_date === item.effective_date && saved.effective_date <= today);
        const error = errors.price_changes?.[index];
        const prefix = `subscription-price-change-${item.id}`;
        return (
          <div key={item.id} className="space-y-2 rounded-lg border bg-background p-3">
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-price`}>{t("price_changes_new_price")}</Label>
                <Controller control={control} name={`price_changes.${index}.price`} render={({ field }) => (
                  <CurrencyInput {...field} id={`${prefix}-price`} disabled={locked}
                    onEmpty={() => field.onChange(null)} symbol={currency?.symbol} code={currency?.code}
                    aria-invalid={!!error?.price} aria-describedby={error?.price ? `${prefix}-price-error` : undefined} />
                )} />
                {error?.price && <p id={`${prefix}-price-error`} role="alert" className="text-xs text-destructive">{error.price.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-date`}>{t("price_changes_effective_date")}</Label>
                <Controller control={control} name={`price_changes.${index}.effective_date`} render={({ field }) => (
                  <DatePicker {...field} id={`${prefix}-date`} label={t("price_changes_effective_date")}
                    disabled={locked} min={locked ? undefined : localToday(tomorrow)}
                    aria-invalid={!!error?.effective_date} aria-describedby={error?.effective_date ? `${prefix}-date-error` : undefined} />
                )} />
                {error?.effective_date && <p id={`${prefix}-date-error`} role="alert" className="text-xs text-destructive">{error.effective_date.message}</p>}
              </div>
              <Button type="button" variant="ghost" size="icon" className="sm:mt-7" disabled={locked}
                aria-label={t("price_changes_remove")} title={t("price_changes_remove")} onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {locked && <p className="text-xs text-muted-foreground">{t("price_changes_applied")}</p>}
          </div>
        );
      })}
      {errors.price_changes?.root?.message && <p role="alert" className="text-xs text-destructive">{errors.price_changes.root.message}</p>}
    </section>
  );
}
