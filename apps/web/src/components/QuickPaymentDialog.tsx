import { useTranslation } from "react-i18next";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { QuickPaymentTarget } from "@/lib/quickPayment";
import { formatDate, formatPrice } from "@/lib/utils";

export function QuickPaymentDialog({ target, pending, onClose, onConfirm }: {
  target: QuickPaymentTarget | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  if (!target) return null;
  const currency = target.currencyInfo;
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("quick_payment_title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("quick_payment_confirm", {
              name: target.subscription.name,
              date: formatDate(target.date),
              amount: formatPrice(target.amount, currency?.id === target.currency ? currency.symbol : "", {
                currencyCode: currency?.id === target.currency ? currency.code : undefined,
              }),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); onConfirm(); }}>
            {t(pending ? "saving" : "mark_as_paid")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
