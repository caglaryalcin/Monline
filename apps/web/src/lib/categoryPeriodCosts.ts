import type { StatisticsSubscriptionDetail } from "@/components/statistics/statistics.types";
import { categoryLabel } from "@/lib/categoryLabel";
import { financeRowTag } from "@/lib/finance";
import type { StatisticsPaymentMonth } from "@/lib/financePaymentStatistics";
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
  options: {
    mode?: CategoryCostMode;
    records?: PaymentRecord[];
    year?: number;
    upcoming?: StatisticsPaymentMonth[];
  } = {},
) {
  const totals = new Map<string, { value: number; count: number }>();
  const details = new Map<string, Map<string, StatisticsSubscriptionDetail & { count: number }>>();
  const uncategorized = new Set<string>();
  const mode = options.mode ?? "paid";
  let paymentCount = 0;
  let unpricedCount = 0;
  const dates = Array.from({ length: options.year === undefined ? months : 12 }, (_, index) =>
    options.year === undefined
      ? new Date(now.getFullYear(), now.getMonth() + (mode === "paid" ? 1 - months : 0) + index, 1)
      : new Date(options.year, index, 1),
  );
  const addItem = (name: string, id: string, title: string, amount: number, count = 1) => {
    const previous = totals.get(name) ?? { value: 0, count: 0 };
    totals.set(name, { value: previous.value + amount, count: previous.count + count });
    const categoryDetails =
      details.get(name) ?? new Map<string, StatisticsSubscriptionDetail & { count: number }>();
    const detail = categoryDetails.get(id) ?? {
      id,
      name: title,
      value: 0,
      count: 0,
    };
    detail.value += amount;
    detail.count += count;
    categoryDetails.set(id, detail);
    details.set(name, categoryDetails);
    paymentCount += count;
  };
  const add = (subscription: Subscription, amount: number, count = 1) => {
    const name = subscription.expand?.category
      ? categoryLabel(subscription.expand.category, t)
      : t("statistics_category_uncategorized");
    if (!subscription.expand?.category) uncategorized.add(subscription.id);
    addItem(name, subscription.id, subscription.name, amount, count);
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
    const upcoming: StatisticsPaymentMonth[] =
      options.upcoming ??
      buildPaymentStatistics(
        subscriptions,
        currencies,
        options.records ?? [],
        now,
        months,
        months,
        options.year,
      ).upcoming;
    for (const month of upcoming) {
      unpricedCount += month.unpricedCount;
      for (const entry of month.subscriptions) add(entry.subscription, entry.amount, entry.count);
      for (const entry of month.ledger ?? []) {
        const source = subscriptions.find(
          (subscription) => subscription.id === entry.row.source_subscription,
        );
        const tag = financeRowTag(entry.row);
        const name = source?.expand?.category
          ? categoryLabel(source.expand.category, t)
          : t(
              tag === "credit_card"
                ? "finance_credit_card"
                : tag === "loan"
                  ? "finance_loan"
                  : tag === "rent"
                    ? "finance_rent"
                    : tag
                      ? `finance_bill_${tag}`
                      : "statistics_other_ledger_expenses",
            );
        addItem(name, `finance:${entry.row.id}`, entry.row.name, entry.amount, entry.count);
      }
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
