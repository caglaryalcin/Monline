import { CalendarDays } from "lucide-react";
import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { validStatementDate } from "@/lib/statements";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-describedby"?: string;
  title?: string;
}

/** Statement dates always use day/month/year, independent of the browser locale. */
export function StatementDateInput({ value, onChange, disabled, className, ...props }: Props) {
  const { t, i18n } = useTranslation();
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const valid = validStatementDate(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const display = iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value;
  const fullDate = valid
    ? new Intl.DateTimeFormat((i18n.resolvedLanguage ?? i18n.language ?? "en").replace("_", "-"), {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "";

  function edit(raw: string) {
    // Accept a pasted ISO date as well as Turkish PDF day/month/year dates.
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      onChange(raw);
      return;
    }
    const date = /^(\d{2})[./-]?(\d{2})[./-]?(\d{4})$/.exec(raw);
    // Keep unfinished edits intact. They fail the page's date validation until
    // complete, so an unfinished day/month edit cannot silently move a payment.
    onChange(date ? `${date[3]}-${date[2]}-${date[1]}` : raw);
  }

  return (
    <div className="w-44 space-y-1">
      <div className="relative">
        <Input
          ref={textRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t("statement_date_format")}
          maxLength={10}
          value={display}
          disabled={disabled}
          aria-label={t("statement_date")}
          aria-describedby={[hintId, props["aria-describedby"]].filter(Boolean).join(" ")}
          aria-invalid={!!value && !valid}
          title={props.title}
          className={cn("pr-10 tabular-nums", className)}
          onChange={(event) => edit(event.target.value)}
        />
        <input
          ref={pickerRef}
          type="date"
          value={valid ? value : ""}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={t("statement_choose_date")}
          title={t("statement_choose_date")}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted-foreground focus-visible:outline focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
          onClick={() => {
            try {
              if (pickerRef.current?.showPicker) pickerRef.current.showPicker();
              else textRef.current?.focus();
            } catch {
              textRef.current?.focus();
            }
          }}
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        {fullDate || t("statement_date_format")}
      </p>
    </div>
  );
}
