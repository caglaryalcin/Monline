import {
  Calendar,
  CalendarRange,
  Copy,
  Edit,
  ExternalLink,
  History,
  Hourglass,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";

import { PaymentMethodIcon } from "@/components/PaymentMethodIcon";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import type { SubscriptionPriceDisplay } from "@/components/subscriptions/subscriptionsPage.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { formatBillingPeriod } from "@/lib/billingPeriods";
import { categoryLabel } from "@/lib/categoryLabel";
import { isCredit } from "@/lib/recordTypes";
import { automaticStartDate } from "@/lib/subscriptionStartDate";
import {
  cn,
  daysUntil,
  formatDate,
  formatPrice,
  subscriptionProgress,
  toMainCurrency,
  toMonthly,
} from "@/lib/utils";
import type { Currency, Subscription } from "@/types";

interface SubscriptionActionsProps {
  sub: Subscription;
  className?: string;
  priceDisplay: SubscriptionPriceDisplay;
  onPriceDisplayChange: (value: SubscriptionPriceDisplay) => void;
  onEdit: () => void;
  onClone: () => void;
  onRenew: () => void;
  onHistory: () => void;
  onDelete: () => void;
}

function SubscriptionActions({
  sub,
  className,
  priceDisplay,
  onPriceDisplayChange,
  onEdit,
  onClone,
  onRenew,
  onHistory,
  onDelete,
}: SubscriptionActionsProps) {
  const { t } = useTranslation();
  const credit = isCredit(sub);
  const cycleName = sub.expand?.cycle?.name ?? "Monthly";
  const savedPeriod =
    (sub.frequency || 1) === 1
      ? cycleName === "Monthly"
        ? "monthly"
        : cycleName === "Yearly"
          ? "yearly"
          : null
      : null;
  const displayedPeriod = priceDisplay === "billing" ? savedPeriod : priceDisplay;
  const nextPeriod = displayedPeriod === "monthly" ? "yearly" : "monthly";
  const priceActionLabel = t(nextPeriod === "monthly" ? "show_monthly" : "show_yearly");
  const changePeriod = (period: "monthly" | "yearly") =>
    onPriceDisplayChange(period === savedPeriod ? "billing" : period);

  return (
    <div
      className={cn(
        "flex max-w-full flex-wrap items-center justify-end gap-1 rounded-2xl border bg-background/80 p-1 shadow-sm backdrop-blur transition-opacity sm:rounded-full",
        className,
      )}
    >
      {!credit && sub.expand?.cycle?.name !== "One-Time" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-full text-muted-foreground",
            priceDisplay !== "billing" && "bg-primary/10 text-primary",
          )}
          aria-label={priceActionLabel}
          title={priceActionLabel}
          onClick={() => changePeriod(nextPeriod)}
        >
          <CalendarRange className="h-3.5 w-3.5" />
        </Button>
      )}
      {sub.url && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-muted-foreground"
          onClick={() => window.open(sub.url, "_blank")}
          title={t("open_url")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full text-muted-foreground"
        onClick={onEdit}
        title={t("edit")}
      >
        <Edit className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full text-muted-foreground"
        onClick={onClone}
        title={t("clone")}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full text-muted-foreground"
        onClick={onHistory}
        title={t("history")}
      >
        <History className="h-3.5 w-3.5" />
      </Button>
      {/* Renewing an inactive subscription is a no-op on the backend — it
          refuses to advance a paused or finished schedule — so offering the
          action here would just be a button that does nothing. */}
      {!sub.inactive && !credit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-muted-foreground"
          onClick={onRenew}
          title={t("renew")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full text-muted-foreground"
        onClick={onDelete}
        title={t("delete")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── SubscriptionCard ──────────────────────────────────────────────────────────

export function SubscriptionCard({
  sub,
  mainCurrency,
  currencies,
  convertCurrency,
  priceDisplay: controlledPriceDisplay,
  onPriceDisplayChange,
  showProgress,
  onEdit,
  onClone,
  onRenew,
  onHistory,
  onDelete,
  layout = "grid",
  onToggleActive,
  statusPending = false,
  statusDisabled = false,
}: {
  sub: Subscription;
  mainCurrency?: Currency;
  convertCurrency?: boolean;
  currencies?: Currency[];
  priceDisplay?: SubscriptionPriceDisplay;
  onPriceDisplayChange?: (value: SubscriptionPriceDisplay) => void;
  showProgress?: boolean;
  onEdit: () => void;
  onClone: () => void;
  onRenew: () => void;
  onHistory: () => void;
  onDelete: () => void;
  layout?: "grid" | "list";
  onToggleActive?: () => void;
  statusPending?: boolean;
  statusDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const [localPriceDisplay, setLocalPriceDisplay] = useState<SubscriptionPriceDisplay>("billing");
  const priceDisplay = controlledPriceDisplay ?? localPriceDisplay;
  const changePriceDisplay = onPriceDisplayChange ?? setLocalPriceDisplay;
  const currency = currencies?.find((entry) => entry.id === sub.currency) ?? sub.expand?.currency;
  const cycleName = sub.expand?.cycle?.name ?? "Monthly";
  const periodLabel = formatBillingPeriod(t, cycleName, sub.frequency || 1);
  const category = sub.expand?.category;
  const payer = sub.expand?.payer;
  const paymentMethod = sub.inactive ? undefined : sub.expand?.payment_method;
  const credit = isCredit(sub);

  const shouldConvert = !!(
    convertCurrency &&
    mainCurrency &&
    currency &&
    !currency.is_main &&
    Number.isFinite(currency.rate) &&
    currency.rate > 0
  );
  const recurring = !credit && cycleName !== "One-Time";
  const normalizePeriod = recurring && priceDisplay !== "billing";
  const rawPrice = normalizePeriod
    ? toMonthly(sub.price, cycleName, sub.frequency || 1) * (priceDisplay === "yearly" ? 12 : 1)
    : sub.price;
  const displayPeriod = !recurring
    ? t("one_time")
    : normalizePeriod
      ? t(priceDisplay === "yearly" ? "yearly" : "monthly")
      : periodLabel;
  const price = shouldConvert ? toMainCurrency(rawPrice, currency) : rawPrice;
  const displayCurrency = shouldConvert ? mainCurrency : currency;
  const symbol = displayCurrency?.symbol ?? "$";
  const showOriginalPrice =
    shouldConvert ||
    (normalizePeriod &&
      (cycleName !== (priceDisplay === "yearly" ? "Yearly" : "Monthly") ||
        (sub.frequency || 1) !== 1));
  const originalPriceDetails = showOriginalPrice ? (
    <p className="mt-1 truncate text-xs tabular-nums text-muted-foreground">
      {formatPrice(sub.price, currency?.symbol ?? symbol, { currencyCode: currency?.code })}
      {" / "}
      {credit ? t("one_time") : periodLabel}
    </p>
  ) : null;
  const days = daysUntil(sub.next_payment);
  const nextPaymentDay = sub.next_payment?.slice(0, 10) || "";
  const periodStart = automaticStartDate(nextPaymentDay, cycleName, sub.frequency || 1);
  const progress = showProgress ? subscriptionProgress(periodStart, nextPaymentDay) : 0;
  const remainingLabel =
    days > 0
      ? t("billing_days_remaining", { count: days })
      : days === 0
        ? t("today")
        : t("billing_days_overdue", { count: Math.abs(days) });
  const statusToggle = onToggleActive ? (
    <Switch
      type="button"
      className="shadow-sm"
      checked={!sub.inactive}
      onCheckedChange={onToggleActive}
      disabled={statusDisabled || statusPending}
      aria-label={`${sub.name}: ${t("active")}`}
      aria-busy={statusPending}
      title={t(sub.inactive ? "subscription_activate" : "subscription_deactivate")}
    />
  ) : null;

  if (layout === "list") {
    return (
      <div
        className={cn(
          "group relative flex flex-col gap-3 rounded-xl border bg-card/60 p-3 backdrop-blur-sm transition-colors xl:flex-row xl:items-center",
          sub.inactive && "grayscale bg-muted/40 text-muted-foreground",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background font-bold shadow-sm">
            <SubscriptionLogo
              sub={sub}
              className={cn(
                "h-full w-full object-contain p-1 transition-[filter,opacity] duration-200",
                sub.inactive && "grayscale opacity-60",
              )}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">{sub.name}</h3>
              {credit ? (
                <Badge className="shrink-0 bg-green-500/15 text-green-700 dark:text-green-400">
                  {t("credit_income")}
                </Badge>
              ) : null}
              {sub.inactive ? (
                <span className="shrink-0 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("inactive_label")}
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {category ? categoryLabel(category, t) : t("category")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 xl:contents">
          <div className="flex shrink-0 items-start gap-5">
            <div className="min-w-[7rem] text-left sm:text-right">
              <p
                className={cn(
                  "font-mono font-bold tracking-tight whitespace-nowrap",
                  sub.inactive
                    ? "text-muted-foreground"
                    : credit && "text-green-600 dark:text-green-400",
                )}
              >
                {credit ? "+" : ""}
                {formatPrice(price, symbol, { currencyCode: displayCurrency?.code })}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {displayPeriod}
              </p>
              {originalPriceDetails}
            </div>
            {statusToggle && <div className="shrink-0 pt-0.5">{statusToggle}</div>}
          </div>

          <div className="hidden min-w-[8.5rem] text-sm md:block">
            {sub.next_payment && !sub.inactive ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {t(credit ? "received_on" : "next_payment")}
                </p>
                <p className="font-medium">{formatDate(sub.next_payment)}</p>
              </>
            ) : null}
          </div>

          <div className="hidden min-w-[7rem] items-center gap-2 text-xs text-muted-foreground lg:flex">
            {paymentMethod ? <PaymentMethodIcon method={paymentMethod} /> : null}
            {payer ? (
              <span className="truncate font-medium text-foreground/80">{payer.name}</span>
            ) : null}
          </div>

          <SubscriptionActions
            sub={sub}
            priceDisplay={priceDisplay}
            onPriceDisplayChange={changePriceDisplay}
            className="shrink-0"
            onEdit={onEdit}
            onClone={onClone}
            onRenew={onRenew}
            onHistory={onHistory}
            onDelete={onDelete}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative rounded-2xl border bg-card/60 backdrop-blur-sm p-4 transition-all duration-300 flex flex-col justify-between overflow-hidden",
        sub.inactive && "grayscale bg-muted/40 text-muted-foreground",
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-[min(100%,8rem)] flex-1 items-center gap-2.5">
          <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden bg-background shadow-sm border flex items-center justify-center text-xl font-bold">
            <SubscriptionLogo
              sub={sub}
              className={cn(
                "h-full w-full object-contain p-1 transition-[filter,opacity] duration-200",
                sub.inactive && "grayscale opacity-60",
              )}
            />
          </div>
          <div className="min-w-0">
            <h3
              className={cn(
                "font-bold text-lg leading-tight line-clamp-1 transition-colors",
                sub.inactive ? "text-muted-foreground" : "",
              )}
            >
              {sub.name}
            </h3>
            {credit && (
              <Badge className="mr-2 mt-1 bg-green-500/15 text-green-700 dark:text-green-400">
                {t("credit_income")}
              </Badge>
            )}
            {category && (
              <span className="text-xs font-medium text-muted-foreground mr-2">
                {categoryLabel(category, t)}
              </span>
            )}
            {sub.inactive && (
              <span className="text-[10px] uppercase font-bold tracking-wider rounded-md border bg-muted text-muted-foreground px-1.5 py-0.5">
                {t("inactive_label")}
              </span>
            )}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-start gap-5">
          <div className="text-right">
            <p
              className={cn(
                "font-extrabold text-xl font-mono tracking-tight whitespace-nowrap",
                sub.inactive
                  ? "text-muted-foreground"
                  : credit
                    ? "text-green-600 dark:text-green-400"
                    : "text-foreground",
              )}
            >
              {credit ? "+" : ""}
              {formatPrice(price, symbol, { currencyCode: displayCurrency?.code })}
            </p>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap">
              {displayPeriod}
            </p>
          </div>
          {statusToggle && <div className="shrink-0 pt-0.5">{statusToggle}</div>}
        </div>
      </div>

      <div className="space-y-3">
        {sub.next_payment && !sub.inactive && (
          <div className="flex items-center justify-between text-sm bg-background/50 border rounded-xl px-3 py-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> {t(credit ? "received_on" : "next_payment")}
            </span>
            <div className="font-medium text-foreground">{formatDate(sub.next_payment)}</div>
          </div>
        )}

        {!credit && ((sub.payment_limit ?? 0) > 0 || sub.end_date) && (
          <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
            <Hourglass className="h-3.5 w-3.5" />
            {(sub.payment_limit ?? 0) > 0
              ? t("payments_progress", {
                  completed: sub.payments_completed ?? 0,
                  total: sub.payment_limit,
                })
              : t(sub.inactive ? "ended_on" : "ends_on", { date: formatDate(sub.end_date!) })}
          </div>
        )}

        {showProgress && !credit && !!periodStart && !sub.inactive && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              <span>
                {t("billing_cycle")} <span aria-hidden="true">→</span>
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5",
                  days <= 3
                    ? "bg-orange-500/10 text-orange-600 font-bold"
                    : "bg-primary/10 text-primary font-semibold",
                )}
              >
                {remainingLabel}
              </span>
            </div>
            <Progress
              value={progress}
              aria-label={t("billing_cycle")}
              aria-valuetext={remainingLabel}
              title={t("billing_progress_hint")}
              className="subscription-billing-progress h-2 rounded-full bg-accent"
              style={{ "--billing-progress": `${progress}%` } as CSSProperties}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <div className="flex min-w-0 basis-24 flex-1 items-center gap-2 text-xs text-muted-foreground">
          {paymentMethod && <PaymentMethodIcon method={paymentMethod} />}
          <div className="min-w-0">
            {payer && (
              <span className="block truncate font-medium text-foreground/80">
                {t("pays")} {payer.name}
              </span>
            )}
            {originalPriceDetails}
          </div>
        </div>

        <SubscriptionActions
          sub={sub}
          priceDisplay={priceDisplay}
          onPriceDisplayChange={changePriceDisplay}
          className="ml-auto shrink-0"
          onEdit={onEdit}
          onClone={onClone}
          onRenew={onRenew}
          onHistory={onHistory}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
