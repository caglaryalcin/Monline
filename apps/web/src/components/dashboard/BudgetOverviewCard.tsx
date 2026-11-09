import { Check, CheckCheck, Clock3, Landmark, ReceiptText, TriangleAlert } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { BudgetPeriodSelect } from "@/components/dashboard/BudgetPeriodSelect";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLocalToday } from "@/hooks/useLocalToday";
import { type BudgetPeriod, budgetPeriodLabel } from "@/lib/budgetPeriod";
import type { DashboardMonthlyEntry } from "@/lib/dashboardMonthlyPayments";
import { resolveLocale } from "@/lib/locale";
import type { QuickPaymentActions } from "@/lib/quickPayment";
import { cn } from "@/lib/utils";

interface BudgetOverviewCardProps {
  quickPayments?: QuickPaymentActions;
  periodMonths?: BudgetPeriod;
  onPeriodChange?: (value: BudgetPeriod) => void;
  budget: number;
  entries?: DashboardMonthlyEntry[];
  section?: "online" | "bills" | "loans";
  controls?: ReactNode;
  totalCredits?: number;
  isLoading?: boolean;
  hasError?: boolean;
  formatValue: (value: number) => string;
}

export function BudgetOverviewCard({
  quickPayments,
  periodMonths = 1,
  onPeriodChange,
  budget,
  entries = [],
  totalCredits = 0,
  isLoading,
  hasError,
  formatValue,
  section = "online",
  controls,
}: BudgetOverviewCardProps) {
  const { t, i18n } = useTranslation();
  const today = useLocalToday();
  const months = periodMonths;
  const language = resolveLocale(i18n);
  const month = budgetPeriodLabel(today, months, language);
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: months > 1 ? "numeric" : undefined }).format(
      new Date(`${date}T12:00:00`),
    );
  const paid =
    entries.reduce(
      (sum, entry) =>
        sum + Math.round((entry.paidAmount ?? (entry.status === "paid" ? entry.amount : 0)) * 100),
      0,
    ) / 100;
  const pending =
    entries.reduce(
      (sum, entry) =>
        sum +
        Math.round((entry.pendingAmount ?? (entry.status !== "paid" ? entry.amount : 0)) * 100),
      0,
    ) / 100;
  const total = paid + pending;
  const periodBudget = budget * months;
  const available = periodBudget + totalCredits;
  const remaining = available - total;
  const overBudget = available > 0 && remaining < 0;
  const progress = available > 0 ? Math.min(100, (total / available) * 100) : 0;
  const listTitle =
    section === "online"
      ? months > 1
        ? `budget_period_subscriptions_${months}`
        : "budget_month_subscriptions"
      : `budget_period_${section}_${months}`;
  return (
    <Card className="monline-budget-card flex flex-col overflow-hidden rounded-3xl border shadow-sm">
      <CardHeader className="shrink-0 border-b bg-muted/30 pb-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {onPeriodChange && <BudgetPeriodSelect value={periodMonths} onChange={onPeriodChange} />}
          {controls}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5 pt-5">
        {section === "online" && (
          <div className="shrink-0 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-sm text-muted-foreground">{t(months > 1 ? `budget_period_budget_${months}` : "budget_this_month")}</p>
              <span className="ml-auto text-xs capitalize text-muted-foreground">{month}</span>
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {budget > 0 ? formatValue(periodBudget) : t("no_budget_set")}
            </p>
            {months > 1 && budget > 0 && <p className="text-xs text-muted-foreground">{t("budget_period_budget_hint", { monthly: formatValue(budget), count: months })}</p>}
            {totalCredits > 0 && (
              <p className="text-xs text-green-700 dark:text-green-400">
                {t(months > 1 ? "budget_period_credits" : "credits_this_month")}: +{formatValue(totalCredits)}
              </p>
            )}
          </div>
        )}
        {isLoading ? (
          <div
            role="status"
            aria-label={t("loading")}
            className="h-40 animate-pulse rounded-xl bg-muted"
          />
        ) : hasError ? (
          <p role="alert" className="text-sm text-destructive">
            {t("budget_list_error")}
          </p>
        ) : (
          <>
            <div className="grid shrink-0 grid-cols-2 gap-3">
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                <p className="text-xs text-muted-foreground">{t("budget_paid")}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-green-700 dark:text-green-400">
                  {formatValue(paid)}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{t("budget_pending")}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatValue(pending)}</p>
              </div>
            </div>
            {section === "online" && available > 0 && (
              <div className="shrink-0 space-y-2">
                <Progress
                  value={progress}
                  aria-label={t(months > 1 ? "budget_period_total" : "budget_month_total")}
                  className={cn(
                    "subscription-billing-progress h-2 rounded-full",
                    overBudget && "budget-progress-exceeded",
                  )}
                  style={{ "--billing-progress": `${progress}%` } as CSSProperties}
                />
                <div className="flex flex-wrap justify-end gap-2 text-xs">
                  <span
                    className={cn(
                      "font-semibold",
                      overBudget ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {t(overBudget ? "budget_exceeded_by" : "budget_month_remaining")}:{" "}
                    {formatValue(Math.abs(remaining))}
                  </span>
                </div>
              </div>
            )}
            <div className="flex min-h-0 flex-col gap-3 xl:flex-1">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-4">
                <h3 className="text-sm font-semibold">
                  {t(listTitle)}
                </h3>
                {section !== "online" && <span className="ml-auto text-xs capitalize text-muted-foreground">{month}</span>}
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {entries.length}
                </span>
              </div>
              {entries.length ? (
                <ul
                  className="monline-scroll -mr-3 min-h-0 max-h-96 space-y-1 overflow-y-auto overscroll-contain pr-4 xl:max-h-none xl:flex-1"
                  aria-label={t(listTitle)}
                >
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3 rounded-xl px-1 py-2.5">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border bg-background">
                        {entry.subscription ? (
                          <SubscriptionLogo sub={entry.subscription} />
                        ) : entry.name ? (
                          <SubscriptionLogo
                            sub={{ name: entry.name, url: "" }}
                            month={entry.date.slice(0, 7)}
                            rowId={entry.providerRowId}
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-muted-foreground">
                            {section === "loans" ? (
                              <Landmark className="h-4 w-4" />
                            ) : (
                              <ReceiptText className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {entry.name || entry.subscription?.name}
                        </p>
                        {entry.status === "partial" && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t("budget_paid")}: {formatValue(entry.paidAmount ?? 0)} ·{" "}
                            {t("budget_pending")}: {formatValue(entry.pendingAmount ?? 0)}
                          </p>
                        )}
                        {entry.labelKey && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t(entry.labelKey)}
                          </p>
                        )}
                        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <time
                            dateTime={entry.date}
                            className={
                              entry.status !== "paid" && !entry.monthOnly && entry.date <= today
                                ? "text-red-600 dark:text-red-400"
                                : undefined
                            }
                          >
                            {entry.monthOnly ? budgetPeriodLabel(entry.date, 1, language) : dateLabel(entry.date)}
                          </time>
                          <span aria-hidden="true">·</span>
                          {entry.status === "paid" ? (
                            <Check
                              className="h-3 w-3 text-green-700 dark:text-green-400"
                              aria-hidden="true"
                            />
                          ) : entry.status === "overdue" ? (
                            <TriangleAlert
                              className="h-3 w-3 text-destructive"
                              aria-hidden="true"
                            />
                          ) : (
                            <Clock3 className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span
                            className={
                              entry.status === "paid"
                                ? "text-green-700 dark:text-green-400"
                                : entry.status === "overdue"
                                  ? "font-medium text-destructive"
                                  : undefined
                            }
                          >
                            {t(
                              entry.status === "partial"
                                ? "loans_status_partial"
                                : entry.status === "overdue"
                                  ? "not_paid"
                                  : `budget_status_${entry.status}`,
                            )}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatValue(entry.amount)}
                        </span>
                        {entry.subscription && entry.status !== "paid" && quickPayments?.canPay(entry.subscription, entry.date) && (
                          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1 rounded-lg px-2 text-xs"
                            aria-label={t("quick_payment_button", { name: entry.subscription.name })}
                            onClick={() => { if (entry.subscription) quickPayments.select(entry.subscription, entry.date); }}>
                            <CheckCheck className="h-3.5 w-3.5" />
                            {t("paid")}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 py-5 text-center text-sm text-muted-foreground">
                  <ReceiptText className="h-6 w-6" aria-hidden="true" />
                  {t(
                    months > 1 ? "budget_period_empty" : section === "online" ? "budget_month_empty" : "dashboard_month_payments_empty",
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
