import { format, isValid, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { forwardRef, useState } from "react";
import { DayPicker, type DropdownProps } from "react-day-picker";
import {
  cs,
  da,
  de,
  enUS,
  es,
  fr,
  it,
  ja,
  ko,
  nl,
  pl,
  ptBR,
  ru,
  tr,
  uk,
  zhCN,
} from "react-day-picker/locale";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemedSelect } from "@/components/ui/themed-select";
import { cn } from "@/lib/utils";

const locales = {
  en: enUS,
  tr,
  de,
  pt: ptBR,
  es,
  fr,
  it,
  nl,
  pl,
  ru,
  zh: zhCN,
  ja,
  ko,
  uk,
  cs,
  da,
};
const clearLabels: Record<string, string> = {
  en: "Clear",
  tr: "Temizle",
  de: "Leeren",
  pt: "Limpar",
  es: "Borrar",
  fr: "Effacer",
  it: "Cancella",
  nl: "Wissen",
  pl: "Wyczyść",
  ru: "Очистить",
  zh: "清除",
  ja: "クリア",
  ko: "지우기",
  uk: "Очистити",
  cs: "Vymazat",
  da: "Ryd",
};

function CalendarDropdown({
  options,
  value,
  onChange,
  disabled,
  "aria-label": label,
}: DropdownProps) {
  return (
    <ThemedSelect
      aria-label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="h-8 min-w-0 rounded-md px-1 text-xs"
    >
      {options?.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </ThemedSelect>
  );
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  label: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Stores a local ISO date; calendar language follows the application, not the browser. */
export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  { value, onChange, onBlur, label, name, id, disabled, ...props },
  ref,
) {
  const { t, i18n } = useTranslation();
  const language = (i18n?.resolvedLanguage ?? i18n?.language ?? "en").split(/[-_]/)[0];
  const locale = locales[language as keyof typeof locales] ?? enUS;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;
  const [open, setOpen] = useState(false);
  const select = (date: Date | undefined) => {
    onChange(date ? format(date, "yyyy-MM-dd") : "");
    onBlur?.();
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
    >
      <input type="hidden" name={name} value={value} />
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          ref={ref}
          disabled={disabled}
          onBlur={onBlur}
          aria-label={`${label}: ${selected ? format(selected, "dd/MM/yyyy") : "—"}`}
          {...props}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            "aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive/5 aria-[invalid=true]:focus-visible:ring-destructive",
          )}
        >
          <span>{selected ? format(selected, "dd/MM/yyyy") : "—"}</span>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(20rem,calc(100vw-2rem))] p-0 shadow-none"
        aria-label={label}
      >
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={select}
          defaultMonth={selected}
          locale={locale}
          autoFocus
          showOutsideDays
          captionLayout="dropdown"
          startMonth={new Date(1900, 0)}
          endMonth={new Date(new Date().getFullYear() + 100, 11)}
          components={{ Dropdown: CalendarDropdown }}
          classNames={{
            root: "relative p-3",
            months: "w-full",
            month: "space-y-2",
            month_caption: "mx-9 flex h-8 items-center justify-center",
            dropdowns: "flex min-w-0 items-center gap-1",
            nav: "absolute inset-x-3 top-3 flex justify-between pointer-events-none",
            button_previous:
              "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border focus-visible:outline focus-visible:outline-ring disabled:opacity-30",
            button_next:
              "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border focus-visible:outline focus-visible:outline-ring disabled:opacity-30",
            chevron: "h-4 w-4 fill-current",
            month_grid: "w-full table-fixed border-collapse",
            weekday: "h-8 text-center text-xs font-normal text-muted-foreground",
            day: "p-0.5 text-center",
            day_button:
              "flex h-9 w-full items-center justify-center rounded-lg border border-transparent text-sm focus-visible:outline focus-visible:outline-ring",
            selected:
              "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-semibold",
            today: "[&>button]:border-primary [&>button]:font-semibold",
            outside: "opacity-35",
            disabled: "opacity-30",
            hidden: "invisible",
          }}
        />
        <div className="flex justify-between border-t p-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => select(undefined)}>
            {clearLabels[language] ?? clearLabels.en}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => select(new Date())}>
            {t("today")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
});
