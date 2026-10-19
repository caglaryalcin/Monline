import type { MonthlyBudgetEntry } from "@/lib/monthlyBudget";
import type { Subscription } from "@/types";

// Test-only fixture, never imported by the application.
export function monthlyBudgetFixture(now = new Date()) {
  const subscription: Subscription = {
    id: "test-subscription",
    name: "Cloud Pro",
    user: "test-user",
    price: 440,
    currency: "",
    cycle: "",
    frequency: 1,
    next_payment: "",
    start_date: "",
    auto_renew: true,
    notify: false,
    notify_days_before: 0,
    inactive: false,
  };
  const cases = [
    { name: "Netflix", amount: 300, day: 3, status: "paid" },
    { name: "Spotify", amount: 180, day: 6, status: "paid" },
    { name: "YouTube Premium", amount: 220, day: 10, status: "paid" },
    { name: "Google Drive", amount: 350, day: 12, status: "paid" },
    { name: "Cloud Pro", amount: 440, day: 22, status: "pending" },
  ] as const;
  const entries: MonthlyBudgetEntry[] = cases.map((entry, index) => ({
    id: `test-entry-${index}`,
    subscription: {
      ...subscription,
      id: `test-subscription-${index}`,
      name: entry.name,
      price: entry.amount,
    },
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(entry.day).padStart(2, "0")}`,
    amount: entry.amount,
    status: entry.status,
  }));
  return { entries };
}
