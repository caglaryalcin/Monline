import { recordedPayments } from "@/lib/recordedPayments";
import type { Currency, PaymentRecord, Subscription } from "@/types";

/** Paid total and period averages from January 1 through today in the selected year. */
export function paidTotals(
  subscriptions: Subscription[],
  currencies: Currency[],
  records: PaymentRecord[],
  now = new Date(),
  selectedYear = now.getFullYear(),
) {
  if (!Number.isInteger(selectedYear) || selectedYear < 1 || selectedYear > now.getFullYear()) {
    return { averageWeekly: 0, averageMonthly: 0, totalYearly: 0 };
  }
  const lastDay = selectedYear === now.getFullYear() ? now : new Date(selectedYear, 11, 31);
  // Use calendar dates to avoid daylight-saving changes altering the day count.
  const days =
    Math.round(
      (Date.UTC(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate()) -
        Date.UTC(selectedYear, 0, 1)) /
        86400000,
    ) + 1;
  // Include the started week/month, as well as periods with no payments.
  const weeks = Math.ceil(days / 7);
  const months = lastDay.getMonth() + 1;
  let yearly = 0;

  for (const payment of recordedPayments(subscriptions, currencies, records, now)) {
    // Never substitute today's package price for an unknown historical amount.
    if (payment.amount === null || payment.paidAt.getFullYear() !== selectedYear) continue;
    const cents = Math.round(payment.amount * 100);
    yearly += cents;
  }

  const totalYearly = yearly / 100;
  return {
    averageWeekly: Number((totalYearly / weeks).toFixed(2)),
    averageMonthly: Number((totalYearly / months).toFixed(2)),
    totalYearly,
  };
}
