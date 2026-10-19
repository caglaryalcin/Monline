import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDot } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { DOW_KEYS, MONTH_KEYS } from "@/components/calendar/constants";
import {
  type DayEntry,
  getColorForSub,
  getPaymentRecord,
  toDateStr,
} from "@/components/calendar/types";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isCredit } from "@/lib/recordTypes";
import { cn, formatPrice } from "@/lib/utils";
import type { Currency, PaymentRecord } from "@/types";

import { CalendarDayMenu } from "./CalendarDayMenu";
import { CalendarMonthPicker } from "./CalendarMonthPicker";

type CalendarCell = {
  day: number;
  type: "prev" | "current" | "next";
};

interface CalendarMonthCardProps {
  month: number;
  year: number;
  now: Date;
  daysInMonth: number;
  isCurrentMonth: boolean;
  loading: boolean;
  selectedDay: number | null;
  selectedDate?: Date | null;
  allCells: CalendarCell[];
  entriesByDay: Record<number, DayEntry[]>;
  mainCurrency?: Currency;
  currencyById: Map<string, Currency>;
  paymentTracking: boolean;
  paymentRecords: PaymentRecord[];
  onPrev: () => void;
  onNext: () => void;
  onGoToday: () => void;
  onSelectMonth: (month: number, year: number) => void;
  onSelectDay: (day: number | null) => void;
  onSelectDate?: (date: Date | null) => void;
  onAddHistorical?: (date: Date) => void;
}

