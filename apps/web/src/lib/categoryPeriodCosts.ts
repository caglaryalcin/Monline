import type { StatisticsSubscriptionDetail } from "@/components/statistics/statistics.types";
import { categoryLabel } from "@/lib/categoryLabel";
import { buildPaymentStatistics } from "@/lib/paymentStatistics";
import { recordedPayments } from "@/lib/recordedPayments";
import type { Currency, PaymentRecord, Subscription } from "@/types";

export type CategoryPeriod = 1 | 3 | 6 | 12;
export type CategoryCostMode = "upcoming" | "paid";

/** Confirmed payments or the same upcoming charges shown in the monthly payment view. */
export function categoryPeriodCosts(
  subscriptions: Subscription[],
  currencies: Currency[],
  months: CategoryPeriod,
  t: (key: string, options?: { defaultValue: string }) => string,
  now = new Date(),
  options: { mode?: CategoryCostMode; records?: PaymentRecord[]; year?: number } = {},
) {
  const totals = new Map<string, { value: number; count: number }>();
  const details = new Map<string, Map<string, StatisticsSubscriptionDetail>>();
  const uncategorized = new Set<string>();
  const mode = options.mode ?? "paid";
  let paymentCount = 0;
  let unpricedCount = 0;
  const dates = Array.from({ length: options.year === undefined ? months : 12 }, (_, index) =>
    options.year === undefined
      ? new Date(now.getFullYear(), now.getMonth() + (mode === "paid" ? 1 - months : 0) + index, 1)
      : new Date(options.year, index, 1),
  );
  const add = (subscription: Subscription, amount: number, count = 1) => {
    const name = subscription.expand?.category
      ? categoryLabel(subscription.expand.category, t)
      : t("statistics_category_uncategorized");
    if (!subscription.expand?.category) uncategorized.add(subscription.id);
    const previous = totals.get(name) ?? { value: 0, count: 0 };
    totals.set(name, { value: previous.value + amount, count: previous.count + count });
    const categoryDetails = details.get(name) ?? new Map<string, StatisticsSubscriptionDetail>();
    const detail = categoryDetails.get(subscription.id) ?? {
      id: subscription.id,
      name: subscription.name,
      value: 0,
      count: 0,
    };
    detail.value += amount;
    detail.count = (detail.count ?? 0) + count;
    categoryDetails.set(subscription.id, detail);
    details.set(name, categoryDetails);
    paymentCount += count;
  };
  if (mode === "paid") {
    const last = dates.at(-1)!;
    const end = new Date(last.getFullYear(), last.getMonth() + 1, 1);
    for (const payment of recordedPayments(subscriptions, currencies, options.records ?? [], now)) {
      if (payment.paidAt < dates[0] || payment.paidAt >= end) continue;
      if (payment.amount === null) {
        unpricedCount++;
        continue;
      }
      add(payment.subscription, payment.amount);
    }
  } else {
    const payments = buildPaymentStatistics(
      subscriptions,
      currencies,
      options.records ?? [],
      now,
      months,
      months,
      options.year,
    );
    for (const month of payments.upcoming) {
      for (const entry of month.subscriptions) add(entry.subscription, entry.amount, entry.count);
    }
  }
  const key = (date: Date) =>
    `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  return {
    data: [...totals]
      .map(([name, { value, count }]) => ({ name, value: Number(value.toFixed(2)), count }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)),
    from: key(dates[0]),
    to: key(dates.at(-1)!),
    paymentCount,
    unpricedCount,
    uncategorizedCount: uncategorized.size,
    categoryDetails: Object.fromEntries(
      [...details].map(([name, subscriptions]) => [
        name,
        [...subscriptions.values()]
          .map((detail) => ({ ...detail, value: Number(detail.value.toFixed(2)) }))
          .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)),
      ]),
    ),
  };
}
