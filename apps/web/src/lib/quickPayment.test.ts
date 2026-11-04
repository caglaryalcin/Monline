import { quickPaymentTarget } from "@/lib/quickPayment";
import type { PaymentRecord, Subscription } from "@/types";

const sub = { id: "plan", user: "owner", name: "Plan", price: 100, currency: "try", next_payment: "2026-11-06", start_date: "2026-01-01" } as Subscription;
const pending = { id: "pending", user: "owner", subscription_id: sub.id, due_date: "2026-10-06", amount: 87, paid_at: "" } as PaymentRecord;
const find = (overrides: Partial<Subscription> = {}, records: PaymentRecord[] = [], date?: string, today = "2026-11-04") =>
  quickPaymentTarget({ ...sub, ...overrides }, records, "owner", today, date);

describe("quick payment eligibility", () => {
  it.each(["2026-11-04", "2026-11-05", "2026-11-06"])("allows a payment due %s", (next_payment) => {
    expect(find({ next_payment })?.date).toBe(next_payment);
  });
  it("hides payments more than two days away", () => {
    expect(find({ next_payment: "2026-11-07" })).toBeNull();
  });
  it("uses calendar days across month and year boundaries", () => {
    expect(find({ next_payment: "2027-01-02" }, [], undefined, "2026-12-31")?.date).toBe("2027-01-02");
    expect(find({ next_payment: "2027-01-03" }, [], undefined, "2026-12-31")).toBeNull();
  });
  it("selects the oldest saved pending payment after the schedule advances", () => {
    expect(find({}, [pending])).toMatchObject({ date: "2026-10-06", amount: 87 });
    expect(find({}, [pending], "2026-11-06")).toMatchObject({ date: "2026-11-06", amount: 100 });
  });
  it.each([{ inactive: true }, { auto_mark_paid: true }, { record_type: "credit" as const }, { user: "another-user" }])(
    "hides unavailable subscriptions: %j", (overrides) => expect(find(overrides, [pending])).toBeNull(),
  );
  it("prefers a paid duplicate and never offers the same occurrence again", () => {
    expect(find({}, [pending, { ...pending, id: "paid", paid_at: "2026-10-07T12:00:00Z" }], pending.due_date)).toBeNull();
  });
  it("keeps the saved amount and currency instead of the current subscription price", () => {
    expect(find({}, [{ ...pending, currency: "eur" }], pending.due_date)).toMatchObject({ amount: 87, currency: "eur" });
  });
  it("does not revive the original date of a moved payment", () => {
    const moved = { ...pending, due_date: "2026-11-10", scheduled_date: sub.next_payment };
    expect(find({}, [moved])).toBeNull();
    expect(find({}, [moved], sub.next_payment)).toBeNull();
    expect(find({}, [moved], moved.due_date, "2026-11-10")?.date).toBe(moved.due_date);
  });
  it.each([{ calendar_projection_hidden: true }, { end_date: "2026-11-05" }, { cancellation_date: "2026-11-05" }, { payment_limit: 2, payments_completed: 2 }])(
    "respects schedule bounds: %j", (overrides) => expect(find(overrides)).toBeNull(),
  );
  it("does not invent a payment for an arbitrary dashboard date", () => {
    expect(find({}, [], "2026-10-04")).toBeNull();
  });
  it("does not treat another user's record as payable", () => {
    expect(find({}, [{ ...pending, user: "other" }], pending.due_date)).toBeNull();
  });
  it("does not offer a zero-cost occurrence", () => {
    expect(find({ price: 0 })).toBeNull();
    expect(find({}, [{ ...pending, amount: 0 }], pending.due_date)).toBeNull();
  });
});
