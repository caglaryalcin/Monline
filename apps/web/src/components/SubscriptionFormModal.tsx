import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { RemindersEditor } from "@/components/settings/notifications/RemindersEditor";
import { BackfillPaymentsEditor } from "@/components/subscriptions/BackfillPaymentsEditor";
import { SubscriptionCategorySelect } from "@/components/subscriptions/SubscriptionCategorySelect";
import { SubscriptionPriceChangesEditor } from "@/components/subscriptions/SubscriptionPriceChangesEditor";
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
import { InfoButton } from "@/components/ui/info-button";
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
import { displayDateInput } from "@/lib/dateInput";
import { compressImage } from "@/lib/image";
import { lastWeekdayOfMonth } from "@/lib/lastWeekday";
import { ONE_TIME_CYCLE } from "@/lib/recordTypes";
import { automaticStartDate, nextPaymentDate } from "@/lib/subscriptionStartDate";
import { toast } from "@/lib/toast";
import { paymentAccountsService } from "@/services/paymentAccounts";
import { sharingKeys, sharingService } from "@/services/sharing";
import { subscriptionsService } from "@/services/subscriptions";
import type { Category, Currency, Household, PaymentMethod, Subscription } from "@/types";

import { SubscriptionLogo } from "./SubscriptionLogo";
import { SubscriptionLogoSection } from "./SubscriptionLogoSection";

