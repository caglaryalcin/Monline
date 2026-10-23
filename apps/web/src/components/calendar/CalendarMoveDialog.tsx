import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { isValidISODate } from "@/lib/dateInput";

import { type DayEntry, parseLocalDate, toDateStr } from "./types";

export function CalendarMoveDialog({
  entry,
  moving,
  onClose,
  onMove,
}: {
  entry: DayEntry;
  moving: boolean;
  onClose: () => void;
  onMove: (date: Date) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const date = isValidISODate(value) ? parseLocalDate(value) : null;
  const canMove = !!date && toDateStr(date).slice(0, 7) !== toDateStr(entry.date).slice(0, 7);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !moving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("calendar_move_to_month")}</DialogTitle>
          <DialogDescription>
            {entry.sub.name} · {toDateStr(entry.date).split("-").reverse().join(".")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (date && canMove && !moving) onMove(date);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="calendar-other-month-date">{t("calendar_move_date")}</Label>
            <DatePicker
              id="calendar-other-month-date"
              label={t("calendar_move_date")}
              value={value}
              onChange={setValue}
              disabled={moving}
              required
            />
            <p className="text-sm text-muted-foreground">{t("calendar_move_month_hint")}</p>
            <p className="text-xs text-muted-foreground">{t("calendar_move_help")}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={moving} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!canMove || moving}>
              {t(moving ? "saving" : "calendar_move_payment")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
