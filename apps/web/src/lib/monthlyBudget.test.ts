import type { Currency, PaymentRecord, Subscription } from "@/types";

import { buildMonthlyBudget } from "./monthlyBudget";

const now = new Date(2026, 9, 17);
const usd: Currency = {
  id: "usd",
  code: "USD",
  name: "USD",
  symbol: "$",
  rate: 1,
  is_main: false,
  user: "u",
};
const eur: Currency = { ...usd, id: "eur", code: "EUR", rate: 0.8, is_main: true };
const sub = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: "sub",
  name: "Service",
  price: 100,
  currency: "usd",
  frequency: 1,
  cycle: "monthly",
  user: "u",
  next_payment: "2026-11-05",
  start_date: "2026-01-01",
  auto_renew: true,
  notify: false,
  notify_days_before: 0,
  inactive: false,
  expand: { currency: usd, cycle: { id: "monthly", name: "Monthly" } },
  ...overrides,
});
const payment = (overrides: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: "payment",
  subscription_id: "sub",
  user: "u",
  due_date: "2026-10-05",
  paid_at: "2026-10-06T12:00:00Z",
  amount: 90,
  ...overrides,
});

describe("this month's subscription charges", () => {
  it.each([true, false])(
    "retains unconfirmed past charges at their saved amount after the schedule advances (tracking: %s)",
    (tracking) => {
      const records = [payment({ paid_at: "", amount: 69.9 })];
      const entries = buildMonthlyBudget([sub({ price: 99.9 })], [usd], records, tracking, now);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ date: "2026-10-05", amount: 69.9, status: "overdue" });
      expect(buildMonthlyBudget([sub()], [usd], [], tracking, now)).toEqual([]);
      const paid = buildMonthlyBudget([sub()], [usd], [payment({ amount: 69.9 })], tracking, now);
      expect(paid[0]).toMatchObject({ amount: 69.9, status: "paid" });
    },
  );
  it("includes recorded past charges after next_payment advances and uses actual paid amounts and main-currency conversion", () => {
    const entries = buildMonthlyBudget(
      [sub()],
      [usd, eur],
      [payment(), payment({ id: "duplicate", amount: undefined, paid_at: undefined })],
      true,
      now,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: "2026-10-05", amount: 72, status: "paid" });
  });

  it("lists weekly occurrences individually and includes annual charges only in their payment month", () => {
    const weekly = sub({
      id: "weekly",
      price: 10,
      next_payment: "2026-10-03",
      expand: { cycle: { id: "weekly", name: "Weekly" }, currency: usd },
    });
    const yearly = sub({
      id: "yearly",
      price: 1200,
      next_payment: "2026-10-15",
      expand: { cycle: { id: "yearly", name: "Yearly" }, currency: usd },
    });
    const otherYearly = { ...yearly, id: "other", next_payment: "2026-12-15" };
    const entries = buildMonthlyBudget([weekly, yearly, otherYearly], [usd], [], true, now);
    expect(entries.filter((entry) => entry.subscription.id === "weekly")).toHaveLength(5);
    expect(entries.find((entry) => entry.subscription.id === "yearly")?.amount).toBe(1200);
    expect(entries.some((entry) => entry.subscription.id === "other")).toBe(false);
    expect(entries.reduce((sum, entry) => sum + entry.amount, 0)).toBe(1250);
  });

  it("keeps confirmed payments for paused subscriptions, preserves zero amounts, and excludes income", () => {
    const entries = buildMonthlyBudget(
      [sub({ inactive: true }), sub({ id: "income", record_type: "credit" })],
      [usd],
      [payment({ amount: 0 })],
      true,
      now,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ amount: 0, status: "paid" });
  });

  it("does not recreate a cleared charge before next_payment or include payments from another month", () => {
    const entries = buildMonthlyBudget(
      [sub()],
      [usd],
      [payment({ due_date: "2026-09-05" })],
      false,
      now,
    );
    expect(entries).toEqual([]);
  });
});
