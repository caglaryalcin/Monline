import { getOccurrencesInMonth, toDateStr } from "@/components/calendar/types";
import { backfillDates } from "@/lib/backfillPayments";
import { availableBillingPresets, formatBillingPeriod } from "@/lib/billingPeriods";
import { lastWeekdayOfMonth } from "@/lib/lastWeekday";
import { automaticStartDate, nextPaymentDate } from "@/lib/subscriptionStartDate";
import { toMonthly } from "@/lib/utils";
import type { Subscription } from "@/types";

it.each([
  ["2027-01-31", "2027-01-29"],
  ["2027-02-28", "2027-02-26"],
  ["2028-02-01", "2028-02-29"],
  ["2026-12-01", "2026-12-31"],
])("finds the last weekday in %s", (date, expected) =>
  expect(lastWeekdayOfMonth(date)).toBe(expected),
);
it("offers the preset only when its cycle exists and labels custom frequencies", () => {
  expect(availableBillingPresets([{ id: "lw", name: "Last-Weekday" }])).toEqual([
    { id: "last_weekday", cycle: "Last-Weekday", frequency: 1, cycleId: "lw" },
  ]);
  expect(formatBillingPeriod((key) => key, "Last-Weekday", 1)).toBe("billing_preset_last_weekday");
  expect(formatBillingPeriod((key) => key, "Last-Weekday", 2)).toBe(
    "billing_every_n_last_weekdays",
  );
});
it("moves forwards and backwards without losing the end-of-month rule", () => {
  expect(nextPaymentDate("2027-01-29", "Last-Weekday", 1)).toBe("2027-02-26");
  expect(nextPaymentDate("2027-02-26", "Last-Weekday", 1)).toBe("2027-03-31");
  expect(automaticStartDate("2027-03-31", "Last-Weekday", 1)).toBe("2027-02-26");
  expect(toMonthly(600, "Last-Weekday", 2)).toBe(300);
});
it("projects the calendar on Friday when February ends on Sunday", () => {
  const sub = {
    id: "sub",
    next_payment: "2026-12-31",
    start_date: "2026-12-31",
    frequency: 1,
    auto_renew: true,
    inactive: false,
    billing_anchor_day: 31,
    expand: { cycle: { id: "lw", name: "Last-Weekday" } },
  } as Subscription;
  expect(getOccurrencesInMonth(sub, 2027, 1, []).map(toDateStr)).toEqual(["2027-01-29"]);
  expect(getOccurrencesInMonth(sub, 2027, 2, []).map(toDateStr)).toEqual(["2027-02-26"]);
  expect(getOccurrencesInMonth(sub, 2027, 3, []).map(toDateStr)).toEqual(["2027-03-31"]);
});
it("uses identical month ends in the backfill preview, including trial resumption", () => {
  expect(
    backfillDates({
      start: "2027-01-01",
      anchorDate: "2027-02-26",
      until: "2027-03-31",
      cycle: "Last-Weekday",
      frequency: 1,
    }),
  ).toEqual(["2027-01-29", "2027-02-26", "2027-03-31"]);
  expect(
    backfillDates({
      start: "2027-01-15",
      anchorDate: "2027-01-15",
      until: "2027-03-31",
      cycle: "Last-Weekday",
      frequency: 1,
      trial: { trial_duration: 1, trial_unit: "month", trial_start_date: "2027-01-15" },
    }),
  ).toEqual(["2027-01-15", "2027-02-26", "2027-03-31"]);
});
