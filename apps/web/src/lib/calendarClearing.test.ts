import { getOccurrencesInMonth, toDateStr } from "@/components/calendar/types";
import { buildMonthlyBudget } from "@/lib/monthlyBudget";
import type { Currency, Subscription } from "@/types";

const currency: Currency = { id: "usd", user: "owner", code: "USD", name: "Dollar", symbol: "$", rate: 1, is_main: true };
const sub = (id: string, date: string, values: Partial<Subscription> = {}): Subscription => ({
  id, user: "owner", name: id, price: 10, currency: "usd", frequency: 1,
  cycle: "monthly", expand: { cycle: { id: "monthly", name: "Monthly" }, currency },
  next_payment: date, start_date: "2026-01-01", auto_renew: true, inactive: false,
  notify: false, notify_days_before: 0, calendar_projection_from: "2026-11-01", ...values,
});

it("shows one paid and three pending subscriptions while a future-starting subscription stays out", () => {
  const subscriptions = [
    sub("Google Workspace", "2026-12-01"), sub("YouTube Premium", "2026-11-06"),
    sub("ChatGPT", "2026-11-10"), sub("Amazon Prime", "2026-11-23"),
    sub("SimpleLogin", "2027-03-31", { start_date: "2027-02-28" }),
  ];
  const entries = buildMonthlyBudget(subscriptions, [currency], [{
    id: "paid", user: "owner", subscription_id: "Google Workspace", due_date: "2026-11-01",
    paid_at: "2026-11-01T00:00:00Z", amount: 10,
  }], true, new Date(2026, 10, 1));
  expect(entries.map(entry => [entry.subscription.name, entry.status])).toEqual([
    ["Google Workspace", "paid"], ["YouTube Premium", "pending"], ["ChatGPT", "pending"], ["Amazon Prime", "pending"],
  ]);
});

it("keeps later unpaid dates overdue instead of moving the clearing boundary each day", () => {
  const subscriptions = [sub("YouTube", "2026-11-06"), sub("ChatGPT", "2026-11-10")];
  expect(buildMonthlyBudget(subscriptions, [currency], [], true, new Date(2026, 10, 25))
    .map(entry => entry.status)).toEqual(["overdue", "overdue"]);
});

it("does not project erased history, including the last date of a completed inactive schedule", () => {
  expect(getOccurrencesInMonth(sub("monthly", "2026-10-06"), 2026, 10, [])).toEqual([]);
  expect(getOccurrencesInMonth(sub("finished", "2026-11-06", {
    inactive: true, payment_limit: 2, payments_completed: 2,
  }), 2026, 11, [])).toEqual([]);
});

it("keeps weekly future dates without recreating earlier cycles", () => {
  const weekly = sub("weekly", "2026-10-20", { expand: { cycle: { id: "weekly", name: "Weekly" }, currency } });
  expect(getOccurrencesInMonth(weekly, 2026, 11, []).map(toDateStr)).toEqual([
    "2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24",
  ]);
});

it("keeps explicitly saved payments visible even if their dates precede the projection boundary", () => {
  const entries = buildMonthlyBudget([sub("monthly", "2026-11-06")], [currency], [{
    id: "history", user: "owner", subscription_id: "monthly", due_date: "2026-10-06",
    paid_at: "2026-10-06T00:00:00Z", amount: 10,
  }], true, new Date(2026, 9, 20));
  expect(entries.map(entry => entry.status)).toEqual(["paid"]);
});
