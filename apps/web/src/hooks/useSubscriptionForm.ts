import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { localToday } from "@/lib/backfillPayments";
import { findBillingPreset } from "@/lib/billingPeriods";
import { queryKeys } from "@/lib/queryKeys";
import { nextStatementPaymentDate } from "@/lib/statementPaymentDate";
import { cyclesService } from "@/services/cycles";
import type { Category, Currency, Cycle, Household, PaymentMethod, Subscription } from "@/types";

const fetchCycles = () => cyclesService.list();
const NO_CYCLES: Cycle[] = [];

// Static schema used only for type inference (no i18n needed for the type)
const _schemaShape = z.object({
  record_type: z.enum(["expense", "credit"]),
  name: z.string(),
  price: z.number().nullable(),
  currency: z.string(),
  frequency: z.string(),
  cycle: z.string(),
  billing_preset: z.string(),
  next_payment: z.string(),
  start_date: z.string(),
  payment_method: z.string(),
  payer: z.string(),
  category: z.string(),
  notes: z.string(),
  url: z.string(),
  auto_renew: z.boolean(),
  notify: z.boolean(),
  notify_days_before: z.string(),
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
      frequency: z.string().min(1, t("required")),
      cycle: z.string().min(1, t("required")),
      // UI-only: which preset drives cycle/frequency, or "custom". Never sent.
      billing_preset: z.string(),
      next_payment: z.string().min(1, t("required")),
      // Stored for compatibility when editing; new tracking dates are inferred.
      start_date: z.string(),
      payment_method: z.string(),
      payer: z.string(),
      category: z
        .string()
        .trim()
        .refine((id) => categories.some((category) => category.id === id), t("category_required")),
      notes: z.string(),
      // Kept for old records/backups; the user no longer enters a URL.
      url: z.string(),
      auto_renew: z.boolean(),
      notify: z.boolean(),
      notify_days_before: z.string(),
      inactive: z.boolean(),
      auto_mark_paid: z.boolean(),
      cancellation_date: z.string(),
      end_mode: z.enum(["never", "date", "payments"]),
      end_date: z.string(),
      payment_limit: z.string(),
      payments_completed: z.string(),
    })
    .superRefine((values, context) => {
      if (values.record_type === "credit") return;

      if (values.notify) {
        const days = Number(values.notify_days_before);
        if (!values.notify_days_before.trim() || !Number.isInteger(days) || days < 0) {
          context.addIssue({
            code: "custom",
            path: ["notify_days_before"],
            message: t("validation_nonnegative_integer"),
          });
        }
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
      currency: "",
      frequency: "1",
      cycle: "",
      billing_preset: "monthly",
      next_payment: nextMonthDate(),
      start_date: new Date().toISOString().split("T")[0],
      payment_method: "",
      payer: "",
      category: "",
      notes: "",
      url: "",
      auto_renew: true,
      notify: false,
      notify_days_before: "3",
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
    if (sub) {
      reset({
        record_type: sub.record_type === "credit" ? "credit" : "expense",
        name: sub.name,
        price: sub.price,
        currency: sub.currency,
        frequency: String(sub.frequency),
        cycle: sub.cycle,
        billing_preset: findBillingPreset(
          (sub.expand?.cycle ?? cycles.find((c) => c.id === sub.cycle))?.name,
          sub.frequency,
        ),
        next_payment: toDateOnly(sub.next_payment),
        start_date: toDateOnly(sub.start_date) || new Date().toISOString().split("T")[0],
        payment_method: sub.payment_method || "",
        payer: sub.payer || "",
        category: sub.category || "",
        notes: sub.notes || "",
        url: sub.url || "",
        auto_renew: !sub.inactive && sub.auto_renew,
        notify: sub.notify,
        notify_days_before: String(sub.notify_days_before || 3),
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
        currency: mainCur?.id || currencies[0]?.id || "",
        frequency: "1",
        cycle: monthCycle?.id || cycles[0]?.id || "",
        billing_preset: monthCycle ? "monthly" : "custom",
        next_payment: nextMonthDate(),
        start_date: new Date().toISOString().split("T")[0],
        payment_method: paymentMethods?.find((method) => method.is_main)?.id || "",
        payer: household.find((member) => member.is_main)?.id || household[0]?.id || "",
        category: "",
        notes: "",
        url: "",
        auto_renew: true,
        notify: false,
        notify_days_before: "3",
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
