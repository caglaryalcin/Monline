import "./payment-colors.css";

import { CircleDot, Info, X } from "lucide-react";

import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBillingPeriod } from "@/lib/billingPeriods";
import { categoryLabel } from "@/lib/categoryLabel";
import { isCredit } from "@/lib/recordTypes";
import { cn, formatDate, formatPrice } from "@/lib/utils";
import type { Currency, PaymentRecord } from "@/types";

import { paymentAppearance } from "./paymentAppearance";
import { type DayEntry, getPaymentRecord, PAYMENT_COLORS, toDateStr, toMain } from "./types";

interface DayPanelProps {
  day: number;
  month: number;
  year: number;
  entries: DayEntry[];
  total: number;
  mainCurrency: Currency | undefined;
  currencies: Currency[];
  now: Date;
  t: (k: string) => string;
  paymentTracking: boolean;
  paymentRecords: PaymentRecord[];
  onSelectEntry: (entry: DayEntry) => void;
  onClose: () => void;
}

export function DayPanel({
  day,
  month,
  year,
  entries,
  total,
  mainCurrency,
  currencies,
  now,
  t,
  paymentRecords,
  onSelectEntry,
  onClose,
}: DayPanelProps) {
  const dateLabel = formatDate(toDateStr(new Date(year, month - 1, day)));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisDay = new Date(year, month - 1, day);
  const isToday = thisDay.getTime() === today.getTime();

  return (
    <Card className="animate-in slide-in-from-top-2 duration-200">
      <CardContent className="p-0">
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-semibold">
              {dateLabel}
              {isToday && (
                <Badge className="ml-2 bg-primary text-primary-foreground text-[10px]">
                  {t("today")}
                </Badge>
              )}
            </p>
            {entries.length > 0 && mainCurrency ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {entries.length}{" "}
                {entries.some((entry) => entry.spending)
                  ? t("spending_entries")
                  : entries.length === 1
                    ? t("subscription")
                    : t("subscriptions")}{" "}
                ·{" "}
                <span className="font-medium text-foreground">
                  {formatPrice(total, mainCurrency.symbol, {
                    currencyCode: mainCurrency.code,
                  })}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">{t("no_subscriptions_due")}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Subscription list */}
        {entries.length > 0 && (
          <div className="divide-y">
            {entries.map((entry) => {
              const { sub, date, amount, spending } = entry;
              const credit = isCredit(sub);
              const cur = sub.expand?.currency ?? currencies.find((c) => c.id === sub.currency);
              const cycle = sub.expand?.cycle;
              const category = sub.expand?.category;
              const diffDays = Math.ceil((thisDay.getTime() - today.getTime()) / 86400000);
              const dateStr = toDateStr(date);
              const rec = !credit ? getPaymentRecord(paymentRecords, sub.id, dateStr) : undefined;
              const appearance = paymentAppearance(entry, rec);
              const isPaid = appearance.paid;
              const isAwaitingConfirmation =
                (!spending || spending.status === "planned") &&
                !credit &&
                !isPaid &&
                thisDay <= today;
              const colorClass = credit ? PAYMENT_COLORS.upcoming : appearance.className;

              return (
                <button
                  key={sub.id}
                  type="button"
                  title={credit ? undefined : t(appearance.labelKey)}
                  onClick={() => onSelectEntry(entry)}
                  className={cn(
                    "group flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left transition-colors sm:gap-4",
                    colorClass,
                  )}
                >
                  {/* Logo */}
                  <div className="h-11 w-11 shrink-0 rounded-xl overflow-hidden border bg-background p-1.5 relative">
                    <SubscriptionLogo sub={sub} month={spending ? spending.date.slice(0, 7) : dateStr.slice(0, 7)}
                      rowId={spending?.provider_row_id} className="h-full w-full object-contain" />
                    {isAwaitingConfirmation && (
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-red-500 p-0.5 ring-2 ring-background">
                        <CircleDot className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{sub.name}</p>
                    {spending && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(`spending_source_${spending.source}`)} ·{" "}
                        {t(`spending_kind_${spending.kind}`)}
                        {spending.card_name ? ` · ${spending.card_name}` : ""}
                        {spending.installment ? ` · ${spending.installment}` : ""}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {category && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 rounded-full">
                          {categoryLabel(category, t)}
                        </Badge>
                      )}
                      {credit && (
                        <Badge className="h-4 rounded-full bg-green-500/15 px-1.5 text-[10px] text-green-700 dark:text-green-400">
                          {t("credit_income")}
                        </Badge>
                      )}
                      {cycle && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatBillingPeriod(t, cycle.name, sub.frequency)}
                        </span>
                      )}
                      {isPaid && (
                        <Badge className="text-[10px] h-4 px-1.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400">
                          {t("paid")}
                        </Badge>
                      )}
                      {isAwaitingConfirmation && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1.5 rounded-full border-red-500/30 text-red-700 dark:text-red-400"
                        >
                          {t("payment_confirmation_pending")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Price + badge */}
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-sm">
                      {credit ? "+" : ""}
                      {formatPrice(amount ?? sub.price, cur?.symbol ?? "$", {
                        currencyCode: cur?.code,
                      })}
                    </p>
                    {cur && cur.rate > 0 && mainCurrency && cur.id !== mainCurrency.id && (
                      <p className="text-[11px] text-muted-foreground">
                        ≈{" "}
                        {formatPrice(toMain(amount ?? sub.price, cur), mainCurrency.symbol, {
                          currencyCode: mainCurrency.code,
                        })}
                      </p>
                    )}
                    {diffDays === 0 && (
                      <Badge className="mt-1 text-[10px] bg-amber-500 text-white">
                        {t("today")}
                      </Badge>
                    )}
                    {diffDays > 0 && diffDays <= 7 && (
                      <Badge
                        variant="outline"
                        className="mt-1 text-[10px] border-amber-400 text-amber-600"
                      >
                        {diffDays} {t("days_short")}
                      </Badge>
                    )}
                  </div>

                  <Info className="hidden h-4 w-4 text-muted-foreground shrink-0 opacity-100 transition-opacity sm:block" />
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
