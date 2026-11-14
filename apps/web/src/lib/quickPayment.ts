import { getPaymentRecord, parseLocalDate, toDateOnly, toDateStr } from "@/components/calendar/types";
import { isCredit } from "@/lib/recordTypes";
import type { SubscriptionNotRenewedActions } from "@/lib/subscriptionNotRenewed";
import { subscriptionAmount } from "@/lib/subscriptionTrial";
import type { Currency, PaymentRecord, Subscription } from "@/types";

export interface QuickPaymentTarget {
  subscription: Subscription;
  date: string;
  amount: number;
  currency: string;
  currencyInfo?: Currency;
}

export interface QuickPaymentActions {
  notRenewed?: SubscriptionNotRenewedActions;
  canPay: (subscription: Subscription, date?: string) => boolean;
  select: (subscription: Subscription, date?: string) => void;
}

/** Saved pending charges remain payable after the scheduler advances next_payment. */
export function quickPaymentTarget(
  subscription: Subscription,
  records: PaymentRecord[],
  userId: string,
  today: string,
  requestedDate?: string,
): QuickPaymentTarget | null {
  if (subscription.user !== userId || subscription.inactive || subscription.auto_mark_paid ||
      subscription.standalone_payment_id || isCredit(subscription)) return null;
  const limit = parseLocalDate(today);
  if (!limit) return null;
  limit.setDate(limit.getDate() + 2);
  const cutoff = toDateStr(limit);
  const own = records.filter((record) => record.subscription_id === subscription.id && record.user === userId);
  const anchor = toDateOnly(subscription.next_payment);
  const dates = requestedDate ? [requestedDate] : [...new Set([
    ...own.map((record) => toDateOnly(record.due_date)), anchor,
  ])].sort();
  for (const date of dates) {
    if (!parseLocalDate(date) || date > cutoff) continue;
    const record = getPaymentRecord(own, subscription.id, date);
    if (record?.paid_at) continue;
    if (!record) {
      if (date !== anchor || subscription.calendar_projection_hidden ||
          (subscription.start_date && date < toDateOnly(subscription.start_date)) ||
          (subscription.end_date && date > toDateOnly(subscription.end_date)) ||
          (subscription.cancellation_date && date > toDateOnly(subscription.cancellation_date)) ||
          (subscription.calendar_projection_from && date < toDateOnly(subscription.calendar_projection_from)) ||
          ((subscription.payment_limit ?? 0) > 0 && (subscription.payments_completed ?? 0) >= subscription.payment_limit!) ||
          own.some((saved) => saved.scheduled_date === date && toDateOnly(saved.due_date) !== date)) continue;
    }
    const amount = record?.amount ?? subscriptionAmount(subscription, date);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const currency = record?.currency || subscription.currency;
    const currencyInfo = record?.expand?.currency?.id === currency ? record.expand.currency
      : subscription.expand?.currency?.id === currency ? subscription.expand.currency : undefined;
    return { subscription, date, amount, currency, currencyInfo };
  }
  return null;
}
