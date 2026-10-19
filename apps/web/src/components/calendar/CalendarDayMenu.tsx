import { CalendarDays, History } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { historicalDateRange } from "./HistoricalPaymentDialog";
import { toDateStr } from "./types";

interface DayMenuPosition {
  date: Date;
  x: number;
  y: number;
}

export function CalendarDayMenu({
  children,
  onSelectDate,
  onAddHistorical,
  now,
}: {
  children: ReactNode;
  onSelectDate: (date: Date) => void;
  onAddHistorical?: (date: Date) => void;
  now: Date;
}) {
  const { t, i18n } = useTranslation();
  const [position, setPosition] = useState<DayMenuPosition | null>(null);
  const target = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(true);
  const range = historicalDateRange(now);
  const date = position ? toDateStr(position.date) : "";
  const inRange = date >= range.min && date <= range.max;
  const canAdd = !!onAddHistorical && inRange;

  function open(element: HTMLElement, x: number, y: number) {
    const day = element.closest<HTMLButtonElement>("button[data-calendar-date]");
    if (!day || day.disabled) return false;
    target.current = day;
    restoreFocus.current = true;
    setPosition({ date: new Date(`${day.dataset.calendarDate}T12:00:00`), x, y });
    return true;
  }

  return (
    <DropdownMenu
      modal={false}
      open={!!position}
      onOpenChange={(isOpen) => {
        if (!isOpen) setPosition(null);
      }}
    >
      <div
        className="monline-calendar-days monline-scroll"
        onContextMenu={(event) => {
          if (open(event.target as HTMLElement, event.clientX, event.clientY))
            event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
          const element = event.target as HTMLElement;
          const rect = element.getBoundingClientRect();
          if (open(element, rect.left, rect.bottom)) event.preventDefault();
        }}
      >
        {children}
      </div>
      {createPortal(
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none fixed h-px w-px"
            style={{ left: position?.x ?? 0, top: position?.y ?? 0 }}
          />
        </DropdownMenuTrigger>,
        document.body,
      )}
      <DropdownMenuContent
        align="start"
        sideOffset={2}
        collisionPadding={12}
        className="w-64 rounded-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (restoreFocus.current) target.current?.focus();
        }}
      >
        <DropdownMenuLabel className="text-xs capitalize text-muted-foreground">
          {position?.date.toLocaleDateString(
            (i18n?.resolvedLanguage ?? i18n?.language ?? "en").replace("_", "-"),
            { day: "numeric", month: "long", year: "numeric" },
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            if (position) {
              restoreFocus.current = false;
              onSelectDate(position.date);
            }
          }}
        >
          <CalendarDays />
          {t("calendar_day_payments")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canAdd}
          onSelect={() => {
            if (!canAdd || !position) return;
            restoreFocus.current = false;
            onAddHistorical?.(position.date);
          }}
        >
          <History />
          {t("historical_add")}
        </DropdownMenuItem>
        {!inRange && (
          <p className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
            {t("calendar_history_range_hint")}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
