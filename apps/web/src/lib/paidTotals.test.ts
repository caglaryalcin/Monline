import type { Currency, PaymentRecord, Subscription } from "@/types";

import { paidTotals } from "./paidTotals";

const subscription = {
  id: "active",
  currency: "try",
  price: 99999,
  inactive: false,
} as Subscription;
const inactive = { ...subscription, id: "inactive", inactive: true };
const currency = { id: "try", rate: 1, is_main: true } as Currency;
const record = (
  id: string,
  date: Date,
  amount = 10,
  sub = subscription.id,
  due?: string,
): PaymentRecord => ({
  id,
  subscription_id: sub,
  user: "user",
  due_date:
    due ??
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
  paid_at: date.toISOString(),
  amount,
});

describe("selected-year paid total and averages", () => {
  it("uses paid dates and recorded amounts, includes paused subscriptions and excludes unpaid charges", () => {
    const now = new Date(2026, 9, 18, 12);
    const paid = record("today", new Date(2026, 9, 18, 10), 30);
    expect(
      paidTotals(
        [subscription, inactive],
        [currency],
        [
          {
            ...paid,
            id: "older-copy",
            amount: 999,
            paid_at: new Date(2026, 9, 18, 9).toISOString(),
          },
          paid,
          record("monday", new Date(2026, 9, 12), 20, inactive.id),
          { ...record("last-week", new Date(2026, 9, 11), 40), due_date: "2026-11-01" },
          record("last-month", new Date(2026, 8, 30), 50),
          record("last-year", new Date(2025, 11, 31), 500),
          { ...paid, id: "pending", due_date: "2026-10-19", paid_at: "", amount: 900 },
          record("future", new Date(2026, 9, 19), 800),
          { ...paid, id: "unknown-amount", due_date: "2026-10-20", amount: undefined },
          { ...paid, id: "bad-date", due_date: "2026-10-21", paid_at: "invalid", amount: 700 },
        ],
        now,
      ),
    ).toEqual({ averageWeekly: 3.33, averageMonthly: 14, totalYearly: 140 });
  });

  it("averages the actual annual charge over elapsed periods instead of today's package price", () => {
    const annual = {
      ...subscription,
      cycle: "yearly",
      expand: { cycle: { id: "yearly", name: "Yearly" as const } },
    };
    expect(
      paidTotals(
        [annual],
        [currency],
        [record("annual", new Date(2026, 9, 15), 1200)],
        new Date(2026, 9, 18),
      ),
    ).toEqual({ averageWeekly: 28.57, averageMonthly: 120, totalYearly: 1200 });
  });

  it("only includes the selected year's paid records and uses all twelve months for past years", () => {
    const records = [
      record("sunday", new Date(2026, 11, 27, 23, 59), 1000),
      record("monday", new Date(2026, 11, 28), 100),
      record("new-year", new Date(2027, 0, 1), 10),
    ];
    expect(paidTotals([subscription], [currency], records, new Date(2027, 0, 1, 12))).toEqual({
      averageWeekly: 10,
      averageMonthly: 10,
      totalYearly: 10,
    });
    expect(paidTotals([subscription], [currency], records, new Date(2027, 0, 4), 2026)).toEqual({
      averageWeekly: 20.75,
      averageMonthly: 91.67,
      totalYearly: 1100,
    });
  });

  it("converts paid amounts to the main currency and excludes income, unknown and negative amounts", () => {
    const usd = { ...subscription, id: "usd-sub", currency: "usd" };
    const credit = { ...subscription, id: "income", record_type: "credit" as const };
    const now = new Date(2026, 9, 18, 12);
    expect(
      paidTotals(
        [subscription, usd, credit],
        [{ ...currency, rate: 40 }, { id: "usd", rate: 1 } as Currency],
        [
          record("usd", now, 5, usd.id),
          record("a", now, 0.1, subscription.id, "2026-10-01"),
          record("b", now, 0.2, subscription.id, "2026-10-02"),
          record("credit", now, 1000, credit.id),
          record("orphan", now, 1000, "missing"),
          record("negative", now, -100, subscription.id, "2026-10-03"),
          record("zero", now, 0, subscription.id, "2026-10-04"),
        ],
        now,
      ),
    ).toEqual({ averageWeekly: 4.77, averageMonthly: 20.03, totalYearly: 200.3 });
  });

  it("returns zero when no payment has been recorded, even with expensive active subscriptions", () => {
    expect(paidTotals([subscription], [currency], [])).toEqual({
      averageWeekly: 0,
      averageMonthly: 0,
      totalYearly: 0,
    });
  });
  it("includes the ongoing month and week, and counts periods without any payment", () => {
    const records = [record("january", new Date(2026, 0, 1), 70)];
    expect(paidTotals([subscription], [currency], records, new Date(2026, 0, 7))).toEqual({
      averageWeekly: 70,
      averageMonthly: 70,
      totalYearly: 70,
    });
    expect(paidTotals([subscription], [currency], records, new Date(2026, 0, 8))).toEqual({
      averageWeekly: 35,
      averageMonthly: 70,
      totalYearly: 70,
    });
    expect(paidTotals([subscription], [currency], records, new Date(2026, 1, 1))).toEqual({
      averageWeekly: 14,
      averageMonthly: 35,
      totalYearly: 70,
    });
    expect(paidTotals([subscription], [currency], records, new Date(2026, 9, 18))).toEqual({
      averageWeekly: 1.67,
      averageMonthly: 7,
      totalYearly: 70,
    });
  });

  it("returns safe zeros for a selected future year", () => {
    expect(paidTotals([subscription], [currency], [], new Date(2026, 9, 18), 2027)).toEqual({
      averageWeekly: 0,
      averageMonthly: 0,
      totalYearly: 0,
    });
  });
});
