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
import { useLocalToday } from "@/hooks/useLocalToday";
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
  const localToday = useLocalToday();
  const mainCurrency = useMemo(
    () => currencies.find((currency) => currency.is_main) ?? currencies[0],
    [currencies],
  );

  const currencyById = useMemo(
    () => new Map(currencies.map((currency) => [currency.id, currency])),
    [currencies],
  );

  const entriesByDate = useMemo<Record<string, DayEntry[]>>(() => {
    const entries: Record<string, DayEntry[]> = {};
    const rangeStart = new Date(year, month - 2, 1);
    const rangeEnd = new Date(year, month + 1, 1);
    const recordsBySubscription = new Map<string, PaymentRecord[]>();
    for (const record of paymentRecords) {
      const date = parseLocalDate(record.due_date);
      if (!date || date < rangeStart || date >= rangeEnd) continue;
      const group = recordsBySubscription.get(paymentOwnerId(record)) ?? [];
      group.push(record);
      recordsBySubscription.set(paymentOwnerId(record), group);
    }

    for (const subscription of withStandalonePayments(subscriptions, paymentRecords, currencies)) {
      const subscriptionRecords = recordsBySubscription.get(subscription.id) ?? [];
      const dates = new Set(
        [-1, 0, 1].flatMap((offset) => {
          const date = new Date(year, month - 1 + offset, 1);
          return getOccurrencesInMonth(
            subscription,
            date.getFullYear(),
            date.getMonth() + 1,
            cycles,
            paymentRecords,
          ).map(toDateStr);
        }),
      );
      for (const record of subscriptionRecords) {
        dates.add(toDateOnly(record.due_date));
      }
      for (const key of [...dates].sort()) {
        const date = parseLocalDate(key)!;

        const record = getPaymentRecord(subscriptionRecords, subscription.id, key);
        (entries[key] ??= []).push({
          sub: subscription,
          date,
          ...(record?.amount != null ? { amount: record.amount } : {}),
        });
      }
    }

    return entries;
  }, [subscriptions, cycles, year, month, paymentRecords, currencies]);

  const entriesByDay = useMemo<Record<number, DayEntry[]>>(() => {
    const entries: Record<number, DayEntry[]> = {};
    for (const [key, values] of Object.entries(entriesByDate)) {
      const date = parseLocalDate(key)!;
      if (date.getFullYear() === year && date.getMonth() + 1 === month)
        entries[date.getDate()] = values;
    }
    return entries;
  }, [entriesByDate, year, month]);

  const stats = useMemo(() => {
    const today = new Date(localToday + "T00:00:00");

    let count = 0;
    let total = 0;
    let due = 0;
    let awaitingConfirmation = 0;

    for (const entries of Object.values(entriesByDay)) {
      for (const { sub, date, amount: recordedAmount } of entries) {
        const currency = sub.expand?.currency ?? currencyById.get(sub.currency);
        const amount = toMain(recordedAmount ?? sub.price, currency);
        count += 1;
        if (!isExpense(sub)) continue;
        total += amount;

        const paid = !!getPaymentRecord(paymentRecords, sub.id, toDateStr(date))?.paid_at;
        if (!paid) {
          if (date > today) due += amount;
          else awaitingConfirmation += amount;
        }
      }
    }

    return { count, total, due, awaitingConfirmation };
  }, [entriesByDay, currencyById, paymentRecords, localToday]);

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
    entriesByDate,
    mainCurrency,
    selectedDayTotal,
    selectedEntries,
    stats,
  };
}
