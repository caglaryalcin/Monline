import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { localToday } from "@/lib/backfillPayments";
import { findBillingPreset } from "@/lib/billingPeriods";
import { isValidISODate } from "@/lib/dateInput";
import { queryKeys } from "@/lib/queryKeys";
import { nextStatementPaymentDate } from "@/lib/statementPaymentDate";
import { TRIAL_LIMITS } from "@/lib/subscriptionTrial";
import { cyclesService } from "@/services/cycles";
import type { Category, Currency, Cycle, Household, PaymentMethod, Subscription } from "@/types";

const fetchCycles = () => cyclesService.list();
const NO_CYCLES: Cycle[] = [];

// Static schema used only for type inference (no i18n needed for the type)
const _schemaShape = z.object({
  record_type: z.enum(["expense", "credit"]),
  name: z.string(),
  price: z.number().nullable(),
  price_changes: z.array(z.object({ effective_date: z.string(), price: z.number().nullable() })),
  currency: z.string(),
  frequency: z.string(),
  cycle: z.string(),
  billing_preset: z.string(),
  next_payment: z.string(),
  payment_status: z.enum(["unpaid", "paid"]),
  start_date: z.string(),
  payment_method: z.string(),
  payment_account: z.string().optional(),
  payer: z.string(),
  category: z.string(),
  notes: z.string(),
  url: z.string(),
  auto_renew: z.boolean(),
  trial_enabled: z.boolean(),
  trial_duration: z.string(),
  trial_unit: z.enum(["day", "week", "month", "year"]),
  trial_start_date: z.string(),
  notify: z.boolean(),
  notify_days_before: z.string(),
  notification_mode: z.enum(["default", "custom"]),
  notification_reminders: z.array(z.object({ days: z.number(), hour: z.number() })),
  inactive: z.boolean(),
  auto_mark_paid: z.boolean(),
  cancellation_date: z.string(),
  end_mode: z.enum(["never", "date", "payments"]),
  end_date: z.string(),
  payment_limit: z.string(),
  payments_completed: z.string(),
});

export type SubscriptionFormValues = z.infer<typeof _schemaShape>;

interface UseSubscriptionFormInput {
  sub: Subscription | null;
  currencies: Currency[];
  categories: Category[];
  household: Household[];
  paymentMethods?: PaymentMethod[];
}

const nextMonthDate = () => {
  const now = new Date();
  return nextStatementPaymentDate(localToday(now), now);
};

const toDateOnly = (value: string | null | undefined): string => {
  if (!value) return "";
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? value.slice(0, 10);
};

