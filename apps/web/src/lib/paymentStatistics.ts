import { getPaymentRecord, parseLocalDate, toDateStr } from "@/components/calendar/types";
import { buildMonthlyBudget } from "@/lib/monthlyBudget";
import { recordedPayments } from "@/lib/recordedPayments";
import type { Currency, PaymentRecord, Subscription } from "@/types";

export interface SubscriptionPaymentTotal {
  subscription: Subscription;
  amount: number;
  count: number;
  nextDate?: string;
  dates?: string[];
}
export interface MonthlyPaymentTotal {
  name: string;
  total: number;
  count: number;
  unpricedCount: number;
  subscriptions: SubscriptionPaymentTotal[];
}

export function buildPaymentStatistics(
  subscriptions: Subscription[],
  currencies: Currency[],
  records: PaymentRecord[],
  now = new Date(),
  upcomingMonths = 6,
  paidMonths = 6,
  selectedYear?: number,
) {
  const makeMonths = (offset: number, count = 6): MonthlyPaymentTotal[] =>
    Array.from({ length: count }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() + offset + index, 1);
      return {
        name: `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`,
        total: 0,
        count: 0,
        unpricedCount: 0,
        subscriptions: [],
      };
    });
  const yearOffset =
    selectedYear === undefined
      ? undefined
      : (selectedYear - now.getFullYear()) * 12 - now.getMonth();
  const paid =
    yearOffset === undefined ? makeMonths(1 - paidMonths, paidMonths) : makeMonths(yearOffset, 12);
  const upcoming =
    yearOffset === undefined ? makeMonths(0, upcomingMonths) : makeMonths(yearOffset, 12);
  const today = toDateStr(now);
  const calendarRecords = records.filter((record) => {
    if (!record.paid_at) return true;
    const timestamp = new Date(record.paid_at.replace(" ", "T"));
    return Number.isFinite(timestamp.getTime()) && timestamp <= now;
  });
  const add = (
    month: MonthlyPaymentTotal,
    subscription: Subscription,
    amount: number,
    nextDate?: string,
    paymentDate?: string,
  ) => {
    const detail = month.subscriptions.find((item) => item.subscription.id === subscription.id);
    if (detail) {
      detail.amount += amount;
      detail.count++;
      if (paymentDate) (detail.dates ??= []).push(paymentDate);
      if (nextDate && (!detail.nextDate || nextDate < detail.nextDate)) detail.nextDate = nextDate;
    } else
      month.subscriptions.push({
        subscription,
        amount,
        count: 1,
        ...(nextDate ? { nextDate } : {}),
        ...(paymentDate ? { dates: [paymentDate] } : {}),
      });
    month.total += amount;
    month.count++;
  };
  for (const payment of recordedPayments(subscriptions, currencies, records, now)) {
    const date = payment.paidAt;
    const name = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
    const month = paid.find((item) => item.name === name);
    if (!month) continue;
    if (payment.amount === null) {
      month.unpricedCount++;
      continue;
    }
    add(month, payment.subscription, payment.amount, undefined, toDateStr(date));
  }
  for (const month of upcoming) {
    const [year, number] = month.name.split("/").map(Number);
    for (const entry of buildMonthlyBudget(
      subscriptions,
      currencies,
      calendarRecords,
      true,
      new Date(year, number - 1, 1),
    )) {
      const next = parseLocalDate(entry.subscription.next_payment);
      const savedPayment = getPaymentRecord(calendarRecords, entry.subscription.id, entry.date);
      const canProject =
        entry.subscription.auto_renew || entry.subscription.expand?.cycle?.name === "One-Time";
      // Saved charges authorize only their own date, even outside the current
      // renewal schedule. Unrecorded renewals still start at next_payment.
      if (
        (entry.subscription.inactive && !entry.subscription.standalone_payment_id) ||
        !parseLocalDate(entry.date) ||
        (!savedPayment && (!canProject || !next || entry.date < toDateStr(next))) ||
        entry.date < today ||
        !Number.isFinite(entry.amount) ||
        entry.amount < 0 ||
        entry.status === "paid"
      )
        continue;
      add(month, entry.subscription, entry.amount, entry.date, entry.date);
    }
  }
  for (const month of [...paid, ...upcoming]) {
    month.total = Number(month.total.toFixed(2));
    month.subscriptions.forEach((item) => {
      item.amount = Number(item.amount.toFixed(2));
      item.dates?.sort();
    });
    month.subscriptions.sort((a, b) =>
      a.nextDate && b.nextDate
        ? a.nextDate.localeCompare(b.nextDate) ||
          a.subscription.name.localeCompare(b.subscription.name)
        : b.amount - a.amount || a.subscription.name.localeCompare(b.subscription.name),
    );
  }
  return { paid, upcoming };
}
