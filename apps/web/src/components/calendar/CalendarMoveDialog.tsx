import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { resolveLocale } from "@/lib/locale";
import { cn, formatCurrency } from "@/lib/utils";

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
  onMove: (date: Date, mode?: "ledger") => void;
}) {
  const { t, i18n } = useTranslation();
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"calendar" | "ledger">("calendar");
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const source = entry.spending;
  const canUpdateLedger = source?.source === "ledger";
  const updateLedger = canUpdateLedger && mode === "ledger";
  const date = isValidISODate(value) ? parseLocalDate(value) : null;
  const canMove = !!date && toDateStr(date).slice(0, 7) !== toDateStr(entry.date).slice(0, 7);
  const locale = resolveLocale(i18n, "tr");
  const formatDate = (date: Date) =>
    date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  return (
    <Dialog
      open
      onOpenChange={dialogDismissHandler(onClose, moving)}
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
            if (date && canMove && !moving) {
              if (updateLedger) onMove(date, "ledger");
              else if (canUpdateLedger) setPendingDate(date);
              else onMove(date);
            }
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
            {canUpdateLedger && (
              <fieldset className="space-y-2 rounded-xl border p-3" disabled={moving}>
                <legend className="px-1 text-sm font-medium">{t("calendar_move_scope")}</legend>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="calendar-move-scope"
                    value="calendar"
                    checked={!updateLedger}
                    onChange={() => setMode("calendar")}
                    className="mt-0.5 accent-primary"
                  />
                  {t("calendar_move_calendar_only")}
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="calendar-move-scope"
                    value="ledger"
                    checked={updateLedger}
                    onChange={() => setMode("ledger")}
                    className="mt-0.5 accent-primary"
                  />
                  {t("calendar_move_with_ledger")}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t("calendar_ledger_source_date", {
                    date: formatDate(parseLocalDate(source.date)!),
                  })}
                </p>
              </fieldset>
            )}
            <p className="text-xs text-muted-foreground">
              {t(
                updateLedger
                  ? "calendar_ledger_move_help"
                  : entry.spending
                    ? "calendar_source_move_help"
                    : "calendar_move_help",
              )}
            </p>
            {date && canMove && (
              <div
                role="status"
                className={cn(
                  "rounded-xl border border-l-4 p-3 text-sm font-medium leading-relaxed",
                  updateLedger
                    ? "border-orange-300 border-l-orange-500 bg-orange-50 text-orange-900 dark:border-orange-500/40 dark:border-l-orange-400 dark:bg-orange-500/10 dark:text-orange-200"
                    : "border-red-300 border-l-red-500 bg-red-50 text-red-900 dark:border-red-500/40 dark:border-l-red-400 dark:bg-red-500/10 dark:text-red-200",
                )}
                aria-live="polite"
              >
                {updateLedger
                  ? t("calendar_ledger_move_summary", {
                      from: formatDate(parseLocalDate(source.date)!),
                      to: formatDate(date),
                      amount: formatCurrency(source.amount, source.currency, { locale: locale }),
                    })
                  : t("calendar_only_move_summary", {
                      from: formatDate(entry.date),
                      to: formatDate(date),
                    })}
                {updateLedger && source.verification && (
                  <p className="mt-2 text-xs">{t("calendar_ledger_verification_hint")}</p>
                )}
              </div>
            )}
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
      <AlertDialog
        open={!!pendingDate}
        onOpenChange={dialogDismissHandler(() => setPendingDate(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700 dark:text-red-300">
              {t("calendar_only_confirm_title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="rounded-xl border border-red-300 bg-red-50 p-3 leading-relaxed text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {pendingDate &&
                source &&
                t("calendar_only_confirm_description", {
                  from: formatDate(entry.date),
                  to: formatDate(pendingDate),
                  sourceDate: formatDate(parseLocalDate(source.date)!),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={moving}
              onClick={() => {
                if (!pendingDate || moving) return;
                const confirmedDate = pendingDate;
                setPendingDate(null);
                onMove(confirmedDate);
              }}
            >
              {t("calendar_only_confirm_action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
