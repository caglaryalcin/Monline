const { validateCalendarPayment, validateHistoricalPayment } = require("../../src/domain/lib/pure/historical-payment.js");
const now = new Date("2026-11-09T12:00:00Z");
const input = { status: "pending", due_date: "2027-01-12", amount: 125.5, notes: " bill ", utc_offset_minutes: -180 };
describe("calendar payment validation", () => {
  it("saves pending payments without fabricating an actual payment timestamp", () => {
    expect(validateCalendarPayment(input, now)).toEqual({ due_date: "2027-01-12", paid_at: "", amount: 125.5, notes: "bill", auto_paid: false });
    expect(validateCalendarPayment({ ...input, due_date: "2026-10-01" }, now).paid_at).toBe("");
  });
  it("allows prepayment of a future due date using an actual past payment date", () => {
    expect(validateCalendarPayment({ ...input, status: "paid", paid_date: "2026-11-08" }, now)).toMatchObject({ due_date: "2027-01-12", paid_at: "2026-11-07T21:00:00.000Z" });
    expect(() => validateCalendarPayment({ ...input, status: "paid", paid_date: "2027-01-12" }, now)).toThrow("historical_invalid_date");
  });
  it.each(["2025-11-08", "2026-02-30", "invalid", "2201-01-01"])("rejects invalid due date %s", (due_date) => {
    expect(() => validateCalendarPayment({ ...input, due_date }, now)).toThrow("calendar_payment_invalid_date");
  });
  it("keeps amount and note validation for pending payments", () => {
    for (const amount of [-1, NaN, Infinity, "100", 1e13]) expect(() => validateCalendarPayment({ ...input, amount }, now)).toThrow("historical_invalid_amount");
    expect(() => validateCalendarPayment({ ...input, notes: "x".repeat(2001) }, now)).toThrow("historical_invalid_notes");
    expect(() => validateCalendarPayment({ ...input, status: "other" }, now)).toThrow("calendar_payment_invalid_status");
  });
  it("keeps legacy clients on the original historical-payment contract", () => {
    const legacy = { ...input, status: undefined, due_date: "2026-11-08", paid_date: "2026-11-08" };
    expect(validateCalendarPayment(legacy, now)).toEqual(validateHistoricalPayment(legacy, now));
    expect(() => validateCalendarPayment({ ...legacy, due_date: "2027-01-12" }, now)).toThrow("historical_invalid_date");
  });
});
