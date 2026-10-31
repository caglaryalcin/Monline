import "./payment-colors.css";

import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  GripVertical,
} from "lucide-react";
import { type CSSProperties, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { DOW_KEYS, MONTH_KEYS } from "@/components/calendar/constants";
import {
  type DayEntry,
  getPaymentRecord,
  PAYMENT_COLORS,
  toDateStr,
} from "@/components/calendar/types";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveLocale } from "@/lib/locale";
import { isCredit } from "@/lib/recordTypes";
import { paymentOwnerId } from "@/lib/standalonePayments";
import { cn, formatPrice } from "@/lib/utils";
import type { Currency, PaymentRecord } from "@/types";

import { CalendarDayMenu } from "./CalendarDayMenu";
import { CalendarMonthPicker } from "./CalendarMonthPicker";
import { CalendarPaymentLegend } from "./CalendarPaymentLegend";
import { paymentAppearance } from "./paymentAppearance";
import { useCalendarDrag } from "./useCalendarDrag";

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
  entriesByDate?: Record<string, DayEntry[]>;
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
  onMovePayment?: (entry: DayEntry, date: Date) => void;
  movingPayment?: boolean;
  onMoveToMonth?: (entry: DayEntry) => void;
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
  entriesByDate,
  mainCurrency,
  currencyById,
  paymentRecords,
  onPrev,
  onNext,
  onGoToday,
  onSelectMonth,
  onSelectDay,
  onSelectDate,
  onAddHistorical,
  onMovePayment,
  movingPayment = false,
  onMoveToMonth,
}: CalendarMonthCardProps) {
  const { t, i18n } = useTranslation();
  const drag = useCalendarDrag(onMovePayment, movingPayment);
  const recordsByOwner = useMemo(() => {
    const grouped = new Map<string, PaymentRecord[]>();
    for (const record of paymentRecords) {
      const owner = paymentOwnerId(record);
      const records = grouped.get(owner) ?? [];
      records.push(record);
      grouped.set(owner, records);
    }
    return grouped;
  }, [paymentRecords]);
  const weeks = Math.max(1, Math.ceil(allCells.length / 7));
  const weekdayFormatter = new Intl.DateTimeFormat(resolveLocale(i18n), {
    weekday: "short",
    timeZone: "UTC",
  });

  return (
    <Card data-calendar-drag-root className="monline-calendar-month overflow-hidden">
      <div className="monline-calendar-month-header flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start sm:gap-3">
          <CalendarMonthPicker month={month} year={year} onSelect={onSelectMonth} />
          <div className="flex items-center gap-1 text-sm font-medium text-foreground sm:text-base">
            <button
              type="button"
              data-calendar-navigate="prev"
              aria-label={t("prev_month")}
              onClick={onPrev}
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="whitespace-nowrap tabular-nums">
              {t(MONTH_KEYS[month - 1]).slice(0, 3)} 1 - {daysInMonth}, {year}
            </span>
            <button
              type="button"
              data-calendar-navigate="next"
              aria-label={t("next_month")}
              onClick={onNext}
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
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
          entries={Object.values(entriesByDate ?? entriesByDay).flat()}
          onMoveToMonth={onMoveToMonth}
          movingPayment={movingPayment}
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
              const entries =
                entriesByDate?.[toDateStr(cellDate)] ??
                (isOtherMonth ? [] : (entriesByDay[cell.day] ?? []));
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
                    if (drag.suppressClick()) return;
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
                    "group relative flex min-w-0 min-h-[88px] flex-col items-stretch border-b border-r p-1 text-left transition-all duration-150 outline-none sm:min-h-[120px] sm:p-2",
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
                        "inline-flex h-7 w-7 items-center justify-center text-sm font-medium transition-colors group-focus-visible:underline decoration-primary decoration-2 underline-offset-4",
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
                      {entries.map((entry) => {
                        const { sub, date, amount, spending } = entry;
                        const credit = isCredit(sub);
                        const canMove = !!onMovePayment && !movingPayment && !credit;
                        const dateStr = toDateStr(date);
                        const paymentRecord = !credit
                          ? getPaymentRecord(recordsByOwner.get(sub.id) ?? [], sub.id, dateStr)
                          : undefined;
                        const appearance = paymentAppearance(entry, paymentRecord);
                        const isPaid = appearance.paid;
                        const isAwaitingConfirmation =
                          (!spending || spending.status === "planned") &&
                          !credit &&
                          !isPaid &&
                          date <= new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const colorClass = credit ? PAYMENT_COLORS.upcoming : appearance.className;

                        return (
                          <div
                            key={`${sub.id}-${dateStr}`}
                            {...drag.paymentProps(entry, canMove)}
                            data-calendar-payment={sub.id}
                            aria-description={canMove ? t("calendar_drag_hint") : undefined}
                            title={`${sub.name} · ${formatPrice(amount ?? sub.price, (sub.expand?.currency ?? currencyById.get(sub.currency))?.symbol || "", { currencyCode: (sub.expand?.currency ?? currencyById.get(sub.currency))?.code })}${spending ? ` · ${t(`spending_kind_${spending.kind}`)}` : ""}${credit ? "" : ` · ${t(appearance.labelKey)}`}`}
                            className={cn(
                              "relative flex min-w-0 items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 transition-all sm:justify-start sm:gap-1.5 sm:px-1.5 sm:py-0.5",
                              colorClass,
                              canMove && "cursor-grab active:cursor-grabbing",
                            )}
                          >
                            {canMove && (
                              <GripVertical
                                aria-hidden="true"
                                className="h-3 w-3 shrink-0 text-muted-foreground"
                              />
                            )}
                            <SubscriptionLogo
                              sub={sub}
                              month={spending ? spending.date.slice(0, 7) : dateStr.slice(0, 7)}
                              rowId={spending?.provider_row_id}
                              className="h-4 w-4 shrink-0 rounded-sm object-contain text-[9px]"
                            />

                            <span className="calendar-payment-name sr-only">{sub.name}</span>

                            {!credit && (isPaid || isAwaitingConfirmation) ? (
                              <span
                                className="absolute right-0.5 top-0.5 shrink-0 rounded-full bg-background ring-1 ring-background sm:static sm:bg-transparent sm:ring-0"
                                title={t(isPaid ? "paid" : "payment_confirmation_pending")}
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
                                <span className="sr-only">
                                  {t(isPaid ? "paid" : "payment_confirmation_pending")}
                                </span>
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
      <CalendarPaymentLegend />
      {drag.preview}
    </Card>
  );
}
