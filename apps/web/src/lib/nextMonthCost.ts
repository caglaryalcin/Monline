import { parseLocalDate, toDateStr } from "@/components/calendar/types";
import { buildMonthlyBudget } from "@/lib/monthlyBudget";
import { isCredit } from "@/lib/recordTypes";
import type { Currency, Subscription } from "@/types";

import type { CostHistoryPoint } from "./costHistory";

/** Scheduled renewals in the next calendar month, at current prices and exchange rates. */
export function nextMonthCost(
  subscriptions: Subscription[],
  currencies: Currency[],
  now = new Date(),
) {
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const renewing = subscriptions.filter(
    (subscription) =>
      subscription.auto_renew &&
      !subscription.inactive &&
      !isCredit(subscription) &&
      subscription.expand?.cycle?.name !== "One-Time",
  );
  let cents = 0;
  for (const entry of buildMonthlyBudget(renewing, currencies, [], false, nextMonth)) {
    const next = parseLocalDate(entry.subscription.next_payment);
    // The calendar also reconstructs history; a forecast starts at the actual next payment.
    if (!next || entry.date < toDateStr(next) || !Number.isFinite(entry.amount) || entry.amount < 0)
      continue;
    cents += Math.round(entry.amount * 100);
  }
  return cents / 100;
}

/** Every remaining month this year; in December keep next January visible too. */
export function upcomingMonthCosts(
  subscriptions: Subscription[],
  currencies: Currency[],
  now = new Date(),
): CostHistoryPoint[] {
  return Array.from({ length: Math.max(1, 11 - now.getMonth()) }, (_, index) => {
    const previous = new Date(now.getFullYear(), now.getMonth() + index, 1);
    const target = new Date(previous.getFullYear(), previous.getMonth() + 1, 1);
    return {
      name: `${target.getFullYear()}/${String(target.getMonth() + 1).padStart(2, "0")}`,
      cost: nextMonthCost(subscriptions, currencies, previous),
    };
  });
}
