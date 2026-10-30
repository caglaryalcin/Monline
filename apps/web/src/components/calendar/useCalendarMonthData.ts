import { useMemo } from "react";

import { matchesCalendarSearch } from "@/components/calendar/calendarSearch";
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
import { type SpendingData, type SpendingEvent, uncoveredSpending } from "@/lib/spending";
import { paymentOwnerId, withStandalonePayments } from "@/lib/standalonePayments";
import type { Currency, Cycle, PaymentRecord, Subscription } from "@/types";

const NO_RECORDS: PaymentRecord[] = [];
const NO_SPENDING: SpendingEvent[] = [];
const NO_MOVES: NonNullable<SpendingData["calendar_moves"]> = [];

interface UseCalendarMonthDataParams {
  subscriptions: Subscription[];
  cycles: Cycle[];
  currencies: Currency[];
  year: number;
  month: number;
  selectedDay: number | null;
  paymentRecords?: PaymentRecord[];
  spendingEvents?: SpendingEvent[];
  calendarMoves?: SpendingData["calendar_moves"];
  includeAdjacentDays?: boolean;
  searchTerm?: string;
}

export function useCalendarMonthData({
  subscriptions,
  cycles,
  currencies,
  year,
  month,
  selectedDay,
  paymentRecords = NO_RECORDS,
  spendingEvents = NO_SPENDING,
  calendarMoves = NO_MOVES,
  includeAdjacentDays = false,
  searchTerm = "",
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

  const allEntriesByDate = useMemo<Record<string, DayEntry[]>>(() => {
    const entries: Record<string, DayEntry[]> = {};
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    if (includeAdjacentDays) {
      first.setDate(first.getDate() - first.getDay());
      last.setDate(last.getDate() + 6 - last.getDay());
    }
    const visible = (date: Date) => date >= first && date <= last;
    const months = (includeAdjacentDays ? [-1, 0, 1] : [0]).map(
      (offset) => new Date(year, month - 1 + offset, 1),
    );
    const recordsBySubscription = new Map<string, PaymentRecord[]>();
    for (const record of paymentRecords) {
      const date = parseLocalDate(record.due_date);
      if (!date || !visible(date)) continue;
      const group = recordsBySubscription.get(paymentOwnerId(record)) ?? [];
      group.push(record);
      recordsBySubscription.set(paymentOwnerId(record), group);
    }

    for (const subscription of withStandalonePayments(subscriptions, paymentRecords, currencies)) {
      const subscriptionRecords = recordsBySubscription.get(subscription.id) ?? [];
      const dates = new Set(
        months
          .flatMap((date) =>
            getOccurrencesInMonth(
              subscription,
              date.getFullYear(),
              date.getMonth() + 1,
              cycles,
              paymentRecords,
            ),
          )
          .map(toDateStr),
      );
      for (const record of subscriptionRecords) {
        dates.add(toDateOnly(record.due_date));
      }
      for (const key of [...dates].sort()) {
        const date = parseLocalDate(key)!;
        if (!visible(date)) continue;
        const record = getPaymentRecord(subscriptionRecords, subscription.id, key);
        (entries[key] ??= []).push({
          sub: subscription,
          date,
          ...(record?.amount != null ? { amount: record.amount } : {}),
        });
      }
    }

    for (const event of uncoveredSpending(spendingEvents, paymentRecords, subscriptions)) {
      if (event.source === "ledger" && event.card_paid) continue;
      const move = calendarMoves.find(
        (move) =>
          move.source === event.source &&
          move.source_id === event.id &&
          move.source_date === event.date,
      );
      const date = parseLocalDate(move?.date || event.date);
      if (!date || !visible(date)) continue;
      const currency = currencies.find((item) => item.code === event.currency) || {
        id: `spending:${event.currency}`,
        code: event.currency,
        name: event.currency,
        symbol: event.currency,
        rate: 0,
        is_main: false,
        user: "",
      };
      const sub: Subscription = {
        id: event.id,
        name: event.name,
        price: event.amount,
        currency: currency.id,
        frequency: 1,
        cycle: "",
        next_payment: event.date,
        start_date: event.date,
        auto_renew: false,
        inactive: true,
        notify: false,
        notify_days_before: 0,
        user: "",
        expand: { currency },
      };
      (entries[toDateStr(date)] ??= []).push({ sub, date, amount: event.amount, spending: event });
    }
    return entries;
  }, [
    subscriptions,
    cycles,
    year,
    month,
    paymentRecords,
    spendingEvents,
    currencies,
    calendarMoves,
    includeAdjacentDays,
  ]);

  const entriesByDate = useMemo<Record<string, DayEntry[]>>(() => {
    if (!searchTerm.trim()) return allEntriesByDate;
    return Object.fromEntries(
      Object.entries(allEntriesByDate)
        .map(
          ([date, entries]) =>
            [
              date,
              entries.filter((entry) => matchesCalendarSearch(entry.sub.name, searchTerm)),
            ] as const,
        )
        .filter(([, entries]) => entries.length > 0),
    );
  }, [allEntriesByDate, searchTerm]);

  const entriesByDay = useMemo<Record<number, DayEntry[]>>(
    () =>
      Object.fromEntries(
        Object.entries(entriesByDate)
          .filter(([date]) => date.startsWith(`${year}-${String(month).padStart(2, "0")}-`))
          .map(([date, entries]) => [Number(date.slice(8, 10)), entries]),
      ),
    [entriesByDate, year, month],
  );

  const stats = useMemo(() => {
    const today = new Date(localToday + "T00:00:00");

    let count = 0;
    let total = 0;
    let due = 0;
    let awaitingConfirmation = 0;

    for (const entries of Object.values(entriesByDay)) {
      for (const { sub, date, amount: recordedAmount, spending } of entries) {
        const currency = sub.expand?.currency ?? currencyById.get(sub.currency);
        const amount = toMain(recordedAmount ?? sub.price, currency);
        count += 1;
        if (!isExpense(sub) || spending?.counts_as_expense === false) continue;
        if (spending && !currency?.is_main && !(currency && currency.rate > 0)) continue;
        total += amount;

        const paid = spending
          ? spending.status !== "planned"
          : !!getPaymentRecord(paymentRecords, sub.id, toDateStr(date))?.paid_at;
        if (!paid) {
          if (date > today) due += amount;
          else awaitingConfirmation += amount;
        }
      }
    }
    for (const event of spendingEvents.filter(
      (item) =>
        item.undated &&
        item.statement_period === `${year}-${String(month).padStart(2, "0")}` &&
        matchesCalendarSearch(item.name, searchTerm),
    )) {
      const currency = currencies.find((item) => item.code === event.currency);
      if (currency?.is_main || (currency && currency.rate > 0))
        total += toMain(event.amount, currency);
    }

    return { count, total, due, awaitingConfirmation };
  }, [
    entriesByDay,
    currencyById,
    spendingEvents,
    currencies,
    year,
    month,
    paymentRecords,
    localToday,
    searchTerm,
  ]);

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
      selectedEntries.reduce((sum, { sub, amount, spending }) => {
        if (!isExpense(sub) || spending?.counts_as_expense === false) return sum;
        const currency = sub.expand?.currency ?? currencyById.get(sub.currency);
        if (spending && !currency?.is_main && !(currency && currency.rate > 0)) return sum;
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
