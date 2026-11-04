import { buildMonthlyBudget } from "@/lib/monthlyBudget";
import { isCredit } from "@/lib/recordTypes";
import { subscriptionAmount } from "@/lib/subscriptionTrial";
import type { Currency, PaymentRecord, Subscription } from "@/types";

export const BUDGET_PERIODS = [1, 3, 6, 12] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

export function buildBudgetPeriod(
  subscriptions: Subscription[], currencies: Currency[], records: PaymentRecord[],
  paymentTracking: boolean, now: Date, months: BudgetPeriod,
) {
  const count = BUDGET_PERIODS.includes(months) ? months : 1;
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const after = new Date(now.getFullYear(), now.getMonth() + count, 1);
  const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  // A non-renewing subscription forecasts its saved next payment only.
  // Stored records still enter the budget at their actual dates.
  // The dashboard budget covers active subscriptions. Historical payment
  // queries still retain disabled subscriptions and their recorded charges.
  const scheduled = subscriptions.filter((sub) => !sub.inactive).map((sub) => {
    if (sub.auto_renew || !sub.next_payment) return sub;
    const end = [sub.end_date, sub.next_payment].filter(Boolean).map((date) => date!.slice(0, 10)).sort()[0];
    return { ...sub, end_date: end };
  });
  const entries = Array.from({ length: count }, (_, offset) =>
    buildMonthlyBudget(scheduled, currencies, records, paymentTracking,
      new Date(now.getFullYear(), now.getMonth() + offset, offset === 0 ? now.getDate() : 1)),
  ).flat();
  const mainRate = currencies.find((currency) => currency.is_main)?.rate || 1;
  const firstDay = day(first), afterDay = day(after);
  const credits = subscriptions.reduce((total, sub) => {
    const date = sub.next_payment.slice(0, 10);
    if (!isCredit(sub) || sub.inactive || date < firstDay || date >= afterDay) return total;
    const currency = currencies.find((item) => item.id === sub.currency) ?? sub.expand?.currency;
    return total + Math.round((subscriptionAmount(sub, date) / (currency?.rate || 1)) * mainRate * 100);
  }, 0) / 100;
  return { entries, credits };
}

export function budgetPeriodLabel(today: string, months: BudgetPeriod, language: string) {
  const [year, month] = today.split("-").map(Number);
  const format = new Intl.DateTimeFormat(language, { month: "long", year: "numeric" });
  const first = format.format(new Date(year, month - 1, 1));
  return months === 1 ? first : `${first} - ${format.format(new Date(year, month + months - 2, 1))}`;
}

/** Calendar-month bounds, including a range that crosses New Year. */
export function budgetPeriodBounds(today: string, months: BudgetPeriod) {
  const [year, month] = today.split("-").map(Number);
  const end = new Date(year, month - 1 + months, 1);
  return {
    from: today.slice(0, 7) + "-01",
    until: end.getFullYear() + "-" + String(end.getMonth() + 1).padStart(2, "0") + "-01",
  };
}
