import { getOccurrencesInMonth, toDateStr } from "@/components/calendar/types";
import type { Subscription } from "@/types";

import { backfillDates } from "./backfillPayments";

describe("past payment dates", () => {
  it("uses the billing day for explicit history without projecting unsaved calendar entries", () => {
    const dates = backfillDates({
      start: "2026-01-01",
      anchorDate: "2026-11-23",
      until: "2026-10-18",
      cycle: "Monthly",
      frequency: 1,
    });
    expect(dates).toHaveLength(9);
    expect(dates[0]).toBe("2026-01-23");
    const subscription = {
      start_date: "2026-01-01",
      next_payment: "2026-11-23",
      frequency: 1,
      cycle: "monthly",
    } as Subscription;
    const calendarDates = Array.from({ length: 10 }, (_, month) =>
      getOccurrencesInMonth(subscription, 2026, month + 1, [{ id: "monthly", name: "Monthly" }]),
    )
      .flat()
      .map(toDateStr)
      .filter((day) => day <= "2026-10-18");
    expect(dates).toEqual([
      "2026-01-23",
      "2026-02-23",
      "2026-03-23",
      "2026-04-23",
      "2026-05-23",
      "2026-06-23",
      "2026-07-23",
      "2026-08-23",
      "2026-09-23",
    ]);
    expect(calendarDates).toEqual([]);
  });
  it("includes only elapsed months, with the original billing day", () => {
    expect(
      backfillDates({ start: "2026-01-23", until: "2026-10-18", cycle: "Monthly", frequency: 1 }),
    ).toEqual([
      "2026-01-23",
      "2026-02-23",
      "2026-03-23",
      "2026-04-23",
      "2026-05-23",
      "2026-06-23",
      "2026-07-23",
      "2026-08-23",
      "2026-09-23",
    ]);
  });
  it("clamps short months without shifting later payments", () => {
    expect(
      backfillDates({ start: "2026-01-31", until: "2026-04-30", cycle: "Monthly", frequency: 1 }),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("handles leap years, multi-year, weekly and daily billing", () => {
    expect(
      backfillDates({ start: "2024-02-29", until: "2028-03-01", cycle: "Yearly", frequency: 2 }),
    ).toEqual(["2024-02-29", "2026-02-28", "2028-02-29"]);
    expect(
      backfillDates({ start: "2026-01-01", until: "2026-02-01", cycle: "Weekly", frequency: 2 }),
    ).toEqual(["2026-01-01", "2026-01-15", "2026-01-29"]);
    expect(
      backfillDates({ start: "2026-01-01", until: "2026-01-05", cycle: "Daily", frequency: 2 }),
    ).toEqual(["2026-01-01", "2026-01-03", "2026-01-05"]);
  });
  it("respects end dates and payment limits and leaves future starts empty", () => {
    const base = { start: "2026-01-01", until: "2026-10-18", cycle: "Monthly", frequency: 1 };
    expect(backfillDates({ ...base, end: "2026-03-01" })).toHaveLength(3);
    expect(backfillDates({ ...base, limit: 2 })).toHaveLength(2);
    expect(backfillDates({ ...base, start: "2026-11-01" })).toEqual([]);
  });
  it("rejects invalid dates, frequencies and unbounded daily histories", () => {
    const base = { start: "2026-01-01", until: "2026-10-18", cycle: "Monthly", frequency: 1 };
    expect(() => backfillDates({ ...base, start: "2026-02-30" })).toThrow(
      "backfill_invalid_schedule",
    );
    expect(() => backfillDates({ ...base, frequency: 0 })).toThrow("backfill_invalid_schedule");
    expect(() => backfillDates({ ...base, cycle: "One-Time" })).toThrow(
      "backfill_invalid_schedule",
    );
    expect(() => backfillDates({ ...base, start: "2000-01-01", cycle: "Daily" })).toThrow(
      "backfill_too_many",
    );
  });
});

it("recovers the original billing day from a clamped February anchor", () => {
  expect(
    backfillDates({
      start: "2026-01-31",
      anchorDate: "2026-02-28",
      billingAnchorDay: 31,
      until: "2026-03-31",
      cycle: "Monthly",
      frequency: 1,
    }),
  ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
});


it("starts regular history on the exact weekly trial end, preserving limits and date bounds", () => {
  const trial = { trial_duration: 1, trial_unit: "week" as const, trial_start_date: "2026-11-02" };
  const base = { start:"2026-11-02",until:"2027-02-09",cycle:"Monthly",frequency:1,trial };
  expect(backfillDates(base)).toEqual(["2026-11-02","2026-11-09","2026-12-09","2027-01-09","2027-02-09"]);
  expect(backfillDates({...base,limit:1})).toEqual(["2026-11-02"]);
  expect(backfillDates({...base,limit:2})).toEqual(["2026-11-02","2026-11-09"]);
  expect(backfillDates({...base,end:"2026-11-08"})).toEqual(["2026-11-02"]);
  expect(backfillDates({...base,end:"2026-11-01"})).toEqual([]);
  expect(backfillDates({...base,start:"2026-12-01"})).toEqual(["2026-12-09","2027-01-09","2027-02-09"]);
  expect(backfillDates({...base,trial:{...trial,trial_duration:0}})).toContain("2026-12-02");
});

it("enforces the total history limit including the free trial occurrence", () => {
  const trial = {trial_duration:1,trial_unit:"day" as const,trial_start_date:"2026-01-01"};
  expect(() => backfillDates({start:"2026-01-01",until:"2028-09-27",cycle:"Daily",frequency:1,trial}))
    .toThrow("backfill_too_many");
});
