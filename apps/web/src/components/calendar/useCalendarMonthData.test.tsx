import { renderHook } from "@testing-library/react";

import type { Currency, Subscription } from "@/types";

import { useCalendarMonthData } from "./useCalendarMonthData";

function getCurrency(overrides: Partial<Currency> = {}): Currency {
  return {
    id: "cur-1",
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    rate: 1,
    is_main: false,
    user: "user-1",
    ...overrides,
  };
}

function getSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    name: "Netflix",
    price: 10,
    currency: "cur-1",
    frequency: 1,
    cycle: "cycle-monthly",
    next_payment: "2026-04-05",
    auto_renew: true,
    start_date: "2026-01-01",
    notify: true,
    notify_days_before: 3,
    inactive: false,
    user: "user-1",
    ...overrides,
  };
}

describe("useCalendarMonthData", () => {
  it.each([false, true])(
    "does not recreate cleared history for Amazon Prime (imported: %s)",
    (imported) => {
      const sub = getSubscription({
        name: "Amazon Prime",
        statement_imported: imported,
        start_date: "2026-01-23",
        next_payment: "2026-10-23",
        price: 69.9,
      });
      const records = [
        {
          id: "september-charge",
          user: sub.user,
          subscription_id: sub.id,
          due_date: "2026-09-23",
          paid_at: "2026-09-23T12:00:00Z",
          amount: 49.9,
        },
      ];
      const { result, rerender } = renderHook(
        ({ month, paymentRecords }) =>
          useCalendarMonthData({
            subscriptions: [sub],
            cycles: [{ id: "cycle-monthly", name: "Monthly" }],
            currencies: [getCurrency({ is_main: true })],
            year: 2026,
            month,
            selectedDay: 23,
            paymentRecords,
          }),
        { initialProps: { month: 9, paymentRecords: records } },
      );
      expect(result.current.selectedEntries).toHaveLength(1);
      expect(result.current.stats.total).toBe(49.9);
      rerender({ month: 9, paymentRecords: [] });
      expect(result.current.selectedEntries).toEqual([]);
      expect(result.current.stats.total).toBe(0);
      rerender({ month: 10, paymentRecords: [] });
      expect(result.current.selectedEntries).toHaveLength(1);
      expect(result.current.stats.total).toBe(69.9);
      rerender({ month: 11, paymentRecords: [] });
      expect(result.current.selectedEntries).toHaveLength(1);
    },
  );

  it.each([
    { month: 1, total: 15 },
    { month: 2, total: 17 },
    ...Array.from({ length: 8 }, (_, index) => ({ month: index + 3, total: 0 })),
    { month: 11, total: 20 },
    { month: 12, total: 20 },
  ])("does not invent imported payments for month $month", ({ month, total }) => {
    const sub = getSubscription({
      name: "YouTube Member",
      statement_imported: true,
      price: 20,
      start_date: "2026-01-26",
      next_payment: "2026-11-26",
    });
    const { result } = renderHook(() =>
      useCalendarMonthData({
        subscriptions: [sub],
        cycles: [{ id: "cycle-monthly", name: "Monthly" }],
        currencies: [getCurrency({ is_main: true })],
        year: 2026,
        month,
        selectedDay: 26,
        paymentRecords: [
          {
            id: "january-import",
            user: sub.user,
            subscription_id: sub.id,
            due_date: "2026-01-26",
            paid_at: "2026-01-26T12:00:00Z",
            amount: 15,
          },
          {
            id: "february-import",
            user: sub.user,
            subscription_id: sub.id,
            due_date: "2026-02-26",
            paid_at: "2026-02-26T12:00:00Z",
            amount: 17,
          },
        ],
      }),
    );
    expect(result.current.stats.total).toBe(total);
    expect(result.current.selectedEntries).toHaveLength(total === 0 ? 0 : 1);
    if (month <= 2) expect(result.current.selectedEntries[0].amount).toBe(total);
  });

  it("keeps historical charges before the current schedule and uses the recorded amount without duplicates", () => {
    const sub = getSubscription({
      inactive: true,
      start_date: "2026-05-01",
      next_payment: "2026-05-05",
    });
    const { result } = renderHook(() =>
      useCalendarMonthData({
        subscriptions: [sub],
        cycles: [{ id: "cycle-monthly", name: "Monthly" }],
        currencies: [getCurrency({ is_main: true })],
        year: 2026,
        month: 4,
        selectedDay: 5,
        paymentRecords: [
          {
            id: "past-1",
            user: "user-1",
            subscription_id: sub.id,
            due_date: "2026-04-05",
            paid_at: "2026-04-07T12:00:00Z",
            amount: 0,
          },
          {
            id: "past-2",
            user: "user-1",
            subscription_id: sub.id,
            due_date: "2026-04-05",
            paid_at: "2026-04-06T12:00:00Z",
            amount: 19,
          },
          {
            id: "past-3",
            user: "user-1",
            subscription_id: sub.id,
            due_date: "2026-03-05",
            paid_at: "2026-03-07T12:00:00Z",
            amount: 99,
          },
        ],
      }),
    );
    expect(result.current.selectedEntries).toHaveLength(1);
    expect(result.current.selectedEntries[0].amount).toBe(0);
    expect(result.current.selectedDayTotal).toBe(0);
    expect(result.current.stats.count).toBe(1);
    expect(result.current.stats.total).toBe(0);
    expect(sub.price).toBe(10);
  });
  it("builds month cells, aggregates day entries, and computes selected-day totals", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T12:00:00Z"));

    const currencies = [
      getCurrency({ id: "cur-1", is_main: true }),
      getCurrency({ id: "cur-2", code: "BRL", symbol: "R$", rate: 5 }),
    ];
    const subscriptions = [
      getSubscription({
        id: "sub-1",
        price: 10,
        next_payment: "2026-04-05",
      }),
      getSubscription({
        id: "sub-2",
        price: 5,
        currency: "cur-2",
        next_payment: "2026-04-12",
      }),
      getSubscription({
        id: "sub-3",
        price: 20,
        next_payment: "2026-04-20",
      }),
    ];

    const { result } = renderHook(() =>
      useCalendarMonthData({
        subscriptions,
        cycles: [{ id: "cycle-monthly", name: "Monthly" }],
        currencies,
        year: 2026,
        month: 4,
        selectedDay: 20,
      }),
    );

    expect(result.current.mainCurrency).toEqual(currencies[0]);
    expect(result.current.daysInMonth).toBe(30);
    expect(result.current.allCells.slice(0, 3)).toEqual([
      { day: 29, type: "prev" },
      { day: 30, type: "prev" },
      { day: 31, type: "prev" },
    ]);
    expect(result.current.allCells.at(-1)).toEqual({ day: 2, type: "next" });
    expect(result.current.entriesByDay[5]).toHaveLength(1);
    expect(result.current.entriesByDay[12]).toHaveLength(1);
    expect(result.current.entriesByDay[20]).toHaveLength(1);
    expect(result.current.selectedEntries).toEqual([
      {
        sub: expect.objectContaining({ id: "sub-3" }),
        date: new Date(2026, 3, 20),
      },
    ]);
    expect(result.current.selectedDayTotal).toBe(20);
    expect(result.current.stats).toEqual({
      count: 3,
      total: 31,
      due: 21,
    });

    vi.useRealTimers();
  });

  it("does not show subscriptions in months before their start date", () => {
    // Regression (#19): a subscription starting on 2026-01-01 must not appear
    // in December 2025 or any earlier month.
    const subscription = getSubscription({
      start_date: "2026-01-01",
      next_payment: "2026-01-05",
    });

    const { result } = renderHook(() =>
      useCalendarMonthData({
        subscriptions: [subscription],
        cycles: [{ id: "cycle-monthly", name: "Monthly" }],
        currencies: [getCurrency({ is_main: true })],
        year: 2025,
        month: 12,
        selectedDay: 5,
      }),
    );

    expect(result.current.entriesByDay).toEqual({});
    expect(result.current.selectedEntries).toEqual([]);
    expect(result.current.stats).toEqual({ count: 0, total: 0, due: 0 });
  });

  it("shows one-time credits on the calendar without adding them to expense totals", () => {
    const expense = getSubscription({
      id: "expense",
      price: 40,
      next_payment: "2026-04-15",
    });
    const credit = getSubscription({
      id: "credit",
      record_type: "credit",
      price: 200,
      cycle: "one-time",
      next_payment: "2026-04-15",
    });

    const { result } = renderHook(() =>
      useCalendarMonthData({
        subscriptions: [expense, credit],
        cycles: [
          { id: "cycle-monthly", name: "Monthly" },
          { id: "one-time", name: "One-Time" },
        ],
        currencies: [getCurrency({ is_main: true })],
        year: 2026,
        month: 4,
        selectedDay: 15,
      }),
    );

    expect(result.current.entriesByDay[15]).toHaveLength(2);
    expect(result.current.stats.count).toBe(2);
    expect(result.current.stats.total).toBe(40);
    expect(result.current.selectedDayTotal).toBe(40);
  });

  it("falls back to the first currency and returns empty selected data when no day is selected", () => {
    const firstCurrency = getCurrency({ id: "cur-a", is_main: false });

    const { result } = renderHook(() =>
      useCalendarMonthData({
        subscriptions: [getSubscription({ next_payment: "2026-04-05" })],
        cycles: [{ id: "cycle-monthly", name: "Monthly" }],
        currencies: [firstCurrency],
        year: 2026,
        month: 4,
        selectedDay: null,
      }),
    );

    expect(result.current.mainCurrency).toEqual(firstCurrency);
    expect(result.current.selectedEntries).toEqual([]);
    expect(result.current.selectedDayTotal).toBe(0);
  });

  it("produces no trailing next-month cells when totalCells is already divisible by 7", () => {
    // February 2015 starts on Sunday (firstDayOfWeek=0), has 28 days → 0+28=28 cells, 28%7=0 → remainingCells=0
    const { result } = renderHook(() =>
      useCalendarMonthData({
        subscriptions: [],
        cycles: [],
        currencies: [getCurrency({ is_main: true })],
        year: 2015,
        month: 2,
        selectedDay: null,
      }),
    );

    expect(result.current.allCells.every((cell) => cell.type !== "next")).toBe(true);
    expect(result.current.allCells).toHaveLength(28);
  });

  it("returns empty selectedEntries when selectedDay has no entries and uses currencyById for total", () => {
    const mainCur = getCurrency({ id: "cur-main", is_main: true, rate: 1 });
    const otherCur = getCurrency({ id: "cur-other", is_main: false, rate: 2 });

    // Sub has no expand.currency – uses currencyById lookup for selectedDayTotal
    const sub = getSubscription({
      id: "sub-x",
      price: 10,
      currency: "cur-other",
      next_payment: "2026-04-15",
    });

    const { result } = renderHook(() =>
      useCalendarMonthData({
        subscriptions: [sub],
        cycles: [{ id: "cycle-monthly", name: "Monthly" }],
        currencies: [mainCur, otherCur],
        year: 2026,
        month: 4,
        // Day 15 has the subscription entry; total uses currencyById fallback
        selectedDay: 15,
      }),
    );

    expect(result.current.selectedEntries).toHaveLength(1);
    // With no expand.currency, currencyById.get("cur-other") provides the currency
    expect(result.current.selectedDayTotal).toBeGreaterThan(0);

    // Selecting a day with no entries returns [] and total of 0
    const { result: result2 } = renderHook(() =>
      useCalendarMonthData({
        subscriptions: [sub],
        cycles: [{ id: "cycle-monthly", name: "Monthly" }],
        currencies: [mainCur, otherCur],
        year: 2026,
        month: 4,
        selectedDay: 1, // no subscription on day 1
      }),
    );

    expect(result2.current.selectedEntries).toEqual([]);
    expect(result2.current.selectedDayTotal).toBe(0);
  });
});
