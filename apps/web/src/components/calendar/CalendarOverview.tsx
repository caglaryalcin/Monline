import { RefreshCw, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import { StatCard } from "@/components/calendar/StatCard";
import { FinanceAnimationIcon } from "@/components/FinanceAnimationIcon";
import { InfoButton } from "@/components/ui/info-button";
import { useAnimationPreferences } from "@/hooks/useAnimationPreferences";
import { formatPrice } from "@/lib/utils";
import type { Currency } from "@/types";

interface CalendarOverviewProps {
  subscriptionBudget: number;
  incomeTotal: number | null;
  expenseTotal: number;
  loading: boolean;
  hasError?: boolean;
  mainCurrency?: Currency;
  remainingBudget?: number | null;
  financeLoading?: boolean;
  incomeError?: boolean;
  expenseError?: boolean;
}

export function CalendarOverview({
  subscriptionBudget,
  incomeTotal,
  expenseTotal,
  loading,
  hasError = false,
  mainCurrency,
  remainingBudget = null,
  financeLoading = false,
  incomeError = false,
  expenseError = false,
}: CalendarOverviewProps) {
  const { t } = useTranslation();
  const { gifsEnabled } = useAnimationPreferences();
  const currencySymbol = mainCurrency?.symbol ?? "$";
  const priceOptions = { currencyCode: mainCurrency?.code };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <StatCard
          icon={<RefreshCw className="h-5 w-5" />}
          iconClass="bg-primary/20 text-primary"
          label={
            <span className="inline-flex items-center gap-1">
              {t("calendar_subscription_budget")}
              <InfoButton title={t("calendar_subscription_budget")}>
                {t("calendar_subscription_budget_limit_help")}
              </InfoButton>
            </span>
          }
          value={formatPrice(subscriptionBudget, currencySymbol, priceOptions)}
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
              {t("calendar_remaining_subscription_budget")}
              <InfoButton title={t("calendar_remaining_subscription_budget")}>
                {t("calendar_subscription_budget_help")}
              </InfoButton>
            </span>
          }
          value={
            hasError || remainingBudget === null
              ? "-"
              : formatPrice(remainingBudget, currencySymbol, priceOptions)
          }
          loading={loading}
        />
        <StatCard
          icon={<FinanceAnimationIcon asset="wallet" fallback={<TrendingUp className="h-5 w-5" />} />}
          highlight
          iconClass={gifsEnabled ? "bg-transparent p-0 shadow-none sm:p-0" : "bg-blue-500/20 text-blue-500"}
          label={
            <span className="inline-flex items-center gap-1">
              {t("calendar_income_total")}
              <InfoButton title={t("calendar_income_total")}>
                {t("calendar_income_total_help")}
                {incomeError && <p className="mt-2">{t("calendar_income_total_error")}</p>}
              </InfoButton>
            </span>
          }
          value={
            incomeError || incomeTotal === null
              ? "-"
              : formatPrice(incomeTotal, currencySymbol, priceOptions)
          }
          loading={loading || financeLoading}
        />
        <StatCard
          icon={<FinanceAnimationIcon asset="receipt" fallback={<TrendingDown className="h-5 w-5" />} />}
          highlight
          iconClass={gifsEnabled ? "bg-transparent p-0 shadow-none sm:p-0" : "bg-amber-500/20 text-amber-500"}
          label={
            <span className="inline-flex items-center gap-1">
              {t("calendar_expense_total")}
              <InfoButton title={t("calendar_expense_total")}>
                {t("calendar_payment_totals_help")}
                {expenseError && <p className="mt-2">{t("calendar_carryover_error")}</p>}
              </InfoButton>
            </span>
          }
          value={
            hasError || expenseError ? "-" : formatPrice(expenseTotal, currencySymbol, priceOptions)
          }
          loading={loading || financeLoading}
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
