import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  Pencil,
  Tag,
  Trash2,
  Users,
} from "lucide-react";

import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBillingPeriod } from "@/lib/billingPeriods";
import { categoryLabel } from "@/lib/categoryLabel";
import { isCredit } from "@/lib/recordTypes";
import { daysUntil, formatDate, formatPrice, sanitizeHref } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { paymentRecordsService } from "@/services/paymentRecords";
import type { Currency, PaymentRecord, Subscription } from "@/types";

import { InfoRow } from "./InfoRow";
import { getLogoUrl, toMain } from "./types";

interface SubDetailDialogProps {
  sub: Subscription;
  date: Date;
  currencies: Currency[];
  mainCurrency: Currency | undefined;
  paymentTracking: boolean;
  paymentRecord: PaymentRecord | undefined;
  onClose: () => void;
  onEdit: (s: Subscription) => void;
  onMarkAsPaid: () => void;
  onDeletePayment?: () => void;
  deletingPayment?: boolean;
  t: (k: string) => string;
}

export function SubDetailDialog({
  sub,
  date,
  currencies,
  mainCurrency,
  paymentTracking,
  paymentRecord,
  onClose,
  onEdit,
  onMarkAsPaid,
  onDeletePayment,
  deletingPayment,
  t,
}: SubDetailDialogProps) {
  const cur = sub.expand?.currency ?? currencies.find((c) => c.id === sub.currency);
  const cycle = sub.expand?.cycle;
  const category = sub.expand?.category;
  const paymentMethod = sub.expand?.payment_method;
  const payer = sub.expand?.payer;
  const logo = getLogoUrl(sub);
  const credit = isCredit(sub);

  const cycleLabel = credit
    ? t("one_time")
    : cycle
      ? formatBillingPeriod(t, cycle.name, sub.frequency)
      : "";

  const dLeft = daysUntil(sub.next_payment);
  const isPaid = !!paymentRecord?.paid_at;
  const amount = isPaid ? (paymentRecord.amount ?? sub.price) : sub.price;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = paymentTracking && !isPaid && date < today;

  const proofUrl = paymentRecord ? paymentRecordsService.proofUrl(paymentRecord) : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[96vw] max-w-3xl max-h-[90dvh] overflow-y-auto p-0">
        <DialogHeader className="border-b bg-card/70 backdrop-blur px-4 py-5 pr-10 sm:px-6 sm:pr-10">
          <DialogTitle className="flex flex-wrap items-center gap-3 sm:gap-4">
            {logo ? (
              <div className="h-14 w-14 shrink-0 rounded-2xl overflow-hidden border bg-background p-2">
                <SubscriptionLogo sub={sub} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                {sub.name[0]?.toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1 basis-[calc(100%-5rem)] sm:basis-0">
              <p className="text-xl font-bold leading-tight truncate">{sub.name}</p>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                {sub.standalone_payment_id ? (
                  <Badge variant="secondary" className="text-xs">
                    {t("historical_standalone")}
                  </Badge>
                ) : sub.inactive ? (
                  <Badge variant="secondary" className="text-xs">
                    {t("inactive")}
                  </Badge>
                ) : (
                  <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 text-xs">
                    {t("active")}
                  </Badge>
                )}
                {cycle && (
                  <Badge variant="outline" className="text-xs">
                    {cycleLabel}
                  </Badge>
                )}
                {credit && (
                  <Badge className="bg-green-500/15 text-xs text-green-700 dark:text-green-400">
                    {t("credit_income")}
                  </Badge>
                )}
              </div>
            </div>

            <div className="ml-auto text-right shrink-0">
              <p className="text-2xl font-extrabold leading-none">
                {credit ? "+" : ""}
                {formatPrice(amount, cur?.symbol ?? "$", { currencyCode: cur?.code })}
              </p>
              {cur && mainCurrency && cur.id !== mainCurrency.id && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈{" "}
                  {formatPrice(toMain(amount, cur), mainCurrency.symbol, {
                    currencyCode: mainCurrency.code,
                  })}
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-5 sm:p-6">
          {(paymentTracking || isPaid) && !credit && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3.5",
                isPaid
                  ? "bg-green-500/10 border-green-500/20"
                  : isOverdue
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-muted/50 border-border",
              )}
            >
              {isPaid ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-green-700 dark:text-green-400">{t("paid")}</p>
                    {paymentRecord?.paid_at && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {new Date(paymentRecord.paid_at).toLocaleDateString()}
                        {paymentRecord.amount != null &&
                          ` · ${formatPrice(paymentRecord.amount, cur?.symbol ?? "$", {
                            currencyCode: cur?.code,
                          })}`}
                      </p>
                    )}
                  </div>
                  {proofUrl && (
                    <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Eye className="h-3.5 w-3.5" />
                        {t("proof")}
                      </Button>
                    </a>
                  )}
                </>
              ) : isOverdue ? (
                <>
                  <CircleDot className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="font-semibold text-red-700 dark:text-red-400">
                    {t("overdue")} · {t("not_paid")}
                  </p>
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                  <p className="font-medium text-muted-foreground">{t("pending_payment")}</p>
                </>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-sm font-semibold mb-3">{t("details")}</p>
              <div className="space-y-3">
                <InfoRow
                  icon={<CalendarDays className="h-4 w-4" />}
                  label={t(
                    sub.standalone_payment_id
                      ? "historical_due_date"
                      : credit
                        ? "received_on"
                        : "next_payment",
                  )}
                >
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span>{formatDate(sub.next_payment)}</span>
                    {dLeft === 0 && (
                      <Badge className="text-[10px] bg-amber-500 text-white">{t("today")}</Badge>
                    )}
                    {dLeft > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {dLeft} {t("days_short")}
                      </Badge>
                    )}
                    {dLeft < 0 && !credit && !sub.standalone_payment_id && (
                      <Badge variant="destructive" className="text-[10px]">
                        {t("overdue")}
                      </Badge>
                    )}
                  </span>
                </InfoRow>

                {category && (
                  <InfoRow icon={<Tag className="h-4 w-4" />} label={t("category")}>
                    {categoryLabel(category, t)}
                  </InfoRow>
                )}

                {paymentMethod && (
                  <InfoRow icon={<CreditCard className="h-4 w-4" />} label={t("payment_method")}>
                    {paymentMethod.name}
                  </InfoRow>
                )}

                {payer && (
                  <InfoRow icon={<Users className="h-4 w-4" />} label={t("payer")}>
                    {payer.name}
                  </InfoRow>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-4">
              <p className="text-sm font-semibold mb-3">{t("more_info")}</p>
              <div className="space-y-3">
                {sub.start_date && (
                  <InfoRow icon={<Clock className="h-4 w-4" />} label={t("start_date")}>
                    {formatDate(sub.start_date)}
                  </InfoRow>
                )}

                {sub.url &&
                  (() => {
                    const safeUrl = sanitizeHref(sub.url);
                    return (
                      <InfoRow icon={<ExternalLink className="h-4 w-4" />} label={t("url")}>
                        {safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline-offset-2"
                          >
                            {safeUrl.replace(/^https?:\/\//, "").split("/")[0]}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {sub.url.split("/")[0]}
                          </span>
                        )}
                      </InfoRow>
                    );
                  })()}

                {!credit && (
                  <InfoRow icon={<Banknote className="h-4 w-4" />} label={t("auto_renew")}>
                    {sub.auto_renew ? t("yes") : t("no")}
                  </InfoRow>
                )}
              </div>
            </div>
          </div>

          {sub.notes && (
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm font-semibold mb-2">{t("notes")}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {sub.notes}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end flex-wrap border-t pt-4">
            {!credit && paymentRecord && onDeletePayment && (
              <Button variant="destructive" disabled={deletingPayment} onClick={onDeletePayment}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t("calendar_delete_payment")}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              {t("close")}
            </Button>
            {paymentTracking && !credit && !isPaid && (
              <Button
                variant="outline"
                className="border-green-500/40 text-green-700 dark:text-green-400"
                onClick={onMarkAsPaid}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t("mark_as_paid")}
              </Button>
            )}
            {!credit && isPaid && (
              <Button variant="ghost" className="text-muted-foreground" onClick={onMarkAsPaid}>
                <FileText className="h-4 w-4 mr-2" />
                {t("view_payment")}
              </Button>
            )}
            {!sub.standalone_payment_id && (
              <Button onClick={() => onEdit(sub)}>
                <Pencil className="h-4 w-4 mr-2" />
                {t("edit")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
