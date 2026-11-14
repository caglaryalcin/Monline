import { cleanup, renderHook } from "@testing-library/react";

import { useCalendarMonthData } from "@/components/calendar/useCalendarMonthData";
import { buildMonthlyBudget } from "@/lib/monthlyBudget";
import { buildPaymentStatistics } from "@/lib/paymentStatistics";
import type { Currency, PaymentRecord, Subscription } from "@/types";

vi.mock("@/hooks/useLocalToday", () => ({ useLocalToday: () => "2026-11-14" }));

const currency: Currency = { id: "try", code: "TRY", name: "Lira", symbol: "₺", rate: 1, is_main: true, user: "owner" };
const sub: Subscription = {
  id: "service", name: "Streaming", price: 200, currency: "try", cycle: "monthly", frequency: 1,
  next_payment: "2026-11-14", start_date: "2026-01-14", auto_renew: true, inactive: true,
  notify: false, notify_days_before: 0, user: "owner", expand: { cycle: { id: "monthly", name: "Monthly" } },
};
const records: PaymentRecord[] = [
  { id: "paid", subscription_id: sub.id, user: "owner", due_date: "2026-11-01", paid_at: "2026-11-01T12:00:00", amount: 100 },
  { id: "due", subscription_id: sub.id, user: "owner", due_date: "2026-11-14", amount: 200 },
  { id: "future", subscription_id: sub.id, user: "owner", due_date: "2026-11-28", amount: 300 },
];
const params = (subscription = sub, payments = records) => ({
  subscriptions: [subscription], currencies: [currency], cycles: [{ id: "monthly", name: "Monthly" as const }],
  year: 2026, month: 11, selectedDay: 14, paymentRecords: payments,
});
afterEach(cleanup);

it("removes a paused subscription's unpaid calendar entries and totals while preserving its paid history", () => {
  const before = JSON.stringify(records);
  const { result } = renderHook(() => useCalendarMonthData(params()));
  expect(result.current.entriesByDay[1]).toHaveLength(1);
  expect(result.current.entriesByDay[1][0].amount).toBe(100);
  expect(result.current.entriesByDay[14]).toBeUndefined();
  expect(result.current.entriesByDay[28]).toBeUndefined();
  expect(result.current.stats).toMatchObject({ count: 1, due: 0, awaitingConfirmation: 0 });
  expect(JSON.stringify(records)).toBe(before);
});
it("updates the calendar immediately when the subscription becomes inactive", () => {
  const { result, rerender } = renderHook(({ inactive }) => useCalendarMonthData(params({ ...sub, inactive })), { initialProps: { inactive: false } });
  expect(result.current.entriesByDay[14]).toHaveLength(1);
  expect(result.current.entriesByDay[28]).toHaveLength(1);
  rerender({ inactive: true });
  expect(result.current.entriesByDay[14]).toBeUndefined();
  expect(result.current.entriesByDay[28]).toBeUndefined();
  expect(result.current.entriesByDay[1]).toHaveLength(1);
});
it("keeps paid amounts in monthly and yearly history and removes inactive pending amounts", () => {
  const entries = buildMonthlyBudget([sub], [currency], records, true, new Date(2026, 10, 14));
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ date: "2026-11-01", amount: 100, status: "paid" });
  const totals = buildPaymentStatistics([sub], [currency], records, new Date(2026, 10, 14), 12, 12, 2026);
  expect(totals.paid[10]).toMatchObject({ total: 100, count: 1 });
  expect(totals.upcoming.every(month => month.total === 0 && month.count === 0)).toBe(true);
});
it("keeps independent unpaid payments despite their inactive display model", () => {
  const independent: PaymentRecord = { id: "independent", subscription_id: "", name: "Repair", currency: "try", user: "owner", due_date: "2026-11-14", amount: 75 };
  const { result } = renderHook(() => useCalendarMonthData({ ...params(), subscriptions: [], paymentRecords: [independent] }));
  expect(result.current.entriesByDay[14]).toHaveLength(1);
  expect(result.current.stats).toMatchObject({ count: 1, awaitingConfirmation: 75 });
  expect(buildMonthlyBudget([], [currency], [independent], true, new Date(2026, 10, 14))[0].amount).toBe(75);
});
it("does not recreate an unpaid final occurrence for a completed inactive schedule", () => {
  const finished = { ...sub, payment_limit: 1, payments_completed: 1 };
  const { result } = renderHook(() => useCalendarMonthData(params(finished, [records[1]])));
  expect(result.current.entriesByDay[14]).toBeUndefined();
  expect(result.current.stats.count).toBe(0);
  expect(buildMonthlyBudget([finished], [currency], [records[1]], true, new Date(2026, 10, 14))).toEqual([]);
});
it("keeps a moved confirmed payment on its saved date", () => {
  const paid = { ...records[0], due_date: "2026-11-16", scheduled_date: "2026-11-14" };
  const { result } = renderHook(() => useCalendarMonthData(params(sub, [paid])));
  expect(result.current.entriesByDay[16]).toHaveLength(1);
  expect(result.current.entriesByDay[16][0].amount).toBe(100);
  expect(result.current.entriesByDay[14]).toBeUndefined();
});
