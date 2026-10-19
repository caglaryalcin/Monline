import { Check, Clock3, ReceiptText, TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MonthlyBudgetEntry } from "@/lib/monthlyBudget";
import { cn } from "@/lib/utils";

interface BudgetOverviewCardProps {
  budget: number;
  entries?: MonthlyBudgetEntry[];
  totalCredits?: number;
  isLoading?: boolean;
  hasError?: boolean;
  formatValue: (value: number) => string;
}

export function BudgetOverviewCard({
  budget,
  entries = [],
  totalCredits = 0,
  isLoading,
  hasError,
  formatValue,
}: BudgetOverviewCardProps) {
  const { t, i18n } = useTranslation();
  const language = (i18n?.resolvedLanguage ?? i18n?.language ?? "en").replace("_", "-");
  const month = new Intl.DateTimeFormat(language, { month: "long", year: "numeric" }).format(
    new Date(),
  );
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(
      new Date(`${date}T12:00:00`),
    );
  const paid = entries
    .filter((entry) => entry.status === "paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const pending = entries
    .filter((entry) => entry.status !== "paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const total = paid + pending;
  const available = budget + totalCredits;
  const remaining = available - total;
  const overBudget = available > 0 && remaining < 0;
  const progress = available > 0 ? Math.min(100, (total / available) * 100) : 0;
  const ready = !isLoading && !hasError;
  return (
    <Card className="monline-budget-card flex flex-col overflow-hidden rounded-3xl border shadow-sm">
      <CardHeader className="shrink-0 border-b bg-muted/30 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{t("budget_overview")}</CardTitle>
          <span className="text-xs capitalize text-muted-foreground">{month}</span>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5 pt-5">
        <div className="shrink-0 space-y-1">
          <p className="text-sm text-muted-foreground">{t("budget_this_month")}</p>
          <p className="text-3xl font-bold tracking-tight">
            {budget > 0 ? formatValue(budget) : t("no_budget_set")}
          </p>
          {totalCredits > 0 && (
            <p className="text-xs text-green-700 dark:text-green-400">
              {t("credits_this_month")}: +{formatValue(totalCredits)}
            </p>
          )}
        </div>
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
            {available > 0 && (
              <div className="shrink-0 space-y-2">
                <Progress
                  value={progress}
                  aria-label={t("budget_month_total")}
                  className={cn(
                    "subscription-billing-progress h-2 rounded-full",
                    overBudget && "budget-progress-exceeded",
                  )}
                  style={{ "--billing-progress": `${progress}%` } as CSSProperties}
                />
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {t("budget_month_total")}:{" "}
                    <strong className="text-foreground">{formatValue(total)}</strong>
                  </span>
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
              <div className="flex shrink-0 items-center justify-between gap-2 border-t pt-4">
                <h3 className="text-sm font-semibold">{t("budget_month_subscriptions")}</h3>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {entries.length}
                </span>
              </div>
              {entries.length ? (
                <ul
                  className="monline-scroll min-h-0 max-h-96 space-y-1 overflow-y-auto overscroll-contain pr-1 xl:max-h-none xl:flex-1"
                  aria-label={t("budget_month_subscriptions")}
                >
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3 rounded-xl px-1 py-2.5">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border bg-background">
                        <SubscriptionLogo sub={entry.subscription} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{entry.subscription.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <time
                            dateTime={entry.date}
                            className={entry.status === "overdue" ? "text-destructive" : undefined}
                          >
                            {dateLabel(entry.date)}
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
                            {t(`budget_status_${entry.status}`)}
                          </span>
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatValue(entry.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 py-5 text-center text-sm text-muted-foreground">
                  <ReceiptText className="h-6 w-6" aria-hidden="true" />
                  {t("budget_month_empty")}
                </div>
              )}
            </div>
          </>
        )}
        {ready && (
          <p className="mt-auto shrink-0 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
            {t("budget_month_note")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
