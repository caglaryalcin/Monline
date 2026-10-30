import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CalendarMonthPicker } from "@/components/calendar/CalendarMonthPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentSpendingMonth } from "@/lib/spending";

export function SpendingMonthPicker({
  month,
  onChange,
  recordedMonths,
  calendarPicker = false,
}: {
  month: string;
  onChange: (month: string) => void;
  recordedMonths: string[];
  calendarPicker?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const shift = (delta: number) => {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    onChange(date.toISOString().slice(0, 7));
  };
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
        <Button size="sm" variant="outline" onClick={() => onChange(currentSpendingMonth())}>
          {t("spending_this_month")}
        </Button>
        {recordedMonths.length > 0 && (
          <select
            aria-label={t("spending_recorded_months")}
            className="h-9 max-w-full rounded-md border bg-background px-2 text-sm"
            value=""
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value);
            }}
          >
            <option value="">{t("spending_recorded_months")}</option>
            {recordedMonths.map((value) => (
              <option key={value} value={value}>
                {new Intl.DateTimeFormat(i18n.language.replace("_", "-"), {
                  year: "numeric",
                  month: "long",
                  timeZone: "UTC",
                }).format(new Date(`${value}-01T12:00:00Z`))}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
