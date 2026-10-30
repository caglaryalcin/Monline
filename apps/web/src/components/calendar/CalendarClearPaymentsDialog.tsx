import { CalendarClock, Loader2, ShieldCheck, Trash2 } from "lucide-react";
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

export function CalendarClearPaymentsDialog({ open, payments, busy, onOpenChange, onConfirm }: {
  open: boolean;
  payments: number;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return <AlertDialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
    <AlertDialogContent className="rounded-3xl border-border/50 shadow-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-xl font-bold">{t("calendar_clear_title")}</AlertDialogTitle>
        <AlertDialogDescription>{t("calendar_clear_intro")}</AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-3 text-sm">
        <section className="space-y-2 rounded-xl border border-destructive/30 p-3">
          <h3 className="flex items-center gap-2 font-semibold text-destructive">
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />{t("calendar_clear_deleted_title")}
          </h3>
          <p>{t("calendar_clear_deleted_help", { payments })}</p>
        </section>
        <section className="space-y-2 rounded-xl border p-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />{t("calendar_clear_hidden_title")}
          </h3>
          <p>{t("calendar_clear_hidden_help")}</p>
        </section>
        <section className="space-y-2 rounded-xl border border-emerald-500/25 p-3">
          <h3 className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />{t("calendar_clear_kept_title")}
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("calendar_clear_kept_subscriptions")}</li>
            <li>{t("calendar_clear_kept_finance")}</li>
            <li>{t("calendar_clear_kept_statements")}</li>
          </ul>
        </section>
        <p className="font-medium text-destructive">{t("calendar_clear_irreversible")}</p>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel className="rounded-xl" disabled={busy}>{t("cancel")}</AlertDialogCancel>
        <AlertDialogAction
          className="gap-2 rounded-xl bg-destructive text-destructive-foreground"
          disabled={busy}
          onClick={(event) => {
            event.preventDefault();
            if (!busy) onConfirm();
          }}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("calendar_clear_action")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
