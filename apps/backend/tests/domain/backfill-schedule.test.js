const {
  backfillDates,
} = require("../../src/domain/lib/pure/backfill-schedule.js");
const {
  prepareBackfill,
} = require("../../src/domain/lib/subscription-backfill.js");

describe("past payment schedule validation", () => {
  it("uses the upcoming payment's day rather than the account start day", () => {
    const dates = backfillDates({
      start: "2026-01-01",
      anchorDate: "2026-11-23",
      until: "2026-10-18",
      cycle: "Monthly",
      frequency: 1,
    });
    expect(dates).toHaveLength(9);
    expect(dates[0]).toBe("2026-01-23");
    expect(dates.at(-1)).toBe("2026-09-23");
  });
  const app = { findRecordById: () => ({ getString: () => "Monthly" }) };
  const fields = {
    start_date: "2026-01-31",
    frequency: 1,
    payment_limit: 0,
    cycle: "monthly",
    record_type: "expense",
  };
  const record = {
    getString: (key) => String(fields[key] ?? ""),
    get: (key) => fields[key],
  };
  const now = new Date("2026-10-18T12:00:00Z");
  const input = {
    confirmed: true,
    utc_offset_minutes: -180,
    payments: [
      { due_date: "2026-01-31", amount: 49.9, paid_utc_offset_minutes: -180 },
      { due_date: "2026-02-28", amount: 69.9, paid_utc_offset_minutes: -180 },
    ],
  };
  it("preserves original month-end days, leap years and recurring intervals", () => {
    expect(
      backfillDates({
        start: "2026-01-31",
        until: "2026-04-30",
        cycle: "Monthly",
        frequency: 1,
      }),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(
      backfillDates({
        start: "2024-02-29",
        until: "2028-03-01",
        cycle: "Yearly",
        frequency: 2,
      }),
    ).toEqual(["2024-02-29", "2026-02-28", "2028-02-29"]);
    expect(
      backfillDates({
        start: "2026-01-01",
        until: "2026-02-01",
        cycle: "Weekly",
        frequency: 2,
      }),
    ).toEqual(["2026-01-01", "2026-01-15", "2026-01-29"]);
  });
  it("uses the selected dates, individual amounts and local midnight offsets", () => {
    expect(prepareBackfill(app, record, JSON.stringify(input), now)).toEqual([
      {
        due_date: "2026-01-31",
        amount: 49.9,
        paid_at: "2026-01-30T21:00:00.000Z",
      },
      {
        due_date: "2026-02-28",
        amount: 69.9,
        paid_at: "2026-02-27T21:00:00.000Z",
      },
    ]);
  });
  it.each([
    { ...input, confirmed: false },
    { ...input, payments: [] },
    { ...input, payments: [input.payments[0], input.payments[0]] },
    { ...input, payments: [{ ...input.payments[0], due_date: "2026-10-31" }] },
    { ...input, payments: [{ ...input.payments[0], due_date: "2026-02-30" }] },
    { ...input, payments: [{ ...input.payments[0], amount: -1 }] },
    { ...input, payments: [{ ...input.payments[0], amount: "69.9" }] },
    { ...input, utc_offset_minutes: 1000 },
  ])("rejects invalid or unconfirmed selections", (body) => {
    expect(() => prepareBackfill(app, record, body, now)).toThrow();
  });
  it("respects schedule bounds and refuses to silently truncate a large history", () => {
    expect(
      backfillDates({
        start: "2026-01-01",
        until: "2026-10-18",
        cycle: "Monthly",
        frequency: 1,
        limit: 2,
      }),
    ).toEqual(["2026-01-01", "2026-02-01"]);
    expect(
      backfillDates({
        start: "2026-01-01",
        until: "2026-10-18",
        cycle: "Monthly",
        frequency: 1,
        end: "2026-03-01",
      }),
    ).toHaveLength(3);
    expect(() =>
      backfillDates({
        start: "2000-01-01",
        until: "2026-10-18",
        cycle: "Daily",
        frequency: 1,
      }),
    ).toThrow("backfill_too_many");
  });
});
