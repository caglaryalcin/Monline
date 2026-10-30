import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { BackfillPaymentsEditor } from "@/components/subscriptions/BackfillPaymentsEditor";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLogoSearch } from "@/hooks/useLogoSearch";
import type { SubscriptionFormValues } from "@/hooks/useSubscriptionForm";
import { useSubscriptionForm } from "@/hooks/useSubscriptionForm";
import { type BackfillSelection, localToday } from "@/lib/backfillPayments";
import {
  availableBillingPresets,
  CUSTOM_BILLING_PRESET,
  CYCLE_NAME_KEYS,
  formatBillingPeriod,
} from "@/lib/billingPeriods";
import { categoryLabel } from "@/lib/categoryLabel";
import { displayDateInput } from "@/lib/dateInput";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { compressImage } from "@/lib/image";
import { ONE_TIME_CYCLE } from "@/lib/recordTypes";
import { automaticStartDate, nextPaymentDate } from "@/lib/subscriptionStartDate";
import { toast } from "@/lib/toast";
import { sharingKeys, sharingService } from "@/services/sharing";
import { subscriptionsService } from "@/services/subscriptions";
import type { Category, Currency, Household, PaymentMethod, Subscription } from "@/types";

import { SubscriptionLogo } from "./SubscriptionLogo";
import { SubscriptionLogoSection } from "./SubscriptionLogoSection";

