import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { resolveLocale } from "@/lib/locale";
import type { CalendarMoveScope } from "@/services/paymentRecords";

export function CalendarMoveRange({
  value,
  onChange,
  sourceDate,
  disabled,
}: {
  value: CalendarMoveScope;
  onChange: (scope: CalendarMoveScope) => void;
  sourceDate: string;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const month = new Intl.DateTimeFormat(resolveLocale(i18n), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${sourceDate.slice(0, 7)}-01T12:00:00Z`));
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("calendar_move_periods")}</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as CalendarMoveScope)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        {(["single", "future", "past", "all"] as const).map((scope) => (
          <option key={scope} value={scope}>
            {t(`calendar_move_periods_${scope}`, { month })}
          </option>
        ))}
      </select>
      {value !== "single" && (
        <p className="text-xs text-muted-foreground">{t("calendar_move_periods_help")}</p>
      )}
    </div>
  );
}
