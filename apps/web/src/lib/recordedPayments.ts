import { toDateOnly } from "@/components/calendar/types";
import { isCredit } from "@/lib/recordTypes";
import { paymentOwnerId, withStandalonePayments } from "@/lib/standalonePayments";
import type { Currency, PaymentRecord, Subscription } from "@/types";

/** Confirmed charges, shared by the monthly and category statistics. */
export function recordedPayments(
  subscriptions: Subscription[],
  currencies: Currency[],
  records: PaymentRecord[],
  now = new Date(),
) {
  const subscriptionById = new Map(
    withStandalonePayments(subscriptions, records, currencies)
      .filter((sub) => !isCredit(sub))
      .map((sub) => [sub.id, sub]),
  );
  const mainRate = currencies.find((currency) => currency.is_main)?.rate || 1;
  const currencyById = new Map(currencies.map((currency) => [currency.id, currency]));
  const unique = new Map<string, { record: PaymentRecord; paidAt: Date }>();
  for (const record of records) {
    if (!record.paid_at || !subscriptionById.has(paymentOwnerId(record))) continue;
    const paidAt = new Date(record.paid_at.replace(" ", "T"));
    if (!Number.isFinite(paidAt.getTime()) || paidAt > now) continue;
    const key = `${paymentOwnerId(record)}:${toDateOnly(record.due_date)}`;
    const previous = unique.get(key);
    if (!previous || paidAt > previous.paidAt) unique.set(key, { record, paidAt });
  }
  return [...unique.values()].map(({ record, paidAt }) => {
    const subscription = subscriptionById.get(paymentOwnerId(record))!;
    const currency = currencyById.get(subscription.currency) ?? subscription.expand?.currency;
    const validAmount =
      typeof record.amount === "number" && Number.isFinite(record.amount) && record.amount >= 0;
    return {
      record,
      subscription,
      paidAt,
      amount: validAmount
        ? Number(((record.amount! / (currency?.rate || 1)) * mainRate).toFixed(2))
        : null,
    };
  });
}
