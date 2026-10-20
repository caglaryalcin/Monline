const {
  advanceDate,
  formatLocalDate,
  getPricePerMonth,
} = require("../../src/domain/lib/date-helpers.js");

describe("src/domain/lib/date-helpers.js", () => {
  it.each([
    ["2026-01-29", "Monthly", 1, "2026-02-28"],
    ["2024-01-31", "Monthly", 1, "2024-02-29"],
    ["2026-01-31", "Quarterly", 1, "2026-04-30"],
    ["2026-08-31", "Half-Yearly", 1, "2027-02-28"],
    ["2024-02-29", "Yearly", 4, "2028-02-29"],
  ])(
    "clamps %s %s x%s to the target month",
    (date, cycle, frequency, expected) => {
      const source = new Date(date + "T12:34:56.000Z");
      expect(advanceDate(source, cycle, frequency).toISOString()).toBe(
        expected + "T12:34:56.000Z",
      );
      expect(source.toISOString()).toBe(date + "T12:34:56.000Z");
    },
  );

  it("restores the original billing day after a short month", () => {
    const february = advanceDate(
      new Date("2026-01-31T00:00:00Z"),
      "Monthly",
      1,
      31,
    );
    expect(advanceDate(february, "Monthly", 1, 31).toISOString()).toBe(
      "2026-03-31T00:00:00.000Z",
    );
    const year = advanceDate(new Date("2024-02-29T00:00:00Z"), "Yearly", 1, 29);
    expect(advanceDate(year, "Yearly", 3, 29).toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });

  it("treats daily frequency as an interval and matches frontend monthly coefficients", () => {
    expect(getPricePerMonth(10, "Daily", 3, 1)).toBeCloseTo((10 / 3) * 30.44);
    expect(getPricePerMonth(20, "Daily", 3, 2)).toBeCloseTo((10 / 3) * 30.44);
    expect(getPricePerMonth(10, "Daily", 0, 1)).toBeCloseTo(304.4);
    expect(getPricePerMonth(12, "Weekly", 2, 1)).toBe(26);
  });
  it("advances dates without mutating the original input", () => {
    const source = new Date("2026-01-31T00:00:00.000Z");
    const result = advanceDate(source, "Daily", 2);
    expect(source.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(result.toISOString()).toBe("2026-02-02T00:00:00.000Z");
  });

  it("handles daily, weekly, monthly, quarterly, half-yearly, and yearly cycles", () => {
    expect(
      advanceDate(
        new Date("2026-03-01T00:00:00.000Z"),
        "Daily",
        3,
      ).toISOString(),
    ).toBe("2026-03-04T00:00:00.000Z");
    expect(
      advanceDate(
        new Date("2026-03-01T00:00:00.000Z"),
        "Weekly",
        2,
      ).toISOString(),
    ).toBe("2026-03-15T00:00:00.000Z");
    expect(
      advanceDate(
        new Date("2026-01-31T00:00:00.000Z"),
        "Monthly",
        1,
      ).toISOString(),
    ).toBe("2026-02-28T00:00:00.000Z");
    // Quarterly: 1 quarter = 3 months
    expect(
      advanceDate(
        new Date("2026-01-01T00:00:00.000Z"),
        "Quarterly",
        1,
      ).toISOString(),
    ).toBe("2026-04-01T00:00:00.000Z");
    // Quarterly with frequency=2: 2 quarters = 6 months
    expect(
      advanceDate(
        new Date("2026-01-01T00:00:00.000Z"),
        "Quarterly",
        2,
      ).toISOString(),
    ).toBe("2026-07-01T00:00:00.000Z");
    // Half-Yearly: 1 half-year = 6 months
    expect(
      advanceDate(
        new Date("2026-01-01T00:00:00.000Z"),
        "Half-Yearly",
        1,
      ).toISOString(),
    ).toBe("2026-07-01T00:00:00.000Z");
    expect(
      advanceDate(
        new Date("2024-02-29T00:00:00.000Z"),
        "Yearly",
        1,
      ).toISOString(),
    ).toBe("2025-02-28T00:00:00.000Z");
  });

  describe("timezone independence", () => {
    const realTZ = process.env.TZ;

    afterEach(() => {
      if (realTZ === undefined) Reflect.deleteProperty(process.env, "TZ");
      else process.env.TZ = realTZ;
    });

    // These legacy dates are stored as UTC instants. Advancing them
    // with local accessors reads a different calendar day west of Greenwich,
    // which then overflows short months and lands a day late. Pinning the
    // timezone here makes the regression reproducible on any machine rather
    // than only on the maintainer's.
    it.each([
      ["UTC", "UTC"],
      ["a negative offset", "America/Sao_Paulo"],
      ["a positive offset", "Asia/Tokyo"],
      ["a half-hour offset", "Asia/Kolkata"],
    ])("advances by whole months in %s", (_label, timezone) => {
      process.env.TZ = timezone;

      expect(
        advanceDate(
          new Date("2026-01-01T00:00:00.000Z"),
          "Quarterly",
          2,
        ).toISOString(),
      ).toBe("2026-07-01T00:00:00.000Z");
      expect(
        advanceDate(
          new Date("2026-01-01T00:00:00.000Z"),
          "Half-Yearly",
          1,
        ).toISOString(),
      ).toBe("2026-07-01T00:00:00.000Z");
      expect(
        advanceDate(
          new Date("2026-03-15T00:00:00.000Z"),
          "Monthly",
          1,
        ).toISOString(),
      ).toBe("2026-04-15T00:00:00.000Z");
      expect(
        advanceDate(
          new Date("2026-03-15T00:00:00.000Z"),
          "Daily",
          20,
        ).toISOString(),
      ).toBe("2026-04-04T00:00:00.000Z");
      expect(
        advanceDate(
          new Date("2026-03-15T00:00:00.000Z"),
          "Weekly",
          3,
        ).toISOString(),
      ).toBe("2026-04-05T00:00:00.000Z");
      expect(
        advanceDate(
          new Date("2026-03-15T00:00:00.000Z"),
          "Yearly",
          1,
        ).toISOString(),
      ).toBe("2027-03-15T00:00:00.000Z");
    });
  });

  describe("formatLocalDate", () => {
    const realTZ = process.env.TZ;

    afterEach(() => {
      if (realTZ === undefined) Reflect.deleteProperty(process.env, "TZ");
      else process.env.TZ = realTZ;
    });

    it("zero-pads single-digit months and days", () => {
      expect(formatLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05");
      expect(formatLocalDate(new Date(2026, 8, 9))).toBe("2026-09-09");
    });

    it("leaves two-digit months and days alone", () => {
      expect(formatLocalDate(new Date(2026, 10, 25))).toBe("2026-11-25");
      expect(formatLocalDate(new Date(2026, 11, 31))).toBe("2026-12-31");
    });

    // The whole point of the helper: an evening west of Greenwich, or any
    // late hour east of it, is a different calendar day in UTC. Serialising
    // with toISOString() there returns the neighbouring day.
    it("reports the local calendar day, not the UTC one", () => {
      process.env.TZ = "America/Sao_Paulo";
      const brazilEvening = new Date("2026-08-22T01:30:00.000Z");
      expect(brazilEvening.toISOString().slice(0, 10)).toBe("2026-08-22");
      expect(formatLocalDate(brazilEvening)).toBe("2026-08-21");

      process.env.TZ = "Asia/Tokyo";
      const tokyoLateEvening = new Date("2026-08-21T22:00:00.000Z");
      expect(tokyoLateEvening.toISOString().slice(0, 10)).toBe("2026-08-21");
      expect(formatLocalDate(tokyoLateEvening)).toBe("2026-08-22");
    });
  });

  it("computes monthly price equivalents across all supported cycles", () => {
    expect(getPricePerMonth(10, "Daily", 1, 1)).toBeCloseTo(304.4);
    expect(getPricePerMonth(21, "Weekly", 3, 1)).toBeCloseTo(30.33, 2);
    expect(getPricePerMonth(24, "Monthly", 2, 1)).toBe(12);
    // Quarterly: $90 every quarter (3 months) → $30/month
    expect(getPricePerMonth(90, "Quarterly", 1, 1)).toBe(30);
    // Quarterly with frequency=2: $90 every 2 quarters (6 months) → $15/month
    expect(getPricePerMonth(90, "Quarterly", 2, 1)).toBe(15);
    // Half-Yearly: $60 every half-year (6 months) → $10/month
    expect(getPricePerMonth(60, "Half-Yearly", 1, 1)).toBe(10);
    expect(getPricePerMonth(120, "Yearly", 2, 1)).toBe(5);
    // One-Time is a single dated payout: it contributes nothing to a
    // recurring monthly total, however large the amount is.
    expect(getPricePerMonth(2000, "One-Time", 1, 1)).toBe(0);
  });

  it("falls back safely when exchange rate or cycle is missing", () => {
    expect(getPricePerMonth(100, "Unknown", 1, 0)).toBe(100);
    expect(getPricePerMonth(100, "Monthly", 4)).toBe(25);
  });
});