interface Props {
  sub: Subscription | null;
  userId: string;
  currencies: Currency[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  household: Household[];
  onClose: () => void;
  onSaved: () => void;
}

export function SubscriptionFormModal({
  sub,
  userId,
  currencies,
  categories,
  paymentMethods,
  household,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const sharedPayers = useQuery({
    queryKey: sharingKeys.payers(userId, sub?.id ?? ""),
    queryFn: () => sharingService.payers(sub!.id),
    enabled: !!sub?.is_shared,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const confirmedPayers = household.filter((person) => person.account_confirmed);
  const additionalPayers = (sharedPayers.data ?? []).filter(
    (payer) => !confirmedPayers.some((person) => person.id === payer.value),
  );
  const [backfill, setBackfill] = useState<BackfillSelection>({
    enabled: false,
    valid: true,
    input: null,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    cycles,
    selectedCurrency,
    formState: { errors, isSubmitting },
  } = useSubscriptionForm({ sub, currencies, categories, household, paymentMethods });

  const watchedNotify = watch("notify");
  const watchedInactive = watch("inactive");
  const watchedName = watch("name");
  const logo = useLogoSearch(watchedName || "", !!sub?.logo);
  const watchedEndMode = watch("end_mode");
  // New subscriptions are always expenses. Preserve the type of legacy income
  // records when editing so an unrelated change never converts their history.
  const isCredit = sub?.record_type === "credit";
  const isPaid = !sub && !isCredit && watch("payment_status") === "paid";
  const dateLabel = t(isCredit ? "received_on" : isPaid ? "historical_paid_date" : "next_payment");
  const isFiniteSchedule = !isCredit && watchedEndMode !== "never";
  const oneTimeCycle = cycles.find((cycle) => cycle.name === ONE_TIME_CYCLE);
  const recurringCycles = cycles.filter((cycle) => cycle.name !== ONE_TIME_CYCLE);
  const billingPresets = availableBillingPresets(cycles);

  const watchedBillingPreset = watch("billing_preset");
  const watchedCycle = watch("cycle");
  const watchedFrequency = Number(watch("frequency"));
  const watchedCycleName = cycles.find((cycle) => cycle.id === watchedCycle)?.name;
  const dateCycleName = watchedCycleName || "Monthly";
  const customPeriodLabel =
    watchedCycleName && Number.isInteger(watchedFrequency) && watchedFrequency >= 1
      ? formatBillingPeriod(t, watchedCycleName, watchedFrequency)
      : "";

  const invalidProps = (name: keyof SubscriptionFormValues) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `subscription-${name}-error` : undefined,
  });
  const renderError = (name: keyof SubscriptionFormValues) =>
    errors[name] ? (
      <p id={`subscription-${name}-error`} role="alert" className="text-sm text-destructive">
        {errors[name]?.message}
      </p>
    ) : null;

  // Presets are shortcuts that fill cycle + frequency. "Custom" keeps the
  // current values so the user can fine-tune them from where they were.
  const handlePresetChange = (presetId: string) => {
    setValue("billing_preset", presetId);
    const preset = billingPresets.find((p) => p.id === presetId);
    if (!preset) return;
    setValue("cycle", preset.cycleId, { shouldValidate: true });
    setValue("frequency", String(preset.frequency), { shouldValidate: true });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (data: SubscriptionFormValues) => {
    try {
      if (!isPaid && backfill.enabled && !backfill.valid) {
        toast.error(t("backfill_confirm_required"));
        return;
      }
      const body: Record<string, unknown> = {
        record_type: isCredit ? "credit" : "expense",
        name: data.name,
        price: data.price,
        currency: data.currency,
        frequency: isCredit ? 1 : parseInt(data.frequency),
        cycle: isCredit && oneTimeCycle ? oneTimeCycle.id : data.cycle,
        next_payment: data.next_payment,
        ...(!sub
          ? {
              start_date:
                backfill.input && backfill.startDate
                  ? backfill.startDate
                  : automaticStartDate(
                      data.next_payment,
                      dateCycleName,
                      parseInt(data.frequency),
                    ),
            }
          : {}),
        payment_method: data.payment_method || null,
        payer: data.payer || null,
        category: data.category,
        notes: data.notes,
        url: sub?.url || "",
        auto_renew:
          isCredit || data.inactive ? false : data.end_mode === "never" ? data.auto_renew : true,
        notify: isCredit ? false : data.notify,
        notify_days_before: parseInt(data.notify_days_before),
        inactive: data.inactive,
        auto_mark_paid: isCredit ? false : data.auto_mark_paid,
        cancellation_date: data.cancellation_date || null,
        // Empty string is intentional: Monline clears optional date fields
        // with it, including multipart edits where null values are omitted.
        end_date: !isCredit && data.end_mode === "date" ? data.end_date : "",
        payment_limit: !isCredit && data.end_mode === "payments" ? parseInt(data.payment_limit) : 0,
        // The cron counts elapsed payments for date-bounded schedules too, so an
        // unrelated edit must not reset that tally — only dropping the schedule
        // entirely does.
        payments_completed:
          isCredit || data.end_mode === "never" ? 0 : parseInt(data.payments_completed) || 0,
        user: userId,
        ...(isPaid
          ? {
              initial_payment: {
                date: data.next_payment,
                utc_offset_minutes: new Date().getTimezoneOffset(),
                paid_utc_offset_minutes: new Date(
                  `${data.next_payment}T00:00:00`,
                ).getTimezoneOffset(),
              },
            }
          : {}),
        ...(!isPaid && !isCredit && !sub?.statement_imported && backfill.input
          ? { historical_payments: backfill.input }
          : {}),
      };

      let result: Subscription;
      let logoToUpload = await logo.resolveLogoFile(data.name);

      if (!logoToUpload && logo.logoUrl) {
        try {
          const direct = await fetch(logo.logoUrl);
          if (!direct.ok) throw new Error("logo_fetch_failed");
          const blob = await direct.blob();
          /* v8 ignore next */
          const extFromType = blob.type?.split("/")?.[1] || "png";
          /* v8 ignore next */
          const mimeType = blob.type || "image/png";
          logoToUpload = new File([blob], `logo.${extFromType}`, {
            type: mimeType,
          });
        } catch {
          toast.error(t("error_fetching_image_results"));
          return;
        }
      }

      if (logoToUpload) {
        try {
          logoToUpload = await compressImage(logoToUpload, { maxSize: 256 });
        } catch (error) {
          if (logo.manualLogo) throw error;
          // A failed automatic image must not prevent saving the subscription.
          logoToUpload = null;
        }
      }

      if (logoToUpload) {
        const formData = new FormData();
        Object.entries(body).forEach(([k, v]) => {
          if (v !== null && v !== undefined)
            formData.append(
              k,
              ["historical_payments", "initial_payment"].includes(k)
                ? JSON.stringify(v)
                : String(v),
            );
        });
        formData.append("logo", logoToUpload);
        if (sub) {
          result = await subscriptionsService.update(sub.id, formData);
        } else {
          result = await subscriptionsService.create(formData);
        }
      } else {
        if (sub) {
          result = await subscriptionsService.update(sub.id, body);
        } else {
          result = await subscriptionsService.create(body);
        }
      }

      void result;
      toast.success(t("success"));
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("unknown_error");
      toast.error(/^(backfill_|historical_)/.test(msg) ? t(msg) : msg);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const requestClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={dialogDismissHandler(requestClose)}
    >
      <DialogContent
        className="max-w-2xl max-h-[90dvh] overflow-y-auto"
        onPointerDownOutside={(event) => {
          event.preventDefault();
          requestClose();
        }}
      >
        <DialogHeader>
          <DialogTitle>{sub ? t("edit_subscription") : t("add_subscription")}</DialogTitle>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="subscription-name">{t("name")} *</Label>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-1.5 top-1.5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border bg-background"
                aria-hidden="true"
              >
                {watchedName?.trim() || logo.logoPreview || sub?.logo ? (
                  <SubscriptionLogo
                    sub={{ name: watchedName || "", url: sub?.url, id: sub?.id, logo: sub?.logo }}
                    previewUrl={logo.logoPreview || logo.logoUrl}
                    previewContentType={logo.logoFile?.type}
                    className="h-full w-full object-contain p-1.5"
                  />
                ) : (
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <Input
                id="subscription-name"
                className="h-12 pl-14"
                {...register("name")}
                {...invalidProps("name")}
              />
            </div>
            {renderError("name")}
          </div>

          {/* Logo section */}
          <SubscriptionLogoSection {...logo} />

          {/* Price + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="subscription-price">{t("price")} *</Label>
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    id="subscription-price"
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onEmpty={() => field.onChange(null)}
                    onBlur={field.onBlur}
                    {...invalidProps("price")}
                    symbol={selectedCurrency?.symbol}
                    code={selectedCurrency?.code}
                  />
                )}
              />
              {renderError("price")}
            </div>
            <div className="space-y-2">
              <Label>{t("currency")}</Label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      ref={field.ref}
                      onBlur={field.onBlur}
                      {...invalidProps("currency")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.symbol} {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {renderError("currency")}
            </div>
          </div>

          {/* Billing period: preset or custom frequency + cycle */}
          {!isCredit ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("billing_period")}</Label>
                <Controller
                  name="billing_preset"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={handlePresetChange}>
                      <SelectTrigger {...invalidProps(errors.cycle ? "cycle" : "frequency")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {billingPresets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {t(`billing_preset_${preset.id}`)}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_BILLING_PRESET}>
                          {t("billing_preset_custom")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {watchedBillingPreset !== CUSTOM_BILLING_PRESET &&
                  (renderError("cycle") || renderError("frequency"))}
              </div>
              {watchedBillingPreset === CUSTOM_BILLING_PRESET && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3">
                  <div className="space-y-2">
                    <Label>{t("frequency")}</Label>
                    <Input
                      type="number"
                      min="1"
                      {...register("frequency")}
                      {...invalidProps("frequency")}
                    />
                    {renderError("frequency")}
                  </div>
                  <div className="space-y-2">
                    <Label>{t("cycle")}</Label>
                    <Controller
                      name="cycle"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            ref={field.ref}
                            onBlur={field.onBlur}
                            {...invalidProps("cycle")}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {recurringCycles.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {CYCLE_NAME_KEYS[c.name] ? t(CYCLE_NAME_KEYS[c.name]) : c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {renderError("cycle")}
                  </div>
                  {customPeriodLabel && (
                    <p className="col-span-2 text-xs text-muted-foreground">
                      {t("billing_period_preview", { period: customPeriodLabel })}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium">{t("one_time_payout")}</p>
              <p className="text-xs text-muted-foreground">{t("one_time_payout_hint")}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className={!sub && !isCredit ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : ""}>
              {!sub && !isCredit && (
                <div className="space-y-2">
                  <Label htmlFor="subscription-payment-status">{t("payment_status")}</Label>
                  <Controller
                    name="payment_status"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(status: "paid" | "unpaid") => {
                          field.onChange(status);
                          setBackfill({ enabled: false, valid: true, input: null });
                          if (status === "paid" && watch("next_payment") > localToday())
                            setValue("next_payment", localToday(), {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                        }}
                      >
                        <SelectTrigger id="subscription-payment-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">{t("payment_to_pay")}</SelectItem>
                          <SelectItem value="paid">{t("paid")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="subscription-next_payment">{dateLabel}</Label>
                <Controller
                  name="next_payment"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      id="subscription-next_payment"
                      label={dateLabel}
                      max={isPaid ? localToday() : undefined}
                      {...invalidProps("next_payment")}
                    />
                  )}
                />
                {renderError("next_payment")}
              </div>
            </div>
            {!sub && !isCredit && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {isPaid
                  ? t("subscription_paid_date_hint", {
                      date: displayDateInput(
                        nextPaymentDate(
                          watch("next_payment"),
                          dateCycleName,
                          watchedFrequency,
                        ),
                      ),
                    })
                  : t("subscription_schedule_auto_hint")}
              </p>
            )}
          </div>

          {/* Finite schedule */}
          {!isCredit && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label>{t("subscription_ends")}</Label>
                <Controller
                  name="end_mode"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">{t("never")}</SelectItem>
                        <SelectItem value="date">{t("on_date")}</SelectItem>
                        <SelectItem value="payments">{t("after_payments")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">{t("finite_subscription_hint")}</p>
              </div>

              {watchedEndMode === "date" && (
                <div className="space-y-2">
                  <Label>{t("end_date")}</Label>
                  <Controller
                    name="end_date"
                    control={control}
                    render={({ field }) => (
                      <DatePicker {...field} label={t("end_date")} {...invalidProps("end_date")} />
                    )}
                  />
                  {renderError("end_date")}
                </div>
              )}

              {watchedEndMode === "payments" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("number_of_payments")}</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      {...register("payment_limit")}
                      {...invalidProps("payment_limit")}
                    />
                    {renderError("payment_limit")}
                  </div>
                  <div className="space-y-2">
                    <Label>{t("payments_already_made")}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      {...register("payments_completed")}
                      {...invalidProps("payments_completed")}
                    />
                    {renderError("payments_completed")}
                  </div>
                </div>
              )}

              {isFiniteSchedule && (
                <p className="text-xs text-muted-foreground">{t("finite_auto_renew_hint")}</p>
              )}
            </div>
          )}

          {/* Category + Payer */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subscription-category">{t("category")} *</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select required value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="subscription-category"
                      aria-label={t("category")}
                      aria-required="true"
                      aria-invalid={!!errors.category}
                      aria-describedby={errors.category ? "subscription-category-error" : undefined}
                    >
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {categoryLabel(c, t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && (
                <p
                  id="subscription-category-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.category.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="subscription-payer">{t("payer")}</Label>
              <Controller
                name="payer"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="subscription-payer">
                      <SelectValue>
                        {field.value &&
                        !confirmedPayers.some((person) => person.id === field.value) &&
                        !additionalPayers.some((person) => person.value === field.value)
                          ? t("household_payer_unavailable")
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {confirmedPayers.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name}
                        </SelectItem>
                      ))}
                      {additionalPayers.map((payer) => (
                        <SelectItem key={payer.value} value={payer.value}>
                          {payer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {sub?.is_shared && sharedPayers.isError && (
                <p role="alert" className="text-xs text-destructive">
                  {t("sharing_payers_load_error")}
                </p>
              )}
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label>{t("payment_method")}</Label>
            <Controller
              name="payment_method"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("optional")} />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{t("notes")}</Label>
            <Textarea {...register("notes")} rows={2} />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!isCredit && (
              <div className="flex items-center justify-between">
                <Label htmlFor="subscription-auto-renew">{t("auto_renew")}</Label>
                <Controller
                  name="auto_renew"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="subscription-auto-renew"
                      checked={!watchedInactive && (isFiniteSchedule || field.value)}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked)
                          setValue("inactive", false, { shouldDirty: true, shouldValidate: true });
                      }}
                      disabled={isFiniteSchedule && !watchedInactive}
                    />
                  )}
                />
              </div>
            )}
            {!isCredit && (
              <div className="flex items-center justify-between">
                <Label htmlFor="subscription-notify">{t("notify")}</Label>
                <Controller
                  name="notify"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="subscription-notify"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="subscription-inactive">{t("inactive")}</Label>
              <Controller
                name="inactive"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="subscription-inactive"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      if (checked)
                        setValue("auto_renew", false, { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                )}
              />
            </div>
            {!!authUser?.payment_tracking && !isCredit && (
              <div className="flex items-center justify-between">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="subscription-auto-mark-paid">{t("auto_mark_paid")}</Label>
                  <p
                    id="subscription-auto-mark-paid-hint"
                    className="text-xs text-muted-foreground"
                  >
                    {t("auto_mark_paid_calendar_hint")}
                  </p>
                </div>
                <Controller
                  name="auto_mark_paid"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="subscription-auto-mark-paid"
                      aria-describedby="subscription-auto-mark-paid-hint"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}
          </div>

          {watchedNotify && !isCredit && (
            <div className="space-y-2">
              <Label>{t("notify_days_before")}</Label>
              <Input
                type="number"
                min="0"
                {...register("notify_days_before")}
                {...invalidProps("notify_days_before")}
              />
              {renderError("notify_days_before")}
            </div>
          )}

          {watchedInactive && !isCredit && (
            <div className="space-y-2">
              <Label>{t("cancellation_date")}</Label>
              <Controller
                name="cancellation_date"
                control={control}
                render={({ field }) => <DatePicker {...field} label={t("cancellation_date")} />}
              />
            </div>
          )}

          {!sub && !isCredit && !isPaid && (
            <BackfillPaymentsEditor
              start={automaticStartDate(
                watch("next_payment"),
                dateCycleName,
                watchedFrequency,
              )}
              anchorDate={watch("next_payment")}
              cycle={watchedCycleName || ""}
              frequency={watchedFrequency}
              price={watch("price")}
              currency={selectedCurrency}
              end={
                [
                  watchedEndMode === "date" ? watch("end_date") : "",
                  watchedInactive ? watch("cancellation_date") : "",
                ]
                  .filter(Boolean)
                  .sort()[0] || ""
              }
              limit={watchedEndMode === "payments" ? Number(watch("payment_limit")) : 0}
              disabled={isSubmitting}
              onChange={setBackfill}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (!isPaid && backfill.enabled && !backfill.valid)}
            >
              {isSubmitting
                ? t("loading")
                : t(!isPaid && backfill.enabled ? "backfill_save" : "save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
