import type { Currency, PaymentRecord, Subscription } from "@/types";

export function paymentOwnerId(record: PaymentRecord): string {
  return record.subscription_id || record.id;
}

/** Display independent payments alongside subscription charges without creating subscriptions. */
export function withStandalonePayments(
  subscriptions: Subscription[],
  records: PaymentRecord[],
  currencies: Currency[],
): Subscription[] {
  return [
    ...subscriptions,
    ...records
      .filter((record) => !record.subscription_id && record.name)
      .map((record): Subscription => ({
        id: record.id,
        standalone_payment_id: record.id,
        name: record.name!,
        logo: record.logo,
        category: record.category,
        payment_method: record.payment_method,
        payer: record.payer,
        price: record.amount ?? 0,
        currency: record.currency ?? "",
        user: record.user,
        next_payment: record.due_date,
        start_date: "",
        frequency: 1,
        cycle: "",
        auto_renew: false,
        inactive: true,
        notify: false,
        notify_days_before: 0,
        notes: record.notes,
        expand: {
          ...record.expand,
          currency:
            currencies.find((currency) => currency.id === record.currency) ??
            record.expand?.currency,
        },
      })),
  ];
}
