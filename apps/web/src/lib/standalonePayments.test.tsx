import { renderHook } from "@testing-library/react";

import { getOccurrencesInMonth, getPaymentRecord } from "@/components/calendar/types";
import { useCalendarMonthData } from "@/components/calendar/useCalendarMonthData";
import type { Currency, PaymentRecord } from "@/types";

import { categoryPeriodCosts } from "./categoryPeriodCosts";
import { buildMonthlyBudget } from "./monthlyBudget";
import { paidTotals } from "./paidTotals";
import { withStandalonePayments } from "./standalonePayments";

const currencies: Currency[] = [
  { id: "eur", name: "Euro", code: "EUR", symbol: "€", rate: 1, is_main: true, user: "u" },
];
const records: PaymentRecord[] = [
  {
    id: "first",
    subscription_id: "",
    name: "Old service",
    currency: "eur",
    user: "u",
    due_date: "2026-10-05",
    paid_at: "2026-10-06T12:00:00Z",
    amount: 20,
  },
  {
    id: "second",
    subscription_id: "",
    name: "Other service",
    currency: "eur",
    user: "u",
    due_date: "2026-10-05",
    paid_at: "2026-10-06T12:00:00Z",
    amount: 30,
  },
];
const now = new Date(2026, 9, 17);

it("keeps independent payments on the same day separate in the calendar, budget and statistics", () => {
  const { result } = renderHook(() =>
    useCalendarMonthData({
      subscriptions: [],
      cycles: [],
      currencies,
      paymentRecords: records,
      year: 2026,
      month: 10,
      selectedDay: 5,
    }),
  );
  expect(result.current.selectedEntries.map((entry) => entry.sub.name)).toEqual([
    "Old service",
    "Other service",
  ]);
  expect(result.current.selectedDayTotal).toBe(50);
  expect(getPaymentRecord(records, "second", "2026-10-05")?.amount).toBe(30);
  expect(buildMonthlyBudget([], currencies, records, true, now)).toHaveLength(2);
  expect(paidTotals([], currencies, records, now).totalYearly).toBe(50);
  const display = withStandalonePayments([], records, currencies)[0];
  expect(getOccurrencesInMonth(display, 2026, 11, [])).toEqual([]);
  expect(buildMonthlyBudget([], currencies, records, true, new Date(2026, 10, 17))).toEqual([]);
});

it("preserves uploaded logos and expanded payment details in calendar and category statistics", () => {
  const payment: PaymentRecord = {
    ...records[0],
    logo: "custom.png",
    category: "video",
    payer: "me",
    payment_method: "card",
    expand: {
      category: { id: "video", name: "Video", user: "u" },
      payer: { id: "me", name: "Me", user: "u" },
      payment_method: { id: "card", name: "Card", user: "u" },
    },
  };
  const display = withStandalonePayments([], [payment], currencies)[0];
  expect(display).toMatchObject({
    logo: "custom.png",
    category: "video",
    payer: "me",
    payment_method: "card",
    expand: payment.expand,
  });
  const statistics = categoryPeriodCosts([], currencies, 1, (key) => key, now, {
    records: [payment],
  });
  expect(statistics.data).toEqual([{ name: "Video", value: 20, count: 1 }]);
});