export function CalendarMonthCard({
  month,
  year,
  now,
  daysInMonth,
  isCurrentMonth,
  loading,
  selectedDay,
  selectedDate,
  allCells,
  entriesByDay,
  mainCurrency,
  currencyById,
  paymentTracking,
  paymentRecords,
  onPrev,
  onNext,
  onGoToday,
  onSelectMonth,
  onSelectDay,
  onSelectDate,
  onAddHistorical,
}: CalendarMonthCardProps) {
  const { t, i18n } = useTranslation();
  const weeks = Math.max(1, Math.ceil(allCells.length / 7));
  const weekdayFormatter = new Intl.DateTimeFormat(
    (i18n?.resolvedLanguage || i18n?.language || "en").replace(/_/g, "-"),
    { weekday: "short", timeZone: "UTC" },
  );

  return (
    <Card className="monline-calendar-month overflow-hidden">
      <div className="monline-calendar-month-header flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start sm:gap-3">
          <CalendarMonthPicker month={month} year={year} onSelect={onSelectMonth} />
          <div className="flex items-center gap-1 text-sm font-medium text-foreground sm:text-base">
            <button
              type="button"
              aria-label={t("prev_month")}
              onClick={onPrev}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="whitespace-nowrap tabular-nums">
              {t(MONTH_KEYS[month - 1]).slice(0, 3)} 1 - {daysInMonth}, {year}
            </span>
            <button
              type="button"
              aria-label={t("next_month")}
              onClick={onNext}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {!isCurrentMonth ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onGoToday}>
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              {t("today")}
            </Button>
          ) : null}
        </div>
      </div>

      <CardContent className="monline-calendar-month-content p-0">
        <div className="monline-calendar-weekdays grid shrink-0 grid-cols-7 border-b bg-muted/30">
          {DOW_KEYS.map((dayOfWeek, index) => (
            <div
              key={dayOfWeek}
              className={cn(
                "truncate px-1 py-2.5 text-center text-xs font-semibold uppercase tracking-wider",
                index === 0 || index === 6 ? "text-muted-foreground/50" : "text-muted-foreground",
              )}
            >
              <span className="sm:hidden" title={t(dayOfWeek)}>
                {weekdayFormatter.format(new Date(Date.UTC(2023, 0, index + 1)))}
              </span>
              <span className="hidden sm:inline">{t(dayOfWeek)}</span>
            </div>
          ))}
        </div>

        <CalendarDayMenu
          now={now}
          onSelectDate={(date) => {
            if (onSelectDate) onSelectDate(date);
            else if (date.getFullYear() === year && date.getMonth() + 1 === month)
              onSelectDay(date.getDate());
          }}
          onAddHistorical={onAddHistorical}
        >
          <div
            className="monline-calendar-grid grid grid-cols-7"
            style={{ "--calendar-weeks": weeks } as CSSProperties}
          >
            {allCells.map((cell, index) => {
              const isOtherMonth = cell.type !== "current";
              const cellDate = new Date(
                year,
                month - 1 + (cell.type === "prev" ? -1 : cell.type === "next" ? 1 : 0),
                cell.day,
              );
              const entries = isOtherMonth ? [] : (entriesByDay[cell.day] ?? []);
              const columnIndex = index % 7;
              const isWeekend = columnIndex === 0 || columnIndex === 6;
              const isToday =
                !isOtherMonth &&
                cell.day === now.getDate() &&
                month === now.getMonth() + 1 &&
                year === now.getFullYear();
              const isPast =
                !isOtherMonth &&
                !isToday &&
                new Date(year, month - 1, cell.day) <
                  new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const isSelected = selectedDate
                ? toDateStr(selectedDate) === toDateStr(cellDate)
                : !isOtherMonth && cell.day === selectedDay;

              return (
                <button
                  key={`${cell.type}-${cell.day}`}
                  type="button"
                  data-calendar-date={toDateStr(cellDate)}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => {
                    if (onSelectDate) {
                      onSelectDate(isSelected ? null : cellDate);
                      return;
                    }
                    if (isOtherMonth) {
                      return;
                    }

                    onSelectDay(cell.day === selectedDay ? null : cell.day);
                  }}
                  className={cn(
                    "group relative flex min-w-0 min-h-[88px] flex-col items-stretch border-b border-r p-1 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:min-h-[120px] sm:p-2",
                    "cursor-pointer",
                    isOtherMonth && "bg-muted/20",
                    isWeekend && !isOtherMonth && !isToday && "bg-muted/10",
                    isToday && "z-10 border-primary ring-2 ring-inset ring-primary",
                    isSelected && !isToday && "bg-primary/5",
                    isSelected && !isToday && "ring-2 ring-inset ring-primary/40",
                  )}
                >
                  <div className="mb-1.5 flex items-start justify-between">
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center text-sm font-medium transition-colors",
                        isToday && "rounded-full bg-primary font-bold text-primary-foreground",
                        !isToday &&
                          !isOtherMonth &&
                          (isPast ? "text-muted-foreground" : "text-foreground"),
                        isOtherMonth && "text-muted-foreground/40",
                      )}
                    >
                      {cell.day}
                    </span>
                  </div>

                  {!loading ? (
                    <div className="space-y-1">
                      {entries.map(({ sub, date, amount }, entryIndex) => {
                        const credit = isCredit(sub);
                        const colorClass = getColorForSub(sub, entryIndex);
                        const dateStr = toDateStr(date);
                        const paymentRecord = !credit
                          ? getPaymentRecord(paymentRecords, sub.id, dateStr)
                          : undefined;
                        const isPaid = !!paymentRecord?.paid_at;
                        const isOverdue =
                          paymentTracking &&
                          !credit &&
                          !isPaid &&
                          date < new Date(now.getFullYear(), now.getMonth(), now.getDate());

                        return (
                          <div
                            key={`${sub.id}-${dateStr}`}
                            className={cn(
                              "relative flex min-w-0 items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 transition-all sm:justify-start sm:gap-1.5 sm:px-1.5 sm:py-0.5",
                              colorClass,
                            )}
                          >
                            <SubscriptionLogo
                              sub={sub}
                              className="h-4 w-4 shrink-0 rounded-sm object-contain text-[9px]"
                            />

                            <span className="calendar-payment-name sr-only">{sub.name}</span>

                            {(paymentTracking || isPaid) && !credit && (isPaid || isOverdue) ? (
                              <span
                                className="absolute -right-0.5 -top-0.5 shrink-0 sm:static"
                                title={t(isPaid ? "paid" : "overdue")}
                              >
                                {isPaid ? (
                                  <CheckCircle2
                                    aria-hidden="true"
                                    className="h-3 w-3 text-green-600 dark:text-green-400"
                                  />
                                ) : (
                                  <CircleDot
                                    aria-hidden="true"
                                    className="h-3 w-3 text-red-600 dark:text-red-400"
                                  />
                                )}
                                <span className="sr-only">{t(isPaid ? "paid" : "overdue")}</span>
                              </span>
                            ) : null}

                            {mainCurrency ? (
                              <span className="calendar-payment-amount sr-only">
                                {credit ? "+" : ""}
                                {formatPrice(
                                  amount ?? sub.price,
                                  (sub.expand?.currency ?? currencyById.get(sub.currency))
                                    ?.symbol ?? mainCurrency.symbol,
                                  {
                                    currencyCode:
                                      (sub.expand?.currency ?? currencyById.get(sub.currency))
                                        ?.code ?? mainCurrency.code,
                                  },
                                )}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </CalendarDayMenu>
      </CardContent>
    </Card>
  );
}