const TRIAL_PRESETS = [
  { unit: "week", duration: 1, labelKey: "trial_first_week_1" },
  { unit: "week", duration: 2, labelKey: "trial_first_week_2" },
  { unit: "week", duration: 3, labelKey: "trial_first_week_3" },
  { unit: "month", duration: 1, labelKey: "trial_first_month_1" },
  { unit: "month", duration: 2, labelKey: "trial_first_month_2" },
  { unit: "month", duration: 3, labelKey: "trial_first_month_3" },
  { unit: "month", duration: 6, labelKey: "trial_first_month_6" },
] as const;

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
  const [createdCategories, setCreatedCategories] = useState<Category[]>([]);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const formCategories = [
    ...categories,
    ...createdCategories.filter(
      (category) =>
        category.user === userId && !categories.some((existing) => existing.id === category.id),
    ),
  ];
  const { user: authUser } = useAuth();
  const billingCalendar = useMemo(() => sub?.billing_calendar ?? {
    country: authUser?.country || "", region: authUser?.region || "",
  }, [sub?.billing_calendar, authUser?.country, authUser?.region]);
  const sharedPayers = useQuery({
    queryKey: sharingKeys.payers(userId, sub?.id ?? ""),
    queryFn: () => sharingService.payers(sub!.id),
    enabled: !!sub?.is_shared,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const accountsQuery = useQuery({
    queryKey: ["payment_accounts", userId],
    queryFn: () => paymentAccountsService.list(userId),
    enabled: !sub?.is_shared,
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
    clearErrors,
    watch,
    cycles,
    selectedCurrency,
    formState: { errors, isSubmitting },
  } = useSubscriptionForm({
    sub,
    currencies,
    categories: formCategories,
    household,
    paymentMethods,
  });

  const watchedNotify = watch("notify");
  const notificationMode = watch("notification_mode");
  const watchedInactive = watch("inactive");
  const watchedTrial = watch("trial_enabled");
  const legacyTrial =
    !!sub?.trial_months &&
    !sub.trial_duration &&
    watch("trial_unit") === "month" &&
    Number(watch("trial_duration")) === sub.trial_months;
  const watchedName = watch("name");
  const watchedBrand = watch("brand_name");
  const brandChanged = (watchedBrand?.trim() || "") !== (sub?.brand_name?.trim() || "");
  const logo = useLogoSearch(
    watchedBrand?.trim() || watchedName || "",
    !!sub?.logo && !brandChanged,
  );
  const watchedEndMode = watch("end_mode");
  // New subscriptions are always expenses. Preserve the type of legacy income
  // records when editing so an unrelated change never converts their history.
  const isCredit = sub?.record_type === "credit";
  const isPaid = !sub && !isCredit && watch("payment_status") === "paid";
  const dateLabel = t(
    isCredit
      ? "received_on"
      : isPaid
        ? "historical_paid_date"
        : watchedTrial && !sub
          ? "trial_start_date"
          : "next_payment",
  );
  const isFiniteSchedule = !isCredit && watchedEndMode !== "never";
  const oneTimeCycle = cycles.find((cycle) => cycle.name === ONE_TIME_CYCLE);
  const recurringCycles = cycles.filter((cycle) => cycle.name !== ONE_TIME_CYCLE);
  const billingPresets = availableBillingPresets(cycles);

  const watchedBillingPreset = watch("billing_preset");
  const watchedCycle = watch("cycle");
  const watchedFrequency = Number(watch("frequency"));
  const watchedCycleName = cycles.find((cycle) => cycle.id === watchedCycle)?.name;
  const watchedNextPayment = watch("next_payment");
  useEffect(() => {
    if (watchedCycleName !== "Last-Weekday" || watchedTrial || !watchedNextPayment) return;
    let normalized = lastWeekdayOfMonth(watchedNextPayment, billingCalendar);
    if (isPaid && normalized > localToday()) {
      const previous = new Date(watchedNextPayment + "T12:00:00Z");
      previous.setUTCDate(1);
      previous.setUTCDate(0);
      normalized = lastWeekdayOfMonth(previous.toISOString().slice(0, 10), billingCalendar);
    }
    if (normalized && normalized !== watchedNextPayment)
      setValue("next_payment", normalized, { shouldDirty: true, shouldValidate: true });
  }, [watchedCycleName, isPaid, watchedNextPayment, watchedTrial, setValue, billingCalendar]);
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
    if (creatingCategory) return;
    try {
      if (!isPaid && backfill.enabled && !backfill.valid) {
        toast.error(t("backfill_confirm_required"));
        return;
      }
      const body: Record<string, unknown> = {
        record_type: isCredit ? "credit" : "expense",
        name: data.name,
        brand_name: data.brand_name?.trim() || "",
        price: data.price,
        price_changes: isCredit
          ? []
          : data.price_changes.map((change) => ({ ...change, price: change.price! })),
        trial_months: !isCredit && data.trial_enabled && legacyTrial ? sub!.trial_months : 0,
        trial_duration:
          !isCredit && data.trial_enabled && !legacyTrial ? Number(data.trial_duration) : 0,
        trial_unit: !isCredit && data.trial_enabled && !legacyTrial ? data.trial_unit : "",
        trial_start_date:
          !isCredit && data.trial_enabled ? (!sub ? data.next_payment : data.trial_start_date) : "",
        currency: data.currency,
        frequency: isCredit ? 1 : parseInt(data.frequency),
        cycle: isCredit && oneTimeCycle ? oneTimeCycle.id : data.cycle,
        next_payment: data.next_payment,
        ...(!sub
          ? {
              start_date: data.trial_enabled
                ? data.next_payment
                : backfill.input && backfill.startDate
                  ? backfill.startDate
                  : automaticStartDate(
                      data.next_payment,
                      watchedCycleName || "Monthly",
                      parseInt(data.frequency),
                      billingCalendar,
                    ),
            }
          : {}),
        payment_method: data.payment_method || null,
        ...(!sub?.is_shared ? { payment_account: data.payment_account || "" } : {}),
        payer: data.payer || null,
        category: data.category || null,
        notes: data.notes,
        url: sub?.url || "",
        auto_renew:
          isCredit || data.inactive ? false : data.end_mode === "never" ? data.auto_renew : true,
        notify: isCredit ? false : data.notify,
        notify_days_before: parseInt(data.notify_days_before),
        notification_reminders:
          !isCredit && data.notification_mode === "custom" ? data.notification_reminders : null,
        inactive: data.inactive,
        auto_mark_paid: isCredit ? false : data.auto_mark_paid,
        cancellation_date: data.cancellation_date || null,
        // Empty string is intentional: Monline clears optional date fields
        // with it, including multipart edits where null values are omitted.
        end_date: !isCredit && data.end_mode === "date" ? data.end_date : "",
        payment_limit: !isCredit && data.end_mode === "payments" ? parseInt(data.payment_limit) : 0,
        // The cron counts elapsed payments for date-bounded schedules too, so an
        // unrelated edit must not reset that tally - only dropping the schedule
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
      let logoToUpload = await logo.resolveLogoFile(data.brand_name?.trim() || data.name);

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

      if (!logoToUpload && brandChanged) body.logo = "";

      if (logoToUpload) {
        const formData = new FormData();
        Object.entries(body).forEach(([k, v]) => {
          if (["notification_reminders", "price_changes"].includes(k)) {
            formData.append(k, JSON.stringify(v));
          } else if (v !== null && v !== undefined)
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
      toast.error(
        /^(backfill_|historical_|subscription_reminders_|price_changes_)/.test(msg) ? t(msg) : msg,
      );
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting && !creatingCategory) onClose();
      }}
    >
      <DialogContent
        className="flex max-w-[44rem] max-h-[90dvh] flex-col overflow-hidden"
        onPointerDownOutside={(event) => {
          event.preventDefault();
          if (!isSubmitting && !creatingCategory) onClose();
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{sub ? t("edit_subscription") : t("add_subscription")}</DialogTitle>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-col gap-4">
          <div className="relative z-10 shrink-0 space-y-4 bg-background">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="subscription-name">{t("brand_display_name")} *</Label>
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-1.5 top-1.5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border bg-background"
                  aria-hidden="true"
                >
                  {watchedBrand?.trim() || watchedName?.trim() || logo.logoPreview || sub?.logo ? (
                    <SubscriptionLogo
                      sub={{
                        name: watchedName || "",
                        brand_name: watchedBrand,
                        url: sub?.url,
                        id: sub?.id,
                        logo: brandChanged ? undefined : sub?.logo,
                      }}
                      previewUrl={logo.logoPreview || logo.logoUrl}
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
          </div>

          <div className="-ml-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain py-1 pl-1 pr-4 [scroll-padding-block:0.25rem] [scrollbar-gutter:stable]">
            {/* Logo section */}
            <div className="space-y-2">
              <Label htmlFor="subscription-brand">{t("brand_name_label")}</Label>
              <Input
                id="subscription-brand"
                maxLength={120}
                placeholder={t("brand_name_placeholder")}
                {...register("brand_name")}
                {...invalidProps("brand_name")}
              />
              <p className="text-xs text-muted-foreground">{t("brand_name_help")}</p>
              {renderError("brand_name")}
            </div>
            <SubscriptionLogoSection {...logo} />

            {/* Price + Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="subscription-price">
                  {t(
                    watch("price_changes").length
                      ? "price_changes_base_price"
                      : watchedTrial
                        ? "trial_regular_price"
                        : "price",
                  )}{" "}
                  *
                </Label>
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

            {!isCredit && (
              <SubscriptionPriceChangesEditor
                control={control}
                errors={errors}
                currency={selectedCurrency}
                savedChanges={sub?.price_changes}
              />
            )}

            {!isCredit && (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <Controller
                    name="trial_enabled"
                    control={control}
                    render={({ field }) => (
                      <input
                        id="subscription-trial-enabled"
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-primary"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        checked={field.value}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          field.onChange(checked);
                          if (checked === true && !sub) {
                            setValue("next_payment", localToday(), { shouldValidate: true });
                            setValue("trial_start_date", localToday());
                            setValue("payment_status", "unpaid");
                          }
                        }}
                      />
                    )}
                  />
                  <Label htmlFor="subscription-trial-enabled">{t("trial_period")}</Label>
                  <InfoButton title={t("trial_period")}>
                    {t(legacyTrial ? "trial_period_help" : "trial_duration_help")}
                  </InfoButton>
                </div>
                {watchedTrial && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Label htmlFor="subscription-trial-duration">{t("trial_duration")}</Label>
                    <Select
                      value={`${watch("trial_unit")}:${watch("trial_duration")}`}
                      onValueChange={(value) => {
                        const preset = TRIAL_PRESETS.find(
                          (item) => `${item.unit}:${item.duration}` === value,
                        );
                        if (!preset) return;
                        setValue("trial_unit", preset.unit, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                        setValue("trial_duration", String(preset.duration), {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }}
                    >
                      <SelectTrigger
                        id="subscription-trial-duration"
                        className="w-full sm:w-56"
                        {...invalidProps("trial_duration")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIAL_PRESETS.map((preset) => (
                          <SelectItem
                            key={`${preset.unit}:${preset.duration}`}
                            value={`${preset.unit}:${preset.duration}`}
                          >
                            {t(preset.labelKey)}
                          </SelectItem>
                        ))}
                        {!TRIAL_PRESETS.some(
                          (preset) =>
                            preset.unit === watch("trial_unit") &&
                            preset.duration === Number(watch("trial_duration")),
                        ) && (
                          <SelectItem
                            value={`${watch("trial_unit")}:${watch("trial_duration")}`}
                            disabled
                          >
                            {watch("trial_duration")} {t(`trial_unit_${watch("trial_unit")}`)}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="basis-full text-xs text-muted-foreground">
                      {t(legacyTrial ? "trial_amount_hint" : "trial_duration_hint", {
                        count: Number(watch("trial_duration")) || 1,
                        currency: selectedCurrency?.code || selectedCurrency?.symbol || "",
                      })}
                    </p>
                    {renderError("trial_duration")}
                  </div>
                )}
              </div>
            )}

            {/* Billing period: preset or custom frequency + cycle */}
            {!isCredit ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="subscription-billing-period">{t("billing_period")}</Label>
                  <Controller
                    name="billing_preset"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={handlePresetChange}>
                        <SelectTrigger id="subscription-billing-period" {...invalidProps(errors.cycle ? "cycle" : "frequency")}>
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
                  {watchedCycleName === "Last-Weekday" && (
                    <p className="text-xs leading-relaxed text-muted-foreground">{t(billingCalendar.country ? "billing_last_workday_holiday_hint" : "billing_last_weekday_hint")}</p>
                  )}
                </div>
              </div>
              {!sub && !isCredit && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {isPaid
                    ? t("subscription_paid_date_hint", {
                        date: displayDateInput(
                          nextPaymentDate(
                            watch("next_payment"),
                            watchedCycleName || "Monthly",
                            watchedFrequency,
                            billingCalendar,
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
                        <DatePicker
                          {...field}
                          label={t("end_date")}
                          {...invalidProps("end_date")}
                        />
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
                    <SubscriptionCategorySelect
                      userId={userId}
                      categories={formCategories}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={isSubmitting || creatingCategory}
                      invalid={!!errors.category}
                      describedBy={errors.category ? "subscription-category-error" : undefined}
                      onCreatingChange={setCreatingCategory}
                      onCreated={(category) => {
                        setCreatedCategories((current) => [
                          ...current.filter((item) => item.id !== category.id),
                          category,
                        ]);
                        setValue("category", category.id, { shouldDirty: true, shouldTouch: true });
                        clearErrors("category");
                      }}
                    />
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

            {!sub?.is_shared && (
              <div className="space-y-2">
                <Label htmlFor="subscription-payment-account">{t("payment_account")}</Label>
                <Controller
                  name="payment_account"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                      disabled={accountsQuery.isPending || accountsQuery.isError}
                    >
                      <SelectTrigger id="subscription-payment-account">
                        <SelectValue placeholder={t("optional")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("optional")}</SelectItem>
                        {(accountsQuery.data ?? []).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">{t("payment_accounts_manage_hint")}</p>
                {accountsQuery.isError && (
                  <p role="alert" className="text-xs text-destructive">
                    {t("error")}
                  </p>
                )}
              </div>
            )}
            {isPaid && watch("auto_mark_paid") && watch("auto_renew") && (
              <p className="text-xs text-muted-foreground">{t("historical_auto_fill_help")}</p>
            )}
            {/* Notes */}
            <div className="space-y-2">
              <Label>{t("notes")}</Label>
              <Textarea {...register("notes")} rows={2} />
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
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
                            setValue("inactive", false, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
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
                          setValue("auto_renew", false, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                      }}
                    />
                  )}
                />
              </div>
              {!!authUser?.payment_tracking && !isCredit && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-1">
                      <Label htmlFor="subscription-auto-mark-paid">{t("auto_mark_paid")}</Label>
                      <InfoButton title={t("auto_mark_paid")}>
                        {t("auto_mark_paid_calendar_hint")}
                      </InfoButton>
                    </div>
                    <Controller
                      name="auto_mark_paid"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          id="subscription-auto-mark-paid"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            {watchedNotify && !isCredit && (
              <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                <Label htmlFor="subscription-notification-mode">
                  {t("subscription_notification_schedule")}
                </Label>
                <Controller
                  name="notification_mode"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="subscription-notification-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">
                          {t("subscription_notifications_default")}
                        </SelectItem>
                        <SelectItem value="custom">
                          {t("subscription_notifications_custom")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(
                    notificationMode === "custom"
                      ? "subscription_notifications_custom_hint"
                      : "subscription_notifications_default_hint",
                  )}
                </p>
                {notificationMode === "custom" && (
                  <Controller
                    name="notification_reminders"
                    control={control}
                    render={({ field }) => (
                      <RemindersEditor
                        reminders={field.value}
                        onChange={field.onChange}
                        maxReminders={12}
                      />
                    )}
                  />
                )}
                {renderError("notification_reminders")}
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
                calendar={billingCalendar}
                start={
                  watchedTrial
                    ? watch("next_payment")
                    : automaticStartDate(
                        watch("next_payment"),
                        watchedCycleName || "Monthly",
                        watchedFrequency,
                        billingCalendar,
                      )
                }
                anchorDate={watch("next_payment")}
                cycle={watchedCycleName || ""}
                frequency={watchedFrequency}
                price={watch("price")}
                priceChanges={watch("price_changes")}
                trialDuration={watchedTrial ? Number(watch("trial_duration")) : 0}
                trialUnit={watch("trial_unit")}
                trialStartDate={!sub ? watch("next_payment") : watch("trial_start_date")}
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
                disabled={isSubmitting || creatingCategory}
                onChange={setBackfill}
              />
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || creatingCategory}
                onClick={onClose}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  creatingCategory ||
                  (!isPaid && backfill.enabled && !backfill.valid)
                }
              >
                {isSubmitting
                  ? t("loading")
                  : t(!isPaid && backfill.enabled ? "backfill_save" : "save")}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
