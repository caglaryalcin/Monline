import { AlertTriangle, CircleAlert, Clock, RefreshCw, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { StatCard } from "@/components/calendar/StatCard";
import { FinanceAnimationIcon } from "@/components/FinanceAnimationIcon";
import { useAnimationPreferences } from "@/hooks/useAnimationPreferences";
import { formatPrice } from "@/lib/utils";
import type { Currency } from "@/types";

interface CalendarOverviewProps {
  count: number;
  total: number;
  due: number;
  awaitingConfirmation: number;
  loading: boolean;
  hasError?: boolean;
  mainCurrency?: Currency;
  budgetOverrun?: number;
}

export function CalendarOverview({
  count,
  total,
  due,
  awaitingConfirmation,
  loading,
  hasError = false,
  mainCurrency,
  budgetOverrun = 0,
}: CalendarOverviewProps) {
  const { t } = useTranslation();
  const { gifsEnabled } = useAnimationPreferences();
  const currencySymbol = mainCurrency?.symbol ?? "$";
  const priceOptions = { currencyCode: mainCurrency?.code };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 xl:gap-4">
        <StatCard
          icon={<RefreshCw className="h-5 w-5" />}
          iconClass="bg-primary/20 text-primary"
          label={t("subscriptions")}
          value={hasError ? "-" : String(count)}
          loading={loading}
        />
        <StatCard
          icon={<FinanceAnimationIcon asset="receipt" fallback={<TrendingUp className="h-5 w-5" />} />}
          iconClass={gifsEnabled ? "!bg-transparent !p-0 !shadow-none" : "bg-blue-500/20 text-blue-500"}
          label={t("total")}
          value={hasError ? "-" : formatPrice(total, currencySymbol, priceOptions)}
          loading={loading}
        />
        <StatCard
          icon={<FinanceAnimationIcon asset="credit-card" fallback={<Clock className="h-5 w-5" />} />}
          iconClass={gifsEnabled ? "!bg-transparent !p-0 !shadow-none" : "bg-amber-500/20 text-amber-500"}
          label={t("due")}
          value={hasError ? "-" : formatPrice(due, currencySymbol, priceOptions)}
          loading={loading}
        />
        <StatCard
          icon={<FinanceAnimationIcon asset="loans" fallback={<AlertTriangle className="h-5 w-5" />} />}
          iconClass={gifsEnabled ? "!bg-transparent !p-0 !shadow-none" : "bg-destructive/20 text-destructive"}
          label={t("budget_overrun")}
          value={
            hasError ? "-" : formatPrice(Math.max(0, budgetOverrun), currencySymbol, priceOptions)
          }
          loading={loading}
        />
        <StatCard
          icon={<FinanceAnimationIcon asset="price-tag" fallback={<CircleAlert className="h-5 w-5" />} />}
          iconClass={gifsEnabled ? "!bg-transparent !p-0 !shadow-none" : "bg-red-500/20 text-red-600 dark:text-red-400"}
          label={t("subscription_payments_awaiting")}
          value={hasError ? "-" : formatPrice(awaitingConfirmation, currencySymbol, priceOptions)}
          loading={loading}
        />
      </div>
      {hasError && (
        <p role="alert" className="text-sm text-destructive">
          {t("budget_list_error")}
        </p>
      )}
    </>
  );
}
