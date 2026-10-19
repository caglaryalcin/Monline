import type { Currency, PaymentRecord, Subscription } from "@/types";

import { buildPaymentStatistics } from "./paymentStatistics";

const now = new Date(2026, 9, 17, 12);
const sub: Subscription = {
  id: "s",
  name: "Streaming",
  price: 100,
  currency: "usd",
  user: "u",
  frequency: 1,
  cycle: "m",
  start_date: "2026-01-01",
  next_payment: "2026-11-05",
  auto_renew: true,
  notify: false,
  notify_days_before: 0,
  inactive: false,
  expand: { cycle: { id: "m", name: "Monthly" } },
};
const currencies: Currency[] = [
  { id: "usd", code: "USD", name: "Dollar", symbol: "$", rate: 1, is_main: false, user: "u" },
  { id: "eur", code: "EUR", name: "Euro", symbol: "€", rate: 0.8, is_main: true, user: "u" },
];
const record = (overrides: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: "p",
  subscription_id: "s",
  user: "u",
  due_date: "2026-09-05",
  paid_at: "2026-10-03T12:00:00",
  amount: 10,
  ...overrides,
});

describe("monthly payment statistics", () => {
  it("limits both views to January–December of the selected calendar year", () => {
    const payments = [
      record({ id: "january", due_date: "2026-01-05", paid_at: "2026-01-05T12:00:00", amount: 20 }),
      record({ id: "october", amount: 30 }),
      record({
        id: "last-year",
        due_date: "2025-12-05",
        paid_at: "2025-12-05T12:00:00",
        amount: 999,
      }),
    ];
    const current = buildPaymentStatistics([sub], [], payments, now, 12, 12, 2026);
    expect(current.paid[0]).toMatchObject({ name: "2026/01", total: 20 });
    expect(current.paid.at(-1)?.name).toBe("2026/12");
    expect(current.paid.reduce((sum, month) => sum + month.total, 0)).toBe(50);
    expect(current.upcoming.reduce((sum, month) => sum + month.total, 0)).toBe(200);
    expect(current.upcoming.filter((month) => month.count).map((month) => month.name)).toEqual([
      "2026/11",
      "2026/12",
    ]);
    const previous = buildPaymentStatistics([sub], [], payments, now, 12, 12, 2025);
    expect(previous.paid.reduce((sum, month) => sum + month.total, 0)).toBe(999);
    expect(previous.upcoming.every((month) => month.count === 0)).toBe(true);
  });
  it("uses the requested number of months and keeps paid totals inside the selected history window", () => {
    const result = buildPaymentStatistics(
      [sub],
      [],
      [
        record({ id: "start", due_date: "2025-11-05", paid_at: "2025-11-05T12:00:00", amount: 20 }),
        record({ id: "end", amount: 30 }),
        record({
          id: "before",
          due_date: "2025-10-05",
          paid_at: "2025-10-05T12:00:00",
          amount: 999,
        }),
      ],
      now,
      12,
      12,
    );
    expect(result.paid).toHaveLength(12);
    expect(result.paid[0]).toMatchObject({ name: "2025/11", total: 20 });
    expect(result.paid.at(-1)).toMatchObject({ name: "2026/10", total: 30 });
    expect(result.paid.reduce((total, month) => total + month.total, 0)).toBe(50);
    expect(result.upcoming).toHaveLength(12);
    expect(result.upcoming.at(-1)?.name).toBe("2027/09");
    for (const period of [1, 3, 6, 12]) {
      const window = buildPaymentStatistics([sub], [], [], now, period, period);
      expect(window.paid).toHaveLength(period);
      expect(window.upcoming).toHaveLength(period);
    }
  });
  it("keeps an October payment but stops all future projections when renewal is disabled", () => {
    const chatgpt = { ...sub, id: "chatgpt", name: "Chatgpt", price: 5299, auto_renew: false };
    const payments = [record({ subscription_id: "chatgpt", amount: 5000 })];
    const result = buildPaymentStatistics([chatgpt, sub], [], payments, now);
    expect(result.paid.at(-1)).toMatchObject({ name: "2026/10", total: 5000, count: 1 });
    for (const month of result.upcoming.slice(1)) {
      expect(month.total).toBe(100);
      expect(month.subscriptions.map((item) => item.subscription.id)).toEqual(["s"]);
    }
    const renewed = buildPaymentStatistics(
      [{ ...chatgpt, auto_renew: true }, sub],
      [],
      payments,
      now,
    );
    expect(renewed.upcoming[1].total).toBe(5399);
  });

  it("still includes an unpaid one-time charge on its scheduled date without renewing it", () => {
    const oneTime = {
      ...sub,
      auto_renew: false,
      expand: { cycle: { id: "one-time", name: "One-Time" as const } },
    };
    const result = buildPaymentStatistics([oneTime], [], [], now);
    expect(result.upcoming[1]).toMatchObject({ name: "2026/11", total: 100, count: 1 });
    expect(result.upcoming.slice(2).every((month) => month.count === 0)).toBe(true);
  });
  it("groups actual payments by paid date, keeps inactive subscriptions, converts currency, and deduplicates charges", () => {
    const result = buildPaymentStatistics(
      [{ ...sub, inactive: true }],
      currencies,
      [
        record(),
        record({ id: "duplicate", paid_at: "2026-10-04T12:00:00", amount: 12 }),
        record({
          id: "september",
          due_date: "2026-10-05",
          paid_at: "2026-09-29T12:00:00",
          amount: 20,
        }),
      ],
      now,
    );
    expect(result.paid).toHaveLength(6);
    expect(result.paid.at(-1)).toMatchObject({ name: "2026/10", count: 1, total: 9.6 });
    expect(result.paid.at(-2)).toMatchObject({ name: "2026/09", count: 1, total: 16 });
    expect(result.upcoming.every((month) => month.count === 0)).toBe(true);
  });

  it("keeps missing amounts separate, preserves zero, and excludes unconfirmed, future, and income records", () => {
    const result = buildPaymentStatistics(
      [sub, { ...sub, id: "income", record_type: "credit" }],
      [],
      [
        record({ amount: undefined }),
        record({ id: "zero", due_date: "2026-10-01", amount: 0 }),
        record({ id: "unpaid", due_date: "2026-10-02", paid_at: undefined }),
        record({ id: "future", due_date: "2026-10-03", paid_at: "2026-10-20T12:00:00" }),
        record({ id: "income", subscription_id: "income" }),
      ],
      now,
    );
    expect(result.paid.at(-1)).toMatchObject({ total: 0, count: 1, unpricedCount: 1 });
    expect(result.paid.at(-1)?.subscriptions).toHaveLength(1);
    expect(result.paid.at(-1)?.subscriptions[0].amount).toBe(0);
  });

  it("keeps upcoming charges out of paid totals and counts future weekly charges individually", () => {
    const weekly: Subscription = {
      ...sub,
      price: 10,
      next_payment: "2026-10-03",
      expand: { cycle: { id: "w", name: "Weekly" } },
    };
    const result = buildPaymentStatistics([weekly], [], [], now);
    expect(result.paid.every((month) => month.count === 0)).toBe(true);
    expect(result.upcoming[0]).toMatchObject({ name: "2026/10", count: 3, total: 30 });
    expect(result.upcoming[0].subscriptions).toHaveLength(1);
    expect(result.upcoming.at(-1)?.name).toBe("2027/03");
  });
});
