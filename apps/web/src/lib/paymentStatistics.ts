import { parseLocalDate, toDateStr } from "@/components/calendar/types";
import { buildMonthlyBudget } from "@/lib/monthlyBudget";
import { recordedPayments } from "@/lib/recordedPayments";
import type { Currency, PaymentRecord, Subscription } from "@/types";

export interface SubscriptionPaymentTotal {
  subscription: Subscription;
  amount: number;
  count: number;
  nextDate?: string;
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
  const confirmedRecords = records.filter((record) => {
    if (!record.paid_at) return false;
    const timestamp = new Date(record.paid_at.replace(" ", "T"));
    return Number.isFinite(timestamp.getTime()) && timestamp <= now;
  });
  const add = (
    month: MonthlyPaymentTotal,
    subscription: Subscription,
    amount: number,
    nextDate?: string,
  ) => {
    const detail = month.subscriptions.find((item) => item.subscription.id === subscription.id);
    if (detail) {
      detail.amount += amount;
      detail.count++;
      if (nextDate && (!detail.nextDate || nextDate < detail.nextDate)) detail.nextDate = nextDate;
    } else
      month.subscriptions.push({
        subscription,
        amount,
        count: 1,
        ...(nextDate ? { nextDate } : {}),
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
    add(month, payment.subscription, payment.amount);
  }
  // A recurring cycle alone does not authorize future renewals. Keep dated
  // one-time charges, but only project recurring subscriptions that renew.
  const upcomingSubscriptions = subscriptions.filter(
    (subscription) => subscription.auto_renew || subscription.expand?.cycle?.name === "One-Time",
  );
  for (const month of upcoming) {
    const [year, number] = month.name.split("/").map(Number);
    for (const entry of buildMonthlyBudget(
      upcomingSubscriptions,
      currencies,
      confirmedRecords,
      true,
      new Date(year, number - 1, 1),
    )) {
      const next = parseLocalDate(entry.subscription.next_payment);
      // Start at the actual next billing date, never back-project an already advanced schedule.
      if (
        entry.subscription.inactive ||
        !next ||
        entry.date < today ||
        entry.date < toDateStr(next) ||
        !Number.isFinite(entry.amount) ||
        entry.amount < 0 ||
        entry.status === "paid"
      )
        continue;
      add(month, entry.subscription, entry.amount, entry.date);
    }
  }
  for (const month of [...paid, ...upcoming]) {
    month.total = Number(month.total.toFixed(2));
    month.subscriptions.forEach((item) => {
      item.amount = Number(item.amount.toFixed(2));
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
