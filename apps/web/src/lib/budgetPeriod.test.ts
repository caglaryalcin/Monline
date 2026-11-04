import { BUDGET_PERIODS, budgetPeriodLabel, buildBudgetPeriod } from "@/lib/budgetPeriod";
import { buildMonthlyBudget } from "@/lib/monthlyBudget";
import type { Currency, PaymentRecord, Subscription } from "@/types";

const now = new Date(2026, 10, 4);
const currency: Currency = { id: "try", user: "owner", name: "Lira", code: "TRY", symbol: "₺", rate: 1, is_main: true };
const budgetPeriodSubscription = (values: Partial<Subscription> = {}): Subscription => ({
  id: "hbo", user: "owner", name: "HBO", price: 100, currency: currency.id,
  cycle: "monthly", frequency: 3, next_payment: "2026-12-04", start_date: "2026-09-04",
  auto_renew: true, inactive: false, notify: false, notify_days_before: 3,
  expand: { currency, cycle: { id: "monthly", name: "Monthly" } }, ...values,
});
const payment = (values: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: "payment", user: "owner", subscription_id: "disabled", due_date: "2026-11-02",
  amount: 90, paid_at: "2026-11-02T12:00:00Z", ...values,
});

it.each(BUDGET_PERIODS)("excludes disabled subscriptions and their saved payments from the %i-month budget", (months) => {
  const subs = [budgetPeriodSubscription(), budgetPeriodSubscription({ id: "disabled", name: "Disabled plan", inactive: true, frequency: 1, next_payment: "2026-11-10" })];
  const records = [payment(), payment({ id: "pending", paid_at: "", due_date: "2026-12-02" })];
  const result = buildBudgetPeriod(subs, [currency], records, true, now, months);
  expect(result.entries.some((entry) => entry.subscription.id === "disabled")).toBe(false);
  expect(result.entries.reduce((sum, entry) => sum + entry.amount, 0)).toBe(({ 1: 0, 3: 100, 6: 200, 12: 400 })[months]);
});

it.each([[1, 0], [3, 1], [6, 2], [12, 4]] as const)("shows full quarterly payments in the %i-month range", (months, count) => {
  const result = buildBudgetPeriod([budgetPeriodSubscription()], [currency], [], true, now, months);
  expect(result.entries).toHaveLength(count);
  expect(result.entries.every((entry) => entry.amount === 100)).toBe(true);
  expect(result.entries.every((entry) => entry.status === "pending")).toBe(true);
});

it("preserves paused payment history outside the prospective dashboard budget", () => {
  const sub = budgetPeriodSubscription({ id: "disabled", inactive: true });
  const records = [payment()];
  const before = JSON.stringify({ sub, records });
  expect(buildBudgetPeriod([sub], [currency], records, true, now, 12).entries).toEqual([]);
  expect(buildMonthlyBudget([sub], [currency], records, true, now)[0]).toMatchObject({ amount: 90, status: "paid" });
  expect(JSON.stringify({ sub, records })).toBe(before);
});

it("keeps independent payments when disabled subscriptions are excluded", () => {
  const records = [payment(), payment({ id: "independent", subscription_id: "", name: "Independent payment", currency: currency.id, amount: 35 })];
  const result = buildBudgetPeriod([budgetPeriodSubscription({ id: "disabled", inactive: true })], [currency], records, true, now, 1);
  expect(result.entries).toHaveLength(1);
  expect(result.entries[0]).toMatchObject({ amount: 35, subscription: { name: "Independent payment", standalone_payment_id: "independent" } });
});

it("does not renew a non-renewing subscription in later months", () => {
  const result = buildBudgetPeriod([budgetPeriodSubscription({ auto_renew: false })], [currency], [], true, now, 12);
  expect(result.entries.map((entry) => entry.date)).toEqual(["2026-12-04"]);
});

it("keeps a moved payment at its saved date and amount without duplicating the original", () => {
  const records = [payment({ subscription_id: "hbo", scheduled_date: "2026-12-04", due_date: "2027-01-02", amount: 75 })];
  const result = buildBudgetPeriod([budgetPeriodSubscription()], [currency], records, true, now, 3);
  expect(result.entries).toHaveLength(1);
  expect(result.entries[0]).toMatchObject({ date: "2027-01-02", amount: 75, status: "paid" });
});

it("uses scheduled prices on each actual payment date", () => {
  const sub = budgetPeriodSubscription({ price_changes: [{ effective_date: "2027-02-01", price: 130 }] });
  const result = buildBudgetPeriod([sub], [currency], [], true, now, 6);
  expect(result.entries.map((entry) => [entry.date, entry.amount])).toEqual([["2026-12-04", 100], ["2027-03-04", 130]]);
});

it("counts only active credits in the selected range and converts their currency once", () => {
  const foreign = { ...currency, id: "foreign", code: "USD", is_main: false, rate: 2 };
  const income = budgetPeriodSubscription({ id: "income", price: 200, currency: foreign.id, record_type: "credit" });
  const paused = { ...income, id: "paused-income", inactive: true };
  expect(buildBudgetPeriod([income, paused], [currency, foreign], [], true, now, 1).credits).toBe(0);
  expect(buildBudgetPeriod([income, paused], [currency, foreign], [], true, now, 3).credits).toBe(100);
  expect(buildBudgetPeriod([income, paused], [currency, foreign], [], true, now, 12).credits).toBe(100);
});

it("labels full calendar-month ranges across year boundaries", () => {
  expect(budgetPeriodLabel("2026-11-04", 1, "en")).toBe("November 2026");
  expect(budgetPeriodLabel("2026-11-04", 3, "en")).toBe("November 2026 - January 2027");
  expect(budgetPeriodLabel("2026-11-04", 12, "en")).toBe("November 2026 - October 2027");
});
