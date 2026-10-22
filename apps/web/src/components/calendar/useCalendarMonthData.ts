import { useMemo } from "react";

import {
  type DayEntry,
  getOccurrencesInMonth,
  getPaymentRecord,
  parseLocalDate,
  toDateOnly,
  toDateStr,
  toMain,
} from "@/components/calendar/types";
import { isExpense } from "@/lib/recordTypes";
import { paymentOwnerId, withStandalonePayments } from "@/lib/standalonePayments";
import type { Currency, Cycle, PaymentRecord, Subscription } from "@/types";

const NO_RECORDS: PaymentRecord[] = [];

interface UseCalendarMonthDataParams {
  subscriptions: Subscription[];
  cycles: Cycle[];
  currencies: Currency[];
  year: number;
  month: number;
  selectedDay: number | null;
  paymentRecords?: PaymentRecord[];
}

export function useCalendarMonthData({
  subscriptions,
  cycles,
  currencies,
  year,
  month,
  selectedDay,
  paymentRecords = NO_RECORDS,
}: UseCalendarMonthDataParams) {
  const mainCurrency = useMemo(
    () => currencies.find((currency) => currency.is_main) ?? currencies[0],
    [currencies],
  );

  const currencyById = useMemo(
    () => new Map(currencies.map((currency) => [currency.id, currency])),
    [currencies],
  );

  const entriesByDay = useMemo<Record<number, DayEntry[]>>(() => {
    const entries: Record<number, DayEntry[]> = {};
    const recordsBySubscription = new Map<string, PaymentRecord[]>();
    for (const record of paymentRecords) {
      const date = parseLocalDate(record.due_date);
      if (!date || date.getFullYear() !== year || date.getMonth() + 1 !== month) continue;
      const group = recordsBySubscription.get(paymentOwnerId(record)) ?? [];
      group.push(record);
      recordsBySubscription.set(paymentOwnerId(record), group);
    }

    for (const subscription of withStandalonePayments(subscriptions, paymentRecords, currencies)) {
      const subscriptionRecords = recordsBySubscription.get(subscription.id) ?? [];
      const dates = new Set(
        getOccurrencesInMonth(subscription, year, month, cycles).map(toDateStr),
      );
      for (const record of subscriptionRecords) {
        if (record.paid_at) dates.add(toDateOnly(record.due_date));
      }
      for (const key of [...dates].sort()) {
        const date = parseLocalDate(key)!;
        const day = date.getDate();
        const record = getPaymentRecord(subscriptionRecords, subscription.id, key);
        (entries[day] ??= []).push({
          sub: subscription,
          date,
          ...(record?.paid_at && record.amount != null ? { amount: record.amount } : {}),
        });
      }
    }

    return entries;
  }, [subscriptions, cycles, year, month, paymentRecords, currencies]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let count = 0;
    let total = 0;
    let due = 0;

    for (const entries of Object.values(entriesByDay)) {
      for (const { sub, date, amount: recordedAmount } of entries) {
        const currency = sub.expand?.currency ?? currencyById.get(sub.currency);
        const amount = toMain(recordedAmount ?? sub.price, currency);
        count += 1;
        if (!isExpense(sub)) continue;
        total += amount;

        if (date >= today) {
          due += amount;
        }
      }
    }

    return { count, total, due };
  }, [entriesByDay, currencyById]);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  const allCells = useMemo(() => {
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const currentMonthDays = new Date(year, month, 0).getDate();
    const previousMonthDays = new Date(year, month - 1, 0).getDate();

    const previousCells = Array.from({ length: firstDayOfWeek }, (_, index) => ({
      day: previousMonthDays - firstDayOfWeek + 1 + index,
      type: "prev" as const,
    }));

    const currentCells = Array.from({ length: currentMonthDays }, (_, index) => ({
      day: index + 1,
      type: "current" as const,
    }));

    const totalCells = previousCells.length + currentCells.length;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

    const nextCells = Array.from({ length: remainingCells }, (_, index) => ({
      day: index + 1,
      type: "next" as const,
    }));

    return [...previousCells, ...currentCells, ...nextCells];
  }, [year, month]);

  const selectedEntries = useMemo(
    () => (selectedDay ? (entriesByDay[selectedDay] ?? []) : []),
    [selectedDay, entriesByDay],
  );

  const selectedDayTotal = useMemo(
    () =>
      selectedEntries.reduce((sum, { sub, amount }) => {
        if (!isExpense(sub)) return sum;
        const currency = sub.expand?.currency ?? currencyById.get(sub.currency);
        return sum + toMain(amount ?? sub.price, currency);
      }, 0),
    [selectedEntries, currencyById],
  );

  return {
    allCells,
    currencyById,
    daysInMonth,
    entriesByDay,
    mainCurrency,
    selectedDayTotal,
    selectedEntries,
    stats,
  };
}
