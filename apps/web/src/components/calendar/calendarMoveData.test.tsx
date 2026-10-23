import { renderHook } from "@testing-library/react";

import type { Currency, PaymentRecord, Subscription } from "@/types";

import { useCalendarMonthData } from "./useCalendarMonthData";

it("removes the moved projection from its original month and exposes the adjacent target without adding it to this month's totals", () => {
  const currency = { id: "try", is_main: true, rate: 1 } as Currency;
  const subscription = {
    id: "sub",
    name: "Subscription",
    next_payment: "2026-11-30",
    start_date: "2026-11-30",
    frequency: 1,
    cycle: "monthly",
    currency: currency.id,
    price: 100,
    expand: { cycle: { id: "monthly", name: "Monthly" } },
  } as Subscription;
  const record = {
    id: "payment",
    user: "user",
    subscription_id: "sub",
    scheduled_date: "2026-11-30",
    due_date: "2026-12-02",
    amount: 80,
  } as PaymentRecord;
  const params = {
    subscriptions: [subscription],
    cycles: [],
    currencies: [currency],
    year: 2026,
    month: 11,
    selectedDay: null,
    paymentRecords: [record],
  };
  const { result, rerender } = renderHook((options) => useCalendarMonthData(options), {
    initialProps: params,
  });
  expect(result.current.entriesByDay[30]).toBeUndefined();
  expect(result.current.entriesByDate["2026-12-02"]).toEqual([
    expect.objectContaining({ amount: 80 }),
  ]);
  expect(result.current.stats).toMatchObject({ count: 0, total: 0 });
  rerender({ ...params, month: 12 });
  expect(result.current.entriesByDay[2]).toHaveLength(1);
  expect(result.current.entriesByDay[30]).toHaveLength(1);
  expect(result.current.stats).toMatchObject({ count: 2, total: 180 });
});
