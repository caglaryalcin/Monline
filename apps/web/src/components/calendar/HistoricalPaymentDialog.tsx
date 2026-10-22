import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { SubscriptionLogoSection } from "@/components/SubscriptionLogoSection";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { ThemedSelect } from "@/components/ui/themed-select";
import { useLogoSearch } from "@/hooks/useLogoSearch";
import { categoryLabel } from "@/lib/categoryLabel";
import { isValidISODate } from "@/lib/dateInput";
import { compressImage } from "@/lib/image";
import { queryKeys } from "@/lib/queryKeys";
import { isExpense } from "@/lib/recordTypes";
import { toast } from "@/lib/toast";
import { paymentRecordsService } from "@/services/paymentRecords";
import type {
  Category,
  Currency,
  Household,
  PaymentMethod,
  PaymentRecord,
  Subscription,
} from "@/types";

import { getPaymentRecord, toDateStr } from "./types";

export function historicalDateRange(now = new Date()) {
  const year = now.getFullYear() - 1;
  const month = now.getMonth();
  const day = Math.min(now.getDate(), new Date(year, month + 1, 0).getDate());
  return { min: toDateStr(new Date(year, month, day)), max: toDateStr(now) };
}

export function HistoricalPaymentDialog({
  subscriptions,
  currencies,
  categories = [],
  paymentMethods = [],
  household = [],
  records,
  userId,
  initialDate,
  onClose,
  onSaved,
}: {
  subscriptions: Subscription[];
  currencies: Currency[];
  categories?: Category[];
  paymentMethods?: PaymentMethod[];
  household?: Household[];
  records: PaymentRecord[];
  userId: string;
  initialDate?: string;
  onClose: () => void;
  onSaved: (record: PaymentRecord) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const options = subscriptions.filter(isExpense).sort((a, b) => a.name.localeCompare(b.name));
  const [subscriptionId, setSubscriptionId] = useState(options[0]?.id ?? "");
  const [name, setName] = useState("");
  const [currencyId, setCurrencyId] = useState(
    (currencies.find((item) => item.is_main) ?? currencies[0])?.id ?? "",
  );
  const standalone = !subscriptionId;
  const logo = useLogoSearch(standalone ? name : "", !standalone);
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(
    paymentMethods.find((item) => item.is_main)?.id ?? "",
  );
  const [payerId, setPayerId] = useState(
    household.find((item) => item.is_main)?.id ?? (household.length === 1 ? household[0].id : ""),
  );
  const range = historicalDateRange();
  const initial =
    initialDate && initialDate >= range.min && initialDate <= range.max ? initialDate : range.max;
  const [paidDate, setPaidDate] = useState(initial);
  const [dueDate, setDueDate] = useState(initial);
  const [amount, setAmount] = useState(String(options[0]?.price ?? ""));
  const [notes, setNotes] = useState("");
  const subscription = options.find((sub) => sub.id === subscriptionId);
  const currency = standalone
    ? currencies.find((item) => item.id === currencyId)
    : (subscription?.expand?.currency ??
      currencies.find((item) => item.id === subscription?.currency));
  const duplicate = !standalone && !!getPaymentRecord(records, subscriptionId, dueDate)?.paid_at;
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...(standalone
          ? {
              name: name.trim(),
              currency: currencyId,
              ...(categoryId ? { category: categoryId } : {}),
              ...(paymentMethodId ? { payment_method: paymentMethodId } : {}),
              ...(payerId ? { payer: payerId } : {}),
            }
          : { subscription_id: subscriptionId }),
        due_date: dueDate,
        paid_date: paidDate,
        utc_offset_minutes: new Date().getTimezoneOffset(),
        paid_utc_offset_minutes: new Date(`${paidDate}T00:00:00`).getTimezoneOffset(),
        amount: Number(amount),
        notes: notes.trim(),
      };
      let logoFile = standalone ? await logo.resolveLogoFile(name) : null;
      if (logoFile) {
        try {
          logoFile = await compressImage(logoFile, { maxSize: 256 });
        } catch {
          if (logo.manualLogo) throw new Error("historical_invalid_logo");
          logoFile = null;
        }
      }
      if (!logoFile) return paymentRecordsService.createHistorical(body);
      const form = new FormData();
      for (const [key, value] of Object.entries(body)) form.set(key, String(value));
      form.set("logo", logoFile);
      return paymentRecordsService.createHistorical(form);
    },
    onSuccess: async (record) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRecords.all(userId) }),
        ...(subscriptionId
          ? [
              queryClient.invalidateQueries({
                queryKey: queryKeys.subscriptions.history(userId, subscriptionId),
              }),
            ]
          : []),
      ]);
      toast.success(t("historical_saved"));
      onSaved(record);
    },
    onError: (err: unknown) => {
      const response = (err as { response?: { error?: string; message?: string } }).response;
      const code =
        response?.error ?? response?.message ?? (err instanceof Error ? err.message : "");
      const known = [
        "historical_duplicate",
        "historical_invalid_date",
        "historical_invalid_amount",
        "historical_invalid_notes",
        "historical_invalid_name",
        "historical_invalid_currency",
        "historical_invalid_logo",
        "historical_invalid_details",
      ];
      setError(t(code && known.includes(code) ? code : "historical_save_failed"));
    },
  });
  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        onPointerDownOutside={(event) => {
          event.preventDefault();
          if (!mutation.isPending) onClose();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("historical_add")}</DialogTitle>
          <DialogDescription>{t("historical_description")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            if (duplicate) return;
            if (standalone && !name.trim()) {
              setError(t("historical_invalid_name"));
              return;
            }
            if (standalone && !currency) {
              setError(t("historical_invalid_currency"));
              return;
            }
            if (
              [paidDate, dueDate].some(
                (date) => !isValidISODate(date) || date < range.min || date > range.max,
              )
            ) {
              setError(t("historical_invalid_date"));
              return;
            }
            if (
              (!standalone && !subscription) ||
              !amount.trim() ||
              !Number.isFinite(Number(amount)) ||
              Number(amount) < 0
            ) {
              setError(t("historical_invalid_amount"));
              return;
            }
            mutation.mutate();
          }}
        >
          <fieldset disabled={mutation.isPending} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="historical-subscription">{t("subscription")}</Label>
              <ThemedSelect
                id="historical-subscription"
                value={subscriptionId}
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                onChange={(event) => {
                  setSubscriptionId(event.target.value);
                  setAmount(
                    String(options.find((sub) => sub.id === event.target.value)?.price ?? ""),
                  );
                  setError(null);
                }}
              >
                <option value="">{t("historical_standalone")}</option>
                {options.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                    {sub.inactive ? ` · ${t("inactive")}` : ""}
                  </option>
                ))}
              </ThemedSelect>
            </div>
            {standalone && (
              <>
                <p className="text-sm text-muted-foreground">{t("historical_standalone_hint")}</p>
                <div className="space-y-2">
                  <Label htmlFor="historical-name">{t("historical_name")}</Label>
                  <div className="flex items-center gap-3">
                    <SubscriptionLogo
                      sub={{ name }}
                      previewUrl={logo.logoPreview || logo.logoUrl}
                      className="h-11 w-11 shrink-0 rounded-xl border object-contain p-1.5"
                    />
                    <Input
                      id="historical-name"
                      required
                      maxLength={200}
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setError(null);
                      }}
                    />
                  </div>
                </div>
                <SubscriptionLogoSection {...logo} />
                <div className="space-y-2">
                  <Label htmlFor="historical-currency">{t("currency")}</Label>
                  <ThemedSelect
                    id="historical-currency"
                    required
                    value={currencyId}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                    onChange={(event) => {
                      setCurrencyId(event.target.value);
                      setError(null);
                    }}
                  >
                    {currencies.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code}
                      </option>
                    ))}
                  </ThemedSelect>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="historical-category">{t("category")}</Label>
                    <ThemedSelect
                      id="historical-category"
                      value={categoryId}
                      className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                      onChange={(event) => setCategoryId(event.target.value)}
                    >
                      <option value="" />
                      {categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {categoryLabel(item, t)}
                        </option>
                      ))}
                    </ThemedSelect>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="historical-payer">{t("payer")}</Label>
                    <ThemedSelect
                      id="historical-payer"
                      value={payerId}
                      className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                      onChange={(event) => setPayerId(event.target.value)}
                    >
                      <option value="" />
                      {household.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </ThemedSelect>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="historical-payment-method">{t("payment_method")}</Label>
                  <ThemedSelect
                    id="historical-payment-method"
                    value={paymentMethodId}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                    onChange={(event) => setPaymentMethodId(event.target.value)}
                  >
                    <option value="" />
                    {paymentMethods.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </ThemedSelect>
                </div>
              </>
            )}
            {subscription && (
              <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3">
                <SubscriptionLogo
                  sub={subscription}
                  className="h-9 w-9 rounded-xl object-contain"
                />
                <div>
                  <p className="text-sm font-semibold">{subscription.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("historical_currency", { currency: currency?.code ?? "—" })}
                  </p>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="historical-paid-date">{t("historical_paid_date")}</Label>
                <DatePicker
                  id="historical-paid-date"
                  label={t("historical_paid_date")}
                  required
                  min={range.min}
                  max={range.max}
                  value={paidDate}
                  onChange={(value) => {
                    if (dueDate === paidDate) setDueDate(value);
                    setPaidDate(value);
                    setError(null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="historical-due-date">{t("historical_due_date")}</Label>
                <DatePicker
                  id="historical-due-date"
                  label={t("historical_due_date")}
                  required
                  min={range.min}
                  max={range.max}
                  value={dueDate}
                  onChange={(value) => {
                    setDueDate(value);
                    setError(null);
                  }}
                />
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("historical_dates_hint")}
            </p>
            <div className="space-y-2">
              <Label htmlFor="historical-amount">
                {t("amount")}
                {currency?.code ? ` (${currency.code})` : ""}
              </Label>
              <Input
                id="historical-amount"
                type="number"
                min="0"
                max="1000000000000"
                step="0.01"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="historical-notes">{t("notes")}</Label>
              <Textarea
                id="historical-notes"
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("optional")}
              />
            </div>
            {(duplicate || error) && (
              <p role="alert" className="text-sm text-destructive">
                {duplicate ? t("historical_duplicate") : error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={(!standalone && !subscription) || duplicate || mutation.isPending}
              >
                {t(mutation.isPending ? "saving" : "historical_save")}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
