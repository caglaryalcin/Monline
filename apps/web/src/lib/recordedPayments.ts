import { toDateOnly } from "@/components/calendar/types";
import { isCredit } from "@/lib/recordTypes";
import type { Currency, PaymentRecord, Subscription } from "@/types";

/** Confirmed charges, shared by the monthly and category statistics. */
export function recordedPayments(
  subscriptions: Subscription[],
  currencies: Currency[],
  records: PaymentRecord[],
  now = new Date(),
) {
  const subscriptionById = new Map(
    subscriptions.filter((sub) => !isCredit(sub)).map((sub) => [sub.id, sub]),
  );
  const mainRate = currencies.find((currency) => currency.is_main)?.rate || 1;
  const currencyById = new Map(currencies.map((currency) => [currency.id, currency]));
  const unique = new Map<string, { record: PaymentRecord; paidAt: Date }>();
  for (const record of records) {
    if (!record.paid_at || !subscriptionById.has(record.subscription_id)) continue;
    const paidAt = new Date(record.paid_at.replace(" ", "T"));
    if (!Number.isFinite(paidAt.getTime()) || paidAt > now) continue;
    const key = `${record.subscription_id}:${toDateOnly(record.due_date)}`;
    const previous = unique.get(key);
    if (!previous || paidAt > previous.paidAt) unique.set(key, { record, paidAt });
  }
  return [...unique.values()].map(({ record, paidAt }) => {
    const subscription = subscriptionById.get(record.subscription_id)!;
    const currency = currencyById.get(subscription.currency) ?? subscription.expand?.currency;
    const validAmount =
      typeof record.amount === "number" && Number.isFinite(record.amount) && record.amount >= 0;
    return {
      subscription,
      paidAt,
      amount: validAmount
        ? Number(((record.amount! / (currency?.rate || 1)) * mainRate).toFixed(2))
        : null,
    };
  });
}
