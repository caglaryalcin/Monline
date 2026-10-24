import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { MONTH_KEYS } from "@/components/calendar/constants";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CalendarMonthPickerProps {
  month: number;
  year: number;
  onSelect: (month: number, year: number) => void;
}

export function CalendarMonthPicker({ month, year, onSelect }: CalendarMonthPickerProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const selectedButton = useRef<HTMLButtonElement>(null);
  const language = (i18n.resolvedLanguage ?? i18n.language ?? "en").replace("_", "-");
  const shortMonth = (index: number) =>
    new Intl.DateTimeFormat(language, { month: "short" })
      .format(new Date(pickerYear, index, 1))
      .replace(/\.$/, "");

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setPickerYear(year);
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t("calendar_choose_month")}: ${t(MONTH_KEYS[month - 1])} ${year}`}
          title={t("calendar_choose_month")}
          className="flex min-w-[52px] flex-col items-center rounded-lg bg-primary/10 px-2.5 py-1 text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="text-[10px] font-bold uppercase leading-tight">
            {shortMonth(month - 1)}
          </span>
          <span className="text-lg font-bold leading-tight">{year}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(20rem,calc(100vw-2rem))] p-3"
        aria-label={t("calendar_choose_month")}
        onOpenAutoFocus={(event) => {
          if (selectedButton.current) {
            event.preventDefault();
            selectedButton.current.focus();
          }
        }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t("calendar_previous_year")}
            onClick={() => setPickerYear((current) => current - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums" aria-live="polite">
            {pickerYear}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t("calendar_next_year")}
            onClick={() => setPickerYear((current) => current + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-x-2 gap-y-3">
          {MONTH_KEYS.map((key, index) => {
            const selected = pickerYear === year && index + 1 === month;
            return (
              <button
                key={key}
                ref={selected ? selectedButton : undefined}
                type="button"
                aria-label={`${t(key)} ${pickerYear}`}
                aria-pressed={selected}
                onClick={() => {
                  onSelect(index + 1, pickerYear);
                  setOpen(false);
                }}
                className={cn(
                  "mx-auto flex h-14 w-14 items-center justify-center rounded-full text-sm capitalize transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
                  selected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-popover-foreground",
                )}
              >
                {shortMonth(index)}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
