const {
  validateHistoricalPayment,
} = require("../../src/domain/lib/pure/historical-payment.js");

describe("historical payment validation", () => {
  const now = new Date("2026-10-17T10:00:00Z");
  const input = {
    due_date: "2025-10-17",
    paid_date: "2026-02-01",
    utc_offset_minutes: -180,
    amount: 0,
    notes: " receipt ",
  };
  it("keeps zero, trims notes and stores the chosen local payment day", () => {
    expect(validateHistoricalPayment(input, now)).toEqual({
      due_date: "2025-10-17",
      paid_at: "2026-01-31T21:00:00.000Z",
      amount: 0,
      auto_paid: false,
      notes: "receipt",
    });
  });
  it("allows older statement dates without allowing future or invalid dates", () => {
    const statement = {
      ...input,
      due_date: "2025-07-03",
      paid_date: "2025-07-03",
      amount: 489.6,
    };
    expect(
      validateHistoricalPayment(statement, now, { limitToPastYear: false }),
    ).toMatchObject({
      due_date: "2025-07-03",
      paid_at: "2025-07-02T21:00:00.000Z",
      amount: 489.6,
    });
    expect(() => validateHistoricalPayment(statement, now)).toThrow(
      "historical_invalid_date",
    );
    for (const date of ["2026-10-18", "2025-02-30", "not-a-date"]) {
      expect(() =>
        validateHistoricalPayment({ ...statement, due_date: date }, now, {
          limitToPastYear: false,
        }),
      ).toThrow("historical_invalid_date");
      expect(() =>
        validateHistoricalPayment({ ...statement, paid_date: date }, now, {
          limitToPastYear: false,
        }),
      ).toThrow("historical_invalid_date");
    }
  });
  it.each([
    "2025-10-16",
    "2026-10-18",
    "2026-02-30",
    "not-a-date",
    "2026-1-01",
  ])("rejects an invalid due date %s", (date) => {
    expect(() =>
      validateHistoricalPayment({ ...input, due_date: date }, now),
    ).toThrow("historical_invalid_date");
    expect(() =>
      validateHistoricalPayment({ ...input, paid_date: date }, now),
    ).toThrow("historical_invalid_date");
  });
  it.each([-1, NaN, Infinity, "10", null, 1e13])(
    "rejects an invalid amount %s",
    (amount) => {
      expect(() =>
        validateHistoricalPayment({ ...input, amount }, now),
      ).toThrow("historical_invalid_amount");
    },
  );
  it("uses the local day near UTC midnight and clamps leap years", () => {
    const leapDay = new Date("2024-02-29T00:30:00Z");
    expect(
      validateHistoricalPayment(
        { ...input, due_date: "2023-02-28", paid_date: "2024-02-29" },
        leapDay,
      ).paid_at,
    ).toBe("2024-02-28T21:00:00.000Z");
    expect(
      validateHistoricalPayment(
        { ...input, due_date: "2025-10-18", paid_date: "2026-10-18" },
        new Date("2026-10-17T22:00:00Z"),
      ).paid_at,
    ).toBe("2026-10-17T21:00:00.000Z");
  });
  it("rejects invalid offsets and notes", () => {
    for (const offset of [null, -900, 900, 1.5, "-180"])
      expect(() =>
        validateHistoricalPayment(
          { ...input, utc_offset_minutes: offset },
          now,
        ),
      ).toThrow("historical_invalid_date");
    for (const notes of [123, "a".repeat(2001)])
      expect(() => validateHistoricalPayment({ ...input, notes }, now)).toThrow(
        "historical_invalid_notes",
      );
  });
  it("keeps the calendar date when the payment was in a different daylight-saving period", () => {
    expect(
      validateHistoricalPayment(
        {
          ...input,
          due_date: "2026-03-17",
          paid_date: "2026-03-17",
          utc_offset_minutes: -120,
          paid_utc_offset_minutes: -60,
        },
        now,
      ).paid_at,
    ).toBe("2026-03-16T23:00:00.000Z");
  });
});
