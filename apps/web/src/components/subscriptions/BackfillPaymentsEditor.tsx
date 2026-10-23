import { History } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { backfillDates, type BackfillSelection, localToday } from "@/lib/backfillPayments";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types";

interface Props {
  start: string;
  anchorDate?: string;
  billingAnchorDay?: number;
  cycle: string;
  frequency: number;
  price: number | null;
  currency?: Currency;
  end?: string;
  limit?: number;
  disabled?: boolean;
  title?: string;
  description?: string;
  markAsPaid?: boolean;
  confirmationLabel?: string;
  fixedStart?: boolean;
  excludeDates?: string[];
  idPrefix?: string;
  onChange: (selection: BackfillSelection) => void;
}
interface Draft {
  signature: string;
  amounts: Record<string, number | null>;
  excluded: string[];
  confirmed: boolean;
}
const EMPTY_DRAFT: Draft = { signature: "", amounts: {}, excluded: [], confirmed: false };

export function BackfillPaymentsEditor({
  start,
  anchorDate = start,
  billingAnchorDay,
  cycle,
  frequency,
  price,
  currency,
  end = "",
  limit = 0,
  disabled,
  title,
  description,
  markAsPaid = true,
  confirmationLabel,
  fixedStart = false,
  excludeDates,
  idPrefix = "",
  onChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [chosenStart, setChosenStart] = useState<string | null>(null);
  const rangeStart = chosenStart ?? start;
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const today = localToday();
  const signature = JSON.stringify([
    rangeStart,
    anchorDate,
    billingAnchorDay,
    cycle,
    frequency,
    end,
    limit,
    price,
    markAsPaid,
    currency?.id,
    today,
    excludeDates,
  ]);
  // Changing schedule, currency or price requires reviewing the new list again.
  const current = draft.signature === signature ? draft : EMPTY_DRAFT;
  const schedule = useMemo(() => {
    try {
      return {
        dates: backfillDates({
          start: rangeStart,
          anchorDate,
          billingAnchorDay,
          cycle,
          frequency,
          end,
          limit,
          until: today,
        }).filter((date) => !excludeDates?.includes(date)),
        error: "",
      };
    } catch (error) {
      return { dates: [], error: (error as Error).message };
    }
  }, [rangeStart, anchorDate, billingAnchorDay, cycle, frequency, end, limit, today, excludeDates]);
  const rows = useMemo(
    () =>
      schedule.dates.map((date) => ({
        date,
        amount: Object.prototype.hasOwnProperty.call(current.amounts, date)
          ? current.amounts[date]
          : price,
        included: !current.excluded.includes(date),
      })),
    [schedule.dates, current.amounts, current.excluded, price],
  );
  const selected = useMemo(() => rows.filter((row) => row.included), [rows]);
  const validAmounts =
    selected.length > 0 &&
    selected.every(
      (row) =>
        row.amount !== null && Number.isFinite(row.amount) && row.amount >= 0 && row.amount <= 1e12,
    );
  const valid = !enabled || (!schedule.error && validAmounts && current.confirmed);

  useEffect(() => {
    onChange({
      enabled,
      valid,
      ...(enabled ? { startDate: rangeStart } : {}),
      input:
        enabled && valid
          ? {
              confirmed: true,
              ...(!markAsPaid ? { mark_as_paid: false } : {}),
              utc_offset_minutes: new Date().getTimezoneOffset(),
              payments: selected.map((row) => ({
                due_date: row.date,
                amount: row.amount!,
                paid_utc_offset_minutes: new Date(row.date + "T00:00:00").getTimezoneOffset(),
              })),
            }
          : null,
    });
  }, [enabled, valid, selected, rangeStart, markAsPaid, onChange]);

  const updateDraft = (patch: Partial<Draft>) =>
    setDraft({ ...current, signature, confirmed: false, ...patch });
  const locale = (i18n?.resolvedLanguage || i18n?.language || "en").replace("_", "-");
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date + "T12:00:00"));
  const total = selected.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const totalLabel = new Intl.NumberFormat(
    locale,
    currency?.code ? { style: "currency", currency: currency.code } : {},
  ).format(total);

  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}subscription-backfill`} className="flex items-center gap-2">
            <History className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {title ?? t("backfill_title")}
          </Label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description ?? t("backfill_description")}
          </p>
        </div>
        <Switch
          id={`${idPrefix}subscription-backfill`}
          aria-label={title ?? t("backfill_title")}
          checked={enabled}
          onCheckedChange={(checked) => {
            setEnabled(checked);
            updateDraft({ confirmed: false });
          }}
        />
      </div>
      {enabled && (
        <div className="space-y-3">
          {!fixedStart && (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}subscription-history-start`}>
                {t("backfill_start_date")}
              </Label>
              <DatePicker
                id={`${idPrefix}subscription-history-start`}
                label={t("backfill_start_date")}
                value={rangeStart}
                onChange={(value) => {
                  setChosenStart(value);
                  updateDraft({ confirmed: false });
                }}
              />
            </div>
          )}
          {schedule.error || !rows.length ? (
            <p role="alert" className="text-sm text-destructive">
              {t(schedule.error || "backfill_empty")}
            </p>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left">{t("historical_due_date")}</th>
                      <th className="p-3 text-left">{t("amount")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => (
                      <tr key={row.date}>
                        <td className="p-3">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={row.included}
                              className="h-4 w-4 shrink-0 accent-primary"
                              onChange={(event) =>
                                updateDraft({
                                  excluded: event.target.checked
                                    ? current.excluded.filter((date) => date !== row.date)
                                    : [...current.excluded, row.date],
                                })
                              }
                            />
                            <span className="whitespace-nowrap">{dateLabel(row.date)}</span>
                          </label>
                        </td>
                        <td className="p-2">
                          <Label
                            className="sr-only"
                            htmlFor={`${idPrefix}backfill-amount-${row.date}`}
                          >
                            {t("amount")} · {dateLabel(row.date)}
                          </Label>
                          <CurrencyInput
                            id={`${idPrefix}backfill-amount-${row.date}`}
                            value={row.amount}
                            symbol={currency?.symbol}
                            code={currency?.code}
                            disabled={!row.included}
                            onEmpty={() =>
                              updateDraft({ amounts: { ...current.amounts, [row.date]: null } })
                            }
                            onChange={(amount) =>
                              updateDraft({ amounts: { ...current.amounts, [row.date]: amount } })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm font-medium">
                {t("backfill_summary", { count: selected.length, total: totalLabel })}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(markAsPaid ? "backfill_duplicates_hint" : "calendar_existing_periods_hint")}
              </p>
              {!validAmounts && (
                <p role="alert" className="text-sm text-destructive">
                  {t(selected.length ? "historical_invalid_amount" : "backfill_select_payment")}
                </p>
              )}
              <label
                className={cn(
                  "flex items-start gap-2 rounded-lg border border-transparent p-3 text-sm leading-relaxed transition-colors",
                  !current.confirmed &&
                    "border-red-500/60 bg-red-50 text-red-700 dark:border-red-400/60 dark:bg-red-950/30 dark:text-red-300",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  checked={current.confirmed}
                  aria-invalid={!current.confirmed}
                  data-backfill-confirmation
                  disabled={!validAmounts}
                  onChange={(event) => updateDraft({ confirmed: event.target.checked })}
                />
                {confirmationLabel ?? t("backfill_confirm")}
              </label>
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}
