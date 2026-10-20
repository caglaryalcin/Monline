const {
  buildMonthRange,
  formatIcalDate,
  buildIcalEvent,
} = require("../../src/domain/lib/pure/calendar-utils.js");

describe("src/domain/lib/pure/calendar-utils.js", () => {
  it("escapes text and prevents embedded newlines from creating iCal properties", () => {
    const event = buildIcalEvent({
      id: "test",
      name: "A,B;C\\D\r\nX-TEST:injected",
      price: 10,
      currencySymbol: "$",
      nextPayment: "2026-01-31",
    });
    expect(event).toContain(
      "SUMMARY:A\\,B\\;C\\\\D\\nX-TEST:injected - $10\r\n",
    );
    expect(event).toContain(
      "DESCRIPTION:Payment due for A\\,B\\;C\\\\D\\nX-TEST:injected\r\n",
    );
    expect(event).not.toContain("\r\nX-TEST:");
  });

  it("folds long Unicode lines at 75 UTF-8 octets without splitting characters", () => {
    const name = "Türkçe 🎉 ".repeat(30);
    const event = buildIcalEvent({
      id: "test",
      name,
      price: 10,
      currencySymbol: "₺",
      nextPayment: "2026-01-31",
    });
    for (const line of event.split("\r\n"))
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    expect(event.replace(/\r\n /g, "")).toContain(
      "SUMMARY:" + name + " - ₺10\r\n",
    );
  });
  it("builds month ranges including December rollover", () => {
    expect(buildMonthRange(3, 2026)).toEqual({
      startDate: "2026-03-01",
      endDate: "2026-04-01",
    });
    expect(buildMonthRange(12, 2026)).toEqual({
      startDate: "2026-12-01",
      endDate: "2027-01-01",
    });
  });

  it("formats iCal dates and event payloads", () => {
    expect(formatIcalDate("2026-03-15T12:34:56.000Z")).toBe("20260315");
    expect(
      buildIcalEvent({
        id: "sub_1",
        name: "Netflix",
        price: "9.99",
        currencySymbol: "$",
        nextPayment: "2026-03-15T12:34:56.000Z",
      }),
    ).toContain("SUMMARY:Netflix - $9.99");
  });
});
