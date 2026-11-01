import { CircleAlert, Clock, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import { StatCard } from "@/components/calendar/StatCard";
import { InfoButton } from "@/components/ui/info-button";
import { formatPrice } from "@/lib/utils";
import type { Currency } from "@/types";

interface CalendarOverviewProps {
  count: number;
  total: number;
  unpaidTotal: number;
  awaitingConfirmation: number;
  loading: boolean;
  hasError?: boolean;
  mainCurrency?: Currency;
  remainingBudget?: number | null;
  budgetLoading?: boolean;
  budgetError?: boolean;
}

export function CalendarOverview({
  count,
  total,
  unpaidTotal,
  awaitingConfirmation,
  loading,
  hasError = false,
  mainCurrency,
  remainingBudget = null,
  budgetLoading = false,
  budgetError = false,
}: CalendarOverviewProps) {
  const { t } = useTranslation();
  const currencySymbol = mainCurrency?.symbol ?? "$";
  const priceOptions = { currencyCode: mainCurrency?.code };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 xl:gap-4">
        <StatCard
          icon={<RefreshCw className="h-5 w-5" />}
          iconClass="bg-primary/20 text-primary"
          label={t("subscriptions")}
          value={hasError ? "—" : String(count)}
          loading={loading}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          iconClass="bg-blue-500/20 text-blue-500"
          label={
            <span className="inline-flex items-center gap-1">
              {t("total")}
              <InfoButton title={t("total")}>
                {t("calendar_payment_totals_help")}
              </InfoButton>
            </span>
          }
          value={hasError ? "—" : formatPrice(total, currencySymbol, priceOptions)}
          loading={loading}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          iconClass="bg-amber-500/20 text-amber-500"
          label={
            <span className="inline-flex items-center gap-1">
              {t("calendar_unpaid_total")}
              <InfoButton title={t("calendar_unpaid_total")}>
                {t("calendar_unpaid_total_help")}
              </InfoButton>
            </span>
          }
          value={hasError ? "—" : formatPrice(unpaidTotal, currencySymbol, priceOptions)}
          loading={loading}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          iconClass={
            remainingBudget !== null && remainingBudget < 0
              ? "bg-destructive/20 text-destructive"
              : "bg-primary/20 text-primary"
          }
          label={
            <span className="inline-flex items-center gap-1">
              {t("calendar_remaining_budget")}
              <InfoButton title={t("calendar_remaining_budget")}>
                {t("calendar_salary_budget_help")}
                {budgetError ? (
                  <p className="mt-2">{t("calendar_salary_budget_error")}</p>
                ) : remainingBudget === null && !budgetLoading ? (
                  <p className="mt-2">{t("calendar_salary_budget_missing")}</p>
                ) : null}
              </InfoButton>
            </span>
          }
          value={
            hasError || budgetError || remainingBudget === null
              ? "—"
              : formatPrice(remainingBudget, currencySymbol, priceOptions)
          }
          loading={loading || budgetLoading}
        />
        <StatCard
          icon={<CircleAlert className="h-5 w-5" />}
          iconClass="bg-red-500/20 text-red-600 dark:text-red-400"
          label={
            <span className="inline-flex items-center gap-1">
              {t("subscription_payments_awaiting")}
              <InfoButton title={t("subscription_payments_awaiting")}>
                {t("calendar_pending_confirmation_help")}
              </InfoButton>
            </span>
          }
          value={hasError ? "—" : formatPrice(awaitingConfirmation, currencySymbol, priceOptions)}
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
