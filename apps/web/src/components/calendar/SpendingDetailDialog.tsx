import { useState } from "react";
import { useTranslation } from "react-i18next";

import { StatementLink } from "@/components/StatementLink";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { ManualBillActions } from "@/components/subscriptions/ManualBillActions";
import { MerchantProviderDialog } from "@/components/subscriptions/MerchantProviderDialog";
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
import { useMerchantLogo } from "@/contexts/MerchantLogosContext";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { findLogoService } from "@/lib/logoServices";
import { isBillRecord, type SpendingEvent } from "@/lib/spending";
import { formatCurrency } from "@/lib/utils";

export function SpendingDetailDialog({
  event,
  onClose,
  calendarDate,
  onMoveDate,
  movingPayment,
}: {
  event: SpendingEvent;
  onClose: () => void;
  calendarDate?: string;
  onMoveDate?: (date: string) => void;
  movingPayment?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [providerOpen, setProviderOpen] = useState(false);
  const [moveDate, setMoveDate] = useState(calendarDate || event.date);
  const choice = useMerchantLogo(event.name, { month: event.date.slice(0, 7), rowId: event.provider_row_id });
  return (
    <Dialog
      open
      onOpenChange={dialogDismissHandler(onClose)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span aria-hidden="true">
              <SubscriptionLogo
                sub={{ name: event.name, url: "" }}
                month={event.date.slice(0, 7)} rowId={event.provider_row_id}
                className="h-9 w-9 object-contain"
              />
            </span>
            {event.name}
          </DialogTitle>
          <DialogDescription>
            {t(`spending_source_${event.source}`)} · {t(`spending_kind_${event.kind}`)}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-muted-foreground">{t("statement_date")}</dt>
          <dd className="text-right">{event.date.split("-").reverse().join(".")}</dd>
          {calendarDate && calendarDate !== event.date && (
            <>
              <dt className="text-muted-foreground">{t("calendar_display_date")}</dt>
              <dd className="text-right">{calendarDate.split("-").reverse().join(".")}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t("statement_amount")}</dt>
          <dd className="text-right font-semibold tabular-nums">
            {formatCurrency(event.amount, event.currency, { locale: i18n.language.replace("_", "-") })}
          </dd>
          {event.card_name && (
            <>
              <dt className="text-muted-foreground">{t("finance_credit_card")}</dt>
              <dd className="text-right">{event.card_name}</dd>
            </>
          )}
          {event.statement_period && (
            <>
              <dt className="text-muted-foreground">{t("statement_period")}</dt>
              <dd className="text-right">{event.statement_period}</dd>
            </>
          )}
          {event.installment && (
            <>
              <dt className="text-muted-foreground">{t("statement_installment")}</dt>
              <dd className="text-right">{event.installment}</dd>
            </>
          )}
        </dl>
        {onMoveDate && calendarDate && (
          <form
            className="space-y-2 rounded-xl border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!movingPayment && moveDate && moveDate !== calendarDate) onMoveDate(moveDate);
            }}
          >
            <Label htmlFor="calendar-source-move-date">{t("calendar_move_date")}</Label>
            <DatePicker
              id="calendar-source-move-date"
              label={t("calendar_move_date")}
              value={moveDate}
              onChange={setMoveDate}
              required
              disabled={movingPayment}
            />
            <p className="text-xs text-muted-foreground">{t("calendar_source_move_help")}</p>
            <Button
              type="submit"
              variant="outline"
              disabled={movingPayment || !moveDate || moveDate === calendarDate}
            >
              {t(movingPayment ? "saving" : "calendar_move_payment")}
            </Button>
          </form>
        )}
        {event.notes && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{event.notes}</p>
        )}
        {event.manual_bill_id && <ManualBillActions bill={event} onChanged={onClose} />}
        <Button variant="outline" onClick={() => setProviderOpen(true)}>
          {t(
            choice || findLogoService(event.name)
              ? "spending_provider_change"
              : "spending_provider_choose",
          )}
        </Button>
        {event.statement_id ? (
          <StatementLink
            statementId={event.statement_id}
            className="text-sm text-primary underline underline-offset-4"
          >
            {t("finance_go_statement")}
          </StatementLink>
        ) : (
          <div className="space-y-2">
            {event.kind === "card_payment" && (
              <p className="text-sm text-muted-foreground">{t("spending_statement_missing")}</p>
            )}
            <a
              href={event.manual_bill_id ? "/subscriptions" : "/finance"}
              className="text-sm text-primary underline underline-offset-4"
            >
              {t(event.manual_bill_id ? "subscriptions" : "finance")}
            </a>
          </div>
        )}
        {providerOpen && (
          <MerchantProviderDialog name={event.name} month={isBillRecord(event) ? event.date.slice(0, 7) : undefined}
            rowId={event.provider_row_id} onClose={() => setProviderOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
