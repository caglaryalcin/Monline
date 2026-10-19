import type { Currency, Cycle, Subscription } from "@/types";

import { nextMonthCost, upcomingMonthCosts } from "./nextMonthCost";

const now = new Date(2026, 9, 18);
const currency = { id: "try", rate: 1, is_main: true } as Currency;
const sub = (
  id: string,
  cycle: Cycle["name"] = "Monthly",
  overrides: Partial<Subscription> = {},
): Subscription => ({
  id,
  name: id,
  price: 100,
  currency: "try",
  frequency: 1,
  cycle,
  auto_renew: true,
  inactive: false,
  next_payment: "2026-11-05",
  start_date: "2026-01-01",
  notify: false,
  notify_days_before: 0,
  user: "user",
  expand: { cycle: { id: cycle, name: cycle } },
  ...overrides,
});

describe("next calendar month's renewing costs", () => {
  it("projects every remaining month separately, including December's annual renewal", () => {
    expect(
      upcomingMonthCosts(
        [
          sub("monthly"),
          sub("annual-december", "Yearly", { next_payment: "2026-12-15", price: 1200 }),
        ],
        [currency],
        now,
      ),
    ).toEqual([
      { name: "2026/11", cost: 100 },
      { name: "2026/12", cost: 1300 },
    ]);
    expect(upcomingMonthCosts([sub("monthly")], [currency], new Date(2026, 11, 18))).toEqual([
      { name: "2027/01", cost: 100 },
    ]);
  });
  it("only includes active auto-renewing subscriptions, excluding income and one-time payments", () => {
    expect(
      nextMonthCost(
        [
          sub("renewing"),
          sub("manual", "Monthly", { auto_renew: false }),
          sub("paused", "Monthly", { inactive: true }),
          sub("income", "Monthly", { record_type: "credit" }),
          sub("one-time", "One-Time"),
        ],
        [currency],
        now,
      ),
    ).toBe(100);
  });

  it("counts weekly renewals individually and the full annual price only in its actual payment month", () => {
    expect(
      nextMonthCost(
        [
          sub("monthly"),
          sub("weekly", "Weekly", { price: 10, next_payment: "2026-11-02" }),
          sub("annual", "Yearly", { price: 1200, next_payment: "2026-11-15" }),
          sub("later-annual", "Yearly", { price: 9999, next_payment: "2026-12-15" }),
        ],
        [currency],
        now,
      ),
    ).toBe(1350);
  });

  it("never back-projects charges before the actual next payment date", () => {
    expect(
      nextMonthCost(
        [
          sub("future-annual", "Yearly", { next_payment: "2027-11-05" }),
          sub("future-bimonthly", "Monthly", { frequency: 2, next_payment: "2027-01-05" }),
        ],
        [currency],
        now,
      ),
    ).toBe(0);
  });

  it("respects cancellation dates and remaining payment limits", () => {
    expect(
      nextMonthCost(
        [
          sub("cancelled", "Monthly", { cancellation_date: "2026-10-31" }),
          sub("ending-weekly", "Weekly", {
            price: 10,
            next_payment: "2026-11-02",
            end_date: "2026-11-10",
          }),
          sub("limited-weekly", "Weekly", {
            price: 20,
            next_payment: "2026-11-02",
            payment_limit: 3,
            payments_completed: 1,
          }),
        ],
        [currency],
        now,
      ),
    ).toBe(60);
  });

  it("handles December to January and clamps payments in short months", () => {
    expect(
      nextMonthCost(
        [sub("new-year", "Yearly", { next_payment: "2027-01-01", price: 1200 })],
        [currency],
        new Date(2026, 11, 18),
      ),
    ).toBe(1200);
    expect(
      nextMonthCost(
        [sub("month-end", "Monthly", { next_payment: "2027-01-31" })],
        [currency],
        new Date(2027, 0, 31),
      ),
    ).toBe(100);
  });

  it("converts current prices to the main currency without losing cents", () => {
    expect(
      nextMonthCost(
        [
          sub("usd", "Monthly", { price: 10, currency: "usd" }),
          sub("try", "Monthly", { price: 239.99 }),
        ],
        [{ ...currency, rate: 40 }, { id: "usd", rate: 1 } as Currency],
        now,
      ),
    ).toBe(639.99);
  });
});
