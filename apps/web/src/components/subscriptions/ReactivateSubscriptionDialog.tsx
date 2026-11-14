import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useLocalToday } from "@/hooks/useLocalToday";
import { isValidISODate } from "@/lib/dateInput";
import { subscriptionAmount } from "@/lib/subscriptionTrial";
import { toast } from "@/lib/toast";
import { subscriptionsService } from "@/services/subscriptions";
import type { Subscription } from "@/types";

export function ReactivateSubscriptionDialog({ subscription, onClose, onReactivated }: {
  subscription: Subscription; onClose: () => void; onReactivated?: () => void;
}) {
  const { t } = useTranslation();
  const today = useLocalToday();
  const [paidDate, setPaidDate] = useState(today);
  const [price, setPrice] = useState<number | null>(() => subscriptionAmount(subscription, subscription.next_payment.slice(0, 10)));
  const [nextPayment, setNextPayment] = useState(
    subscription.next_payment.slice(0, 10) > today ? subscription.next_payment.slice(0, 10) : "",
  );
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => subscriptionsService.reactivate(subscription.id, {
      paid_date: paidDate, next_payment: nextPayment,
      price: price!, expected_currency: subscription.currency,
      expected_next_payment: subscription.next_payment,
      utc_offset_minutes: new Date().getTimezoneOffset(),
      paid_utc_offset_minutes: new Date(paidDate + "T00:00:00").getTimezoneOffset(),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      onClose();
      onReactivated?.();
      toast.success(t("subscription_reactivated"));
    },
    onError: (error: Error) => toast.error(t(
      ["reactivate_invalid_dates", "reactivate_invalid_amount", "reactivate_changed", "reactivate_schedule_ended", "category_required", "price_changes_invalid"].includes(error.message)
        ? error.message : "subscription_status_error",
    )),
  });
  const valid = price !== null && Number.isFinite(price) && price >= 0 && price <= 1e12 &&
    isValidISODate(paidDate) && paidDate >= "1970-01-01" && paidDate <= today &&
    isValidISODate(nextPayment) && nextPayment > today && nextPayment > paidDate && nextPayment <= "2200-12-31";
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("reactivate_subscription")}: {subscription.name}</DialogTitle>
        <DialogDescription>{t("reactivate_subscription_help")}</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (valid && !mutation.isPending) mutation.mutate();
      }}>
        <div className="space-y-1.5">
          <Label htmlFor="reactivate-new-amount">{t("reactivate_new_amount")}</Label>
          <CurrencyInput id="reactivate-new-amount" value={price} onChange={setPrice} onEmpty={() => setPrice(null)}
            code={subscription.expand?.currency?.code} symbol={subscription.expand?.currency?.symbol}
            disabled={mutation.isPending} />
          <p className="text-xs text-muted-foreground">{t("reactivate_amount_help")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reactivate-paid-date">{t("historical_paid_date")}</Label>
          <DatePicker id="reactivate-paid-date" value={paidDate} onChange={setPaidDate}
            label={t("historical_paid_date")}
            min="1970-01-01" max={today} required disabled={mutation.isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reactivate-next-payment">{t("next_payment")}</Label>
          <DatePicker id="reactivate-next-payment" value={nextPayment} onChange={setNextPayment}
            label={t("next_payment")}
            min={today} max="2200-12-31" required disabled={mutation.isPending} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" disabled={!valid || mutation.isPending}>{t("reactivate_subscription")}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
