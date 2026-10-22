import {
  getOccurrencesInMonth,
  getPaymentRecord,
  toDateOnly,
  toDateStr,
} from "@/components/calendar/types";
import { isCredit, isDateInMonth } from "@/lib/recordTypes";
import { paymentOwnerId, withStandalonePayments } from "@/lib/standalonePayments";
import type { Currency, PaymentRecord, Subscription } from "@/types";

export interface MonthlyBudgetEntry {
  id: string;
  subscription: Subscription;
  date: string;
  amount: number;
  status: "paid" | "overdue" | "pending" | "scheduled";
}

/** Charges due this calendar month, rather than monthly equivalents of annual prices. */
export function buildMonthlyBudget(
  subscriptions: Subscription[],
  currencies: Currency[],
  records: PaymentRecord[],
  paymentTracking: boolean,
  now = new Date(),
) {
  const today = toDateStr(now);
  const mainRate = currencies.find((currency) => currency.is_main)?.rate || 1;
  const currencyById = new Map(currencies.map((currency) => [currency.id, currency]));
  const recordsBySubscription = new Map<string, PaymentRecord[]>();
  for (const record of records) {
    if (!isDateInMonth(record.due_date, now)) continue;
    const group = recordsBySubscription.get(paymentOwnerId(record)) ?? [];
    group.push(record);
    recordsBySubscription.set(paymentOwnerId(record), group);
  }
  const entries: MonthlyBudgetEntry[] = [];
  for (const subscription of withStandalonePayments(subscriptions, records, currencies)) {
    if (isCredit(subscription)) continue;
    const subscriptionRecords = recordsBySubscription.get(subscription.id) ?? [];
    const dates = new Set(
      getOccurrencesInMonth(subscription, now.getFullYear(), now.getMonth() + 1, []).map(toDateStr),
    );
    // Keep confirmed charges even if the subscription was subsequently paused or rescheduled.
    for (const record of subscriptionRecords) {
      if (record.paid_at) dates.add(toDateOnly(record.due_date));
    }
    const currency = currencyById.get(subscription.currency) ?? subscription.expand?.currency;
    const rate = currency?.rate || 1;
    for (const date of dates) {
      const record = getPaymentRecord(subscriptionRecords, subscription.id, date);
      const paid = !!record?.paid_at;
      const price = paid ? (record.amount ?? subscription.price) : subscription.price;
      entries.push({
        id: `${subscription.id}:${date}`,
        subscription,
        date,
        amount: Number(((price / rate) * mainRate).toFixed(2)),
        status: paid
          ? "paid"
          : !paymentTracking
            ? "scheduled"
            : date < today
              ? "overdue"
              : "pending",
      });
    }
  }
  entries.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.subscription.name.localeCompare(b.subscription.name),
  );
  return entries;
}
