import { useMemo } from "react";

import { buildCostHistory } from "@/lib/costHistory";
import type { User } from "@/types";

interface SummaryData {
  totalMonthly: number;
  totalCredits?: number;
}

interface YearlyCostPoint {
  year: number;
  month: number;
  total: number;
}

interface UseDashboardDerivedDataParams {
  user: User | null | undefined;
  summary?: SummaryData;
  yearlyCosts?: YearlyCostPoint[];
  paymentCosts?: YearlyCostPoint[];
}

export function useDashboardDerivedData({
  user,
  summary,
  paymentCosts,
}: UseDashboardDerivedDataParams) {
  const currentYear = new Date().getFullYear(),
    currentMonth = new Date().getMonth();
  const chartData = useMemo(
    () => buildCostHistory([], undefined, new Date(currentYear, currentMonth, 1), paymentCosts),
    [paymentCosts, currentYear, currentMonth],
  );

  const budget = user?.budget ?? 0;
  const totalCredits = summary?.totalCredits ?? 0;
  const availableBudget = budget + totalCredits;
  const remaining = summary ? availableBudget - summary.totalMonthly : availableBudget;
  const budgetUsed =
    availableBudget > 0 && summary
      ? Math.min(100, (summary.totalMonthly / availableBudget) * 100)
      : 0;
  // There is nothing to be "over" until the user has a budget or a credit to
  // measure against — otherwise every account without a budget reads as
  // over-budget the moment it has a single expense.
  const isOverBudget = availableBudget > 0 && remaining < 0;

  return {
    budget,
    budgetUsed,
    remaining,
    totalCredits,
    chartData,
    isOverBudget,
  };
}
