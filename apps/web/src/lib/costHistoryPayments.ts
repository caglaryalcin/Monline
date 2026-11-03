import { toDateOnly, toDateStr } from "@/components/calendar/types";
import { buildMonthlyBudget } from "@/lib/monthlyBudget";
import { recordedPayments } from "@/lib/recordedPayments";
import { isCredit } from "@/lib/recordTypes";
import { paymentOwnerId } from "@/lib/standalonePayments";
import type { Currency, PaymentRecord, Subscription } from "@/types";

export interface CostHistoryPayment {
  id: string;
  name: string;
  date: string;
  amount: number;
  overdue?: boolean;
}
export interface CostHistoryPaymentMonth {
  paid: CostHistoryPayment[];
  pending: CostHistoryPayment[];
}
export type CostHistoryPaymentDetails = Record<string, CostHistoryPaymentMonth>;

/** Keep hover details and forecast amounts on the same dated payment sources. */
export function costHistoryPayments(
  subscriptions: Subscription[],
  currencies: Currency[],
  records: PaymentRecord[],
  year: number,
  now = new Date(),
) {
  const currentMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = toDateStr(now);
  const details: CostHistoryPaymentDetails = {};
  const savedPending = new Set(
    records
      .filter((record) => !record.paid_at)
      .map((record) => `${paymentOwnerId(record)}:${toDateOnly(record.due_date)}`),
  );
  const renewing = subscriptions.filter(
    (subscription) =>
      subscription.auto_renew &&
      !subscription.inactive &&
      !isCredit(subscription) &&
      subscription.expand?.cycle?.name !== "One-Time",
  );
  const count = year === now.getFullYear() && now.getMonth() === 11 ? 13 : 12;
  for (let index = 0; index < count; index++) {
    const date = new Date(year, index, 1);
    const month = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
    const group: CostHistoryPaymentMonth = { paid: [], pending: [] };
    details[month] = group;
    const upcoming = month > currentMonth;
    for (const entry of buildMonthlyBudget(
      upcoming ? renewing : subscriptions,
      currencies,
      records,
      true,
      date,
    )) {
      if (entry.status === "paid" || !Number.isFinite(entry.amount) || entry.amount < 0) continue;
      // Older months show saved unpaid charges, never inferred historical debt.
      if (month < currentMonth && !savedPending.has(entry.id)) continue;
      if (
        upcoming &&
        (!entry.subscription.next_payment ||
          entry.date < toDateOnly(entry.subscription.next_payment))
      )
        continue;
      group.pending.push({
        id: entry.id,
        name: entry.subscription.name,
        date: entry.date,
        amount: entry.amount,
        overdue: entry.date < today,
      });
    }
  }
  recordedPayments(subscriptions, currencies, records, now).forEach((payment, index) => {
    if (payment.amount === null) return;
    const date = toDateStr(payment.paidAt);
    const group = details[date.slice(0, 7).replace("-", "/")];
    if (group)
      group.paid.push({
        id: `${payment.subscription.id}:${date}:${index}`,
        name: payment.subscription.name,
        date,
        amount: payment.amount,
      });
  });
  for (const group of Object.values(details)) {
    for (const items of [group.paid, group.pending])
      items.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  }
  const forecasts = Object.entries(details)
    .filter(
      ([month, group]) =>
        year === now.getFullYear() &&
        month >= currentMonth &&
        (month !== currentMonth || group.pending.length > 0),
    )
    .map(([name, group]) => ({
      name,
      cost: group.pending.reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0) / 100,
    }));
  return { details, forecasts };
}
