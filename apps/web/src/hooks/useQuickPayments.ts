import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { queryKeys } from "@/lib/queryKeys";
import { type QuickPaymentActions, type QuickPaymentTarget, quickPaymentTarget } from "@/lib/quickPayment";
import { toast } from "@/lib/toast";
import { paymentRecordsService } from "@/services/paymentRecords";
import type { Subscription } from "@/types";

export function useQuickPayments() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const today = useLocalToday();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";
  const enabled = !!userId && !!user?.payment_tracking;
  const records = useQuery({
    queryKey: queryKeys.paymentRecords.all(userId),
    queryFn: () => paymentRecordsService.listForUser(userId),
    enabled,
  });
  const [target, setTarget] = useState<QuickPaymentTarget | null>(null);
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationFn: (payment: QuickPaymentTarget) => paymentRecordsService.quickPay(payment.subscription.id, {
      due_date: payment.date,
      expected_amount: payment.amount,
      expected_currency: payment.currency,
      utc_offset_minutes: new Date().getTimezoneOffset(),
    }),
    onSuccess: async () => {
      setTarget(null);
      toast.success(t("marked_as_paid"));
      await queryClient.invalidateQueries();
    },
    onError: async (error: unknown) => {
      setTarget(null);
      const key = error instanceof Error && ["quick_payment_changed", "quick_payment_unavailable"].includes(error.message)
        ? error.message : "quick_payment_failed";
      toast.error(t(key));
      await queryClient.invalidateQueries({ queryKey: queryKeys.paymentRecords.all(userId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all(userId) });
    },
    onSettled: () => { submitting.current = false; },
  });
  const find = (sub: Subscription, date?: string) => enabled && records.isSuccess && !records.isError
    ? quickPaymentTarget(sub, records.data, userId, today, date) : null;
  const actions: QuickPaymentActions = {
    canPay: (sub, date) => !!find(sub, date),
    select: (sub, date) => { if (!submitting.current) setTarget(find(sub, date)); },
  };
  return {
    actions,
    target,
    pending: mutation.isPending,
    close: () => { if (!submitting.current) setTarget(null); },
    confirm: () => {
      if (!target || submitting.current || target.subscription.user !== userId) return;
      submitting.current = true;
      mutation.mutate(target);
    },
  };
}