export function useSubscriptionForm({
  sub,
  currencies,
  categories,
  household,
  paymentMethods,
}: UseSubscriptionFormInput) {
  const { t } = useTranslation();

  const { data: cycles = NO_CYCLES } = useQuery({
    queryKey: queryKeys.cycles(),
    queryFn: fetchCycles,
  });

  const schema = z
    .object({
      record_type: z.enum(["expense", "credit"]),
      name: z.string().trim().min(1, t("required")),
      price: z
        .number()
        .nonnegative()
        .nullable()
        .refine((value) => value !== null, t("required")),
      currency: z.string().min(1, t("required")),
      price_changes: z.array(z.object({
        effective_date: z.string().min(1, t("required")).refine(isValidISODate, t("validation_date")),
        price: z.number().nonnegative().max(1e12).nullable().refine((value) => value !== null, t("required")),
      })).max(100, t("price_changes_invalid")),
      frequency: z.string().min(1, t("required")),
      cycle: z.string().min(1, t("required")),
      // UI-only: which preset drives cycle/frequency, or "custom". Never sent.
      billing_preset: z.string(),
      payment_status: z.enum(["unpaid", "paid"]),
      next_payment: z
        .string()
        .min(1, t("required"))
        .refine((date) => !date || isValidISODate(date), t("validation_date")),
      // Stored for compatibility when editing; new tracking dates are inferred.
      start_date: z.string(),
      payment_method: z.string(),
      payment_account: z.string().optional(),
      payer: z.string(),
      category: z
        .string()
        .trim()
        .refine((id) => categories.some((category) => category.id === id), t("category_required")),
      notes: z.string(),
      // Kept for old records/backups; the user no longer enters a URL.
      url: z.string(),
      auto_renew: z.boolean(),
      trial_enabled: z.boolean(),
      trial_duration: z.string(),
      trial_unit: z.enum(["day", "week", "month", "year"]),
      trial_start_date: z.string(),
      notify: z.boolean(),
      notify_days_before: z.string(),
      notification_mode: z.enum(["default", "custom"]),
      notification_reminders: z.array(
        z.object({
          days: z.number().int().min(0).max(365),
          hour: z.number().int().min(0).max(23),
        }),
      ),
      inactive: z.boolean(),
      auto_mark_paid: z.boolean(),
      cancellation_date: z
        .string()
        .refine((date) => !date || isValidISODate(date), t("validation_date")),
      end_mode: z.enum(["never", "date", "payments"]),
      end_date: z.string().refine((date) => !date || isValidISODate(date), t("validation_date")),
      payment_limit: z.string(),
      payments_completed: z.string(),
    })
    .superRefine((values, context) => {
      if (values.record_type === "credit") return;
      const dates = new Set<string>();
      values.price_changes.forEach((change, index) => {
        const saved = sub?.price_changes?.find((item) => item.effective_date === change.effective_date);
        if (dates.has(change.effective_date)) {
          context.addIssue({ code: "custom", path: ["price_changes", index, "effective_date"], message: t("price_changes_duplicate_date") });
        } else if (change.effective_date && change.effective_date <= localToday() && (!saved || saved.price !== change.price)) {
          context.addIssue({ code: "custom", path: ["price_changes", index, "effective_date"], message: t("price_changes_future_only") });
        }
        dates.add(change.effective_date);
      });
      if (values.trial_enabled && (!Number.isInteger(Number(values.trial_duration)) ||
          Number(values.trial_duration) < 1 || Number(values.trial_duration) > TRIAL_LIMITS[values.trial_unit])) {
        context.addIssue({ code: "custom", path: ["trial_duration"], message: t("trial_duration_invalid", { max: TRIAL_LIMITS[values.trial_unit] }) });
      }
      if (!sub && values.payment_status === "paid" && values.next_payment > localToday()) {
        context.addIssue({
          code: "custom",
          path: ["next_payment"],
          message: t("payment_date_future"),
        });
      }

      if (
        values.notification_mode === "custom" &&
        (values.notification_reminders.length < 1 || values.notification_reminders.length > 12)
      ) {
        context.addIssue({
          code: "custom",
          path: ["notification_reminders"],
          message: t("subscription_reminders_invalid"),
        });
      }

      const frequency = Number(values.frequency);
      if (values.frequency && (!Number.isInteger(frequency) || frequency < 1)) {
        context.addIssue({
          code: "custom",
          path: ["frequency"],
          message: t("frequency_min"),
        });
      }

      if (values.end_mode === "date") {
        if (!values.end_date) {
          context.addIssue({
            code: "custom",
            path: ["end_date"],
            message: t("required"),
          });
        } else if (values.end_date < values.next_payment) {
          context.addIssue({
            code: "custom",
            path: ["end_date"],
            message: t("end_date_after_next_payment"),
          });
        }
      }

      if (values.end_mode === "payments") {
        const limit = Number(values.payment_limit);
        const completed = Number(values.payments_completed);
        if (!Number.isInteger(limit) || limit < 1) {
          context.addIssue({
            code: "custom",
            path: ["payment_limit"],
            message: t("positive_payment_limit"),
          });
        }
        if (
          !values.payments_completed.trim() ||
          !Number.isInteger(completed) ||
          completed < 0 ||
          completed > limit
        ) {
          context.addIssue({
            code: "custom",
            path: ["payments_completed"],
            message: t(values.payments_completed.trim() ? "payments_completed_range" : "required"),
          });
        } else if (completed === limit && !values.inactive) {
          context.addIssue({
            code: "custom",
            path: ["payments_completed"],
            message: t("payments_completed_reactivate"),
          });
        }
      }
    });

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      record_type: "expense",
      name: "",
      price: null,
      price_changes: [],
      currency: "",
      frequency: "1",
      cycle: "",
      billing_preset: "monthly",
      next_payment: nextMonthDate(),
      payment_status: "unpaid",
      start_date: new Date().toISOString().split("T")[0],
      payment_method: "",
      payment_account: "",
      payer: "",
      category: "",
      notes: "",
      url: "",
      auto_renew: true,
      trial_enabled: false,
      trial_duration: "1",
      trial_unit: "month",
      trial_start_date: localToday(),
      notify: false,
      notify_days_before: "3",
      notification_mode: "default",
      notification_reminders: [{ days: 3, hour: 8 }],
      inactive: false,
      auto_mark_paid: false,
      cancellation_date: "",
      end_mode: "never",
      end_date: "",
      payment_limit: "",
      payments_completed: "0",
    },
  });

  const { reset, watch } = form;

  // ── Pre-fill / reset form when sub or dependencies change ─────────────────
  useEffect(() => {
    const confirmedPayers = household.filter((member) => member.account_confirmed);
    const defaultPayer =
      confirmedPayers.find((member) => member.is_main)?.id || confirmedPayers[0]?.id || "";
    if (sub) {
      reset({
        record_type: sub.record_type === "credit" ? "credit" : "expense",
        name: sub.name,
        price: sub.price,
        price_changes: sub.price_changes ?? [],
        currency: sub.currency,
        frequency: String(sub.frequency),
        cycle: sub.cycle,
        billing_preset: findBillingPreset(
          (sub.expand?.cycle ?? cycles.find((c) => c.id === sub.cycle))?.name,
          sub.frequency,
        ),
        next_payment: toDateOnly(sub.next_payment),
        payment_status: "unpaid",
        start_date: toDateOnly(sub.start_date) || new Date().toISOString().split("T")[0],
        payment_method: sub.payment_method || "",
        payment_account: sub.payment_account || "",
        payer: sub.payer || "",
        category: sub.category || "",
        notes: sub.notes || "",
        url: sub.url || "",
        auto_renew: !sub.inactive && sub.auto_renew,
        trial_enabled: (sub.trial_duration || sub.trial_months || 0) > 0,
        trial_duration: String(sub.trial_duration || sub.trial_months || 1),
        trial_unit: sub.trial_unit || "month",
        trial_start_date: sub.trial_start_date || localToday(),
        notify: sub.notify,
        notify_days_before: String(sub.notify_days_before ?? 3),
        notification_mode: sub.notification_reminders ? "custom" : "default",
        notification_reminders: sub.notification_reminders ?? [{ days: 3, hour: 8 }],
        inactive: sub.inactive,
        auto_mark_paid: !!sub.auto_mark_paid,
        cancellation_date: toDateOnly(sub.cancellation_date),
        end_mode: (sub.payment_limit ?? 0) > 0 ? "payments" : sub.end_date ? "date" : "never",
        end_date: toDateOnly(sub.end_date),
        payment_limit: sub.payment_limit ? String(sub.payment_limit) : "",
        payments_completed: String(sub.payments_completed ?? 0),
      });
    } else {
      const mainCur = currencies.find((c) => c.is_main);
      const monthCycle = cycles.find((c) => c.name === "Monthly");
      reset({
        record_type: "expense",
        name: "",
        price: null,
        price_changes: [],
        currency: mainCur?.id || currencies[0]?.id || "",
        frequency: "1",
        cycle: monthCycle?.id || cycles[0]?.id || "",
        billing_preset: monthCycle ? "monthly" : "custom",
        next_payment: nextMonthDate(),
        payment_status: "unpaid",
        start_date: new Date().toISOString().split("T")[0],
        payment_method: paymentMethods?.find((method) => method.is_main)?.id || "",
        payment_account: "",
        payer: defaultPayer,
        category: "",
        notes: "",
        url: "",
        auto_renew: true,
        trial_enabled: false,
        trial_duration: "1",
        trial_unit: "month",
        trial_start_date: localToday(),
        notify: false,
        notify_days_before: "3",
        notification_mode: "default",
        notification_reminders: [{ days: 3, hour: 8 }],
        inactive: false,
        auto_mark_paid: false,
        cancellation_date: "",
        end_mode: "never",
        end_date: "",
        payment_limit: "",
        payments_completed: "0",
      });
    }
  }, [sub, currencies, cycles, household, paymentMethods, reset]);

  const watchedCurrency = watch("currency");
  const selectedCurrency = currencies.find((c) => c.id === watchedCurrency);

  return { ...form, cycles, selectedCurrency };
}
