import { costHistoryPayments } from "@/lib/costHistoryPayments";
import { monthlyBudgetFixture } from "@/test/fixtures/monthlyBudget";
import type { Currency, PaymentRecord, Subscription } from "@/types";

const now = new Date(2026, 10, 3, 12);
const currencies: Currency[] = [
  { id: "usd", code: "USD", symbol: "$", name: "Dollar", rate: 1, is_main: true, user: "user" },
];
const subscription: Subscription = {
  ...monthlyBudgetFixture(now).entries[0].subscription,
  id: "plan",
  name: "Cloud plan",
  price: 40,
  currency: "usd",
  cycle: "monthly",
  next_payment: "2026-11-20",
  start_date: "2026-01-20",
  auto_renew: true,
  price_changes: [{ effective_date: "2026-12-01", price: 20 }],
  expand: { cycle: { id: "monthly", name: "Monthly" }, currency: currencies[0] },
};
const payment = (data: Partial<PaymentRecord>): PaymentRecord => ({
  id: "payment",
  user: "user",
  subscription_id: "plan",
  due_date: "2026-10-20",
  amount: 35,
  ...data,
});

it("lists actual paid amounts and applies future dated prices to both forecasts and hover details", () => {
  const result = costHistoryPayments(
    [subscription],
    currencies,
    [payment({ paid_at: "2026-10-20T12:00:00Z" })],
    2026,
    now,
  );
  expect(result.details["2026/10"].paid).toEqual([
    expect.objectContaining({ name: "Cloud plan", amount: 35 }),
  ]);
  expect(result.details["2026/11"].pending).toEqual([
    expect.objectContaining({ date: "2026-11-20", amount: 40, overdue: false }),
  ]);
  expect(result.details["2026/12"].pending).toEqual([expect.objectContaining({ amount: 20 })]);
  expect(result.forecasts).toContainEqual({ name: "2026/12", cost: 20 });
});

it("shows saved overdue charges without inventing unrecorded historical debt", () => {
  const result = costHistoryPayments(
    [subscription],
    currencies,
    [payment({ due_date: "2026-09-20", amount: 38 })],
    2026,
    now,
  );
  expect(result.details["2026/09"].pending).toEqual([
    expect.objectContaining({ amount: 38, overdue: true }),
  ]);
  expect(result.details["2026/10"].pending).toEqual([]);
});

it("preserves custom pending amounts and does not forecast an already paid occurrence", () => {
  const custom = costHistoryPayments(
    [subscription],
    currencies,
    [payment({ due_date: "2026-12-20", amount: 17 })],
    2026,
    now,
  );
  expect(custom.details["2026/12"].pending[0].amount).toBe(17);
  expect(custom.forecasts).toContainEqual({ name: "2026/12", cost: 17 });
  const paid = costHistoryPayments(
    [subscription],
    currencies,
    [payment({ due_date: "2026-12-20", paid_at: "2026-11-02T12:00:00Z", amount: 18 })],
    2026,
    now,
  );
  expect(paid.details["2026/11"].paid[0].amount).toBe(18);
  expect(paid.details["2026/12"].pending).toEqual([]);
  expect(paid.forecasts).toContainEqual({ name: "2026/12", cost: 0 });
});

it("deduplicates paid history and keeps inactive subscriptions in the paid list", () => {
  const result = costHistoryPayments(
    [{ ...subscription, inactive: true }],
    currencies,
    [
      payment({ id: "old", paid_at: "2026-10-20T12:00:00Z", amount: 32 }),
      payment({ id: "latest", paid_at: "2026-10-21T12:00:00Z", amount: 33 }),
    ],
    2026,
    now,
  );
  expect(result.details["2026/10"].paid).toHaveLength(1);
  expect(result.details["2026/10"].paid[0].amount).toBe(33);
  expect(result.details["2026/12"].pending).toEqual([]);
});

it("keeps historical years free of forecasts and includes next January when viewing December", () => {
  expect(costHistoryPayments([subscription], currencies, [], 2025, now).forecasts).toEqual([]);
  const result = costHistoryPayments([subscription], currencies, [], 2026, new Date(2026, 11, 3));
  expect(result.details["2027/01"].pending[0].amount).toBe(20);
  expect(result.forecasts).toContainEqual({ name: "2027/01", cost: 20 });
});
