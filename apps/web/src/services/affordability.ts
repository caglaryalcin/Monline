import type { OutlookBudget, OutlookHistory, OutlookLedger, OutlookSpending, OutlookStatement } from "@/lib/affordability";
import { api } from "@/lib/api";
import type { CreditCard } from "@/lib/creditCards";
import type { Saving } from "@/lib/savings";
import type { Currency } from "@/types";

export interface AffordabilitySnapshot {
  ledger: OutlookLedger;
  spending: OutlookSpending;
  holdings: Saving[];
  cards: CreditCard[];
  statements: OutlookStatement[];
  budgets: OutlookBudget[];
  currencies: Pick<Currency, "id" | "code" | "is_main">[];
  history: OutlookHistory[];
}
export const affordabilityService = {
  snapshot: (signal: AbortSignal) => api.get<AffordabilitySnapshot>("/api/budget/affordability", {
    signal, timeoutMs: 15000,
  }),
};
