import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CalendarMonthPicker } from "@/components/calendar/CalendarMonthPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentSpendingMonth } from "@/lib/spending";

export function SpendingMonthPicker({
  month,
  onChange,
  recordedMonths,
  calendarPicker = false,
  monthsLabel,
  year,
  onYearChange,
  selectedMonth,
  onMonthChange,
  allowAllMonths = true,
}: {
  month: string;
  onChange: (month: string) => void;
  recordedMonths: string[];
  calendarPicker?: boolean;
  monthsLabel?: string;
  year?: number;
  onYearChange?: (year: number) => void;
  selectedMonth?: number;
  onMonthChange?: (month: number | undefined) => void;
  allowAllMonths?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const currentMonth = currentSpendingMonth();
  const currentYear = Number(currentMonth.slice(0, 4));
  const years = [
    ...new Set([
      currentYear,
      ...(!allowAllMonths && year ? [year] : []),
      ...recordedMonths.map((value) => Number(value.slice(0, 4))),
    ]),
  ]
    .filter((value) => Number.isInteger(value) && value >= 1970 && value <= 2200)
    .sort((a, b) => b - a);
  const monthLabel = (value: string) =>
    new Intl.DateTimeFormat(i18n.language.replace("_", "-"), {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(`${value}-01T12:00:00Z`));
  const shift = (delta: number) => {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    onChange(date.toISOString().slice(0, 7));
  };
  if (onYearChange) {
    const selectedYear = year && years.includes(year) ? year : currentYear;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {onMonthChange && (
          <Select
            value={
              selectedMonth
                ? String(selectedMonth)
                : allowAllMonths
                  ? "all"
                  : String(Number(currentMonth.slice(5)))
            }
            onValueChange={(value) => onMonthChange(value === "all" ? undefined : Number(value))}
          >
            <SelectTrigger
              aria-label={t("spending_month")}
              className="h-10 w-fit min-w-[120px] gap-2 rounded-xl bg-transparent px-3"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowAllMonths && <SelectItem value="all">{t("spending_all_months")}</SelectItem>}
              {Array.from({ length: 12 }, (_, index) => (
                <SelectItem key={index + 1} value={String(index + 1)}>
                  {new Intl.DateTimeFormat(i18n.language.replace("_", "-"), {
                    month: "long",
                    timeZone: "UTC",
                  }).format(
                    new Date(`${selectedYear}-${String(index + 1).padStart(2, "0")}-01T12:00:00Z`),
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={String(selectedYear)} onValueChange={(value) => onYearChange(Number(value))}>
          <SelectTrigger
            aria-label={t("history_select_year")}
            className="h-10 w-fit min-w-[84px] gap-2 rounded-xl bg-transparent px-3"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("spending_previous_month")}
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {calendarPicker ? (
          <CalendarMonthPicker
            year={Number(month.slice(0, 4))}
            month={Number(month.slice(5, 7))}
            onSelect={(selectedMonth, year) =>
              onChange(`${year}-${String(selectedMonth).padStart(2, "0")}`)
            }
          />
        ) : (
          <Input
            aria-label={t("spending_month")}
            type="month"
            className="w-44"
            value={month}
            onChange={(event) => {
              if (/^\d{4}-(?:0[1-9]|1[0-2])$/.test(event.target.value))
                onChange(event.target.value);
            }}
          />
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("spending_next_month")}
          onClick={() => shift(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => onChange(currentMonth)}>
          {t("spending_this_month")}
        </Button>
        {recordedMonths.length > 0 && (
          <select
            aria-label={monthsLabel ?? t("spending_recorded_months")}
            className="h-9 max-w-full rounded-md border bg-background px-2 text-sm"
            value=""
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value);
            }}
          >
            <option value="">{monthsLabel ?? t("spending_recorded_months")}</option>
            {recordedMonths.map((value) => (
              <option key={value} value={value}>
                {monthLabel(value)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
