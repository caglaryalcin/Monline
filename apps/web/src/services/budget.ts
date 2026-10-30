import { api } from "@/lib/api";

export interface BudgetEvent {
  id: string;
  name: string;
  date: string;
  amount: number;
  currency: string;
  kind: string;
  source: string;
  status: string;
  counts_as_expense: boolean;
  budget_category?: string;
  card_name?: string;
  card_row_id?: string;
  statement_id?: string;
  statement_period?: string;
  installment?: string;
  duplicate_of?: string;
  verification?: "verified" | "changed";
  match_id?: string;
  verified_statement_id?: string;
  verified_target_name?: string;
  verified_target_id?: string;
  forecast?: boolean;
  manual_bill_id?: string;
  separations?: { id: string; source_id: string; name: string; valid: boolean }[];
}
export interface BudgetTotal {
  currency: string;
  amount: number;
}
export interface BudgetView {
  month: string;
  received: number;
  opening: number;
  cash: BudgetTotal[];
  expenses: BudgetTotal[];
  planned: BudgetTotal[];
  cash_planned: BudgetTotal[];
  breakdown: { category: string; totals: BudgetTotal[] }[];
  events: BudgetEvent[];
  targets: BudgetEvent[];
  statements: BudgetEvent[];
  installments: {
    row_id: string;
    name: string;
    kind: string;
    total: number;
    paid: number;
    remaining: number;
    paid_amount: number;
    remaining_amount: number;
    monthly_amount: number;
  }[];
  card_installments: {
    id: string;
    name: string;
    current: number;
    total: number;
    remaining: number;
    remaining_amount: number;
    currency: string;
    statement_id: string;
    card_name: string;
  }[];
  cards: {
    row_id: string;
    name: string;
    statement_id: string;
    balance: number | null;
    paid: number;
    remaining: number | null;
    overpaid: number;
  }[];
  payment_methods: { id: string; name: string; finance_card: string }[];
  review_required: boolean;
  conflicts: string[];
  issues: unknown[];
}
export const budgetService = {
  get: (month: string) => api.get<BudgetView>(`/api/budget?month=${encodeURIComponent(month)}`),
  match: (body: {
    month: string;
    target_type: string;
    target_id: string;
    statement_id: string;
    transaction_id: string;
    relation?: "same" | "different";
  }) => api.post("/api/budget/matches", body),
  unmatch: (id: string) => api.del(`/api/budget/matches/${id}`),
  plan: (body: { row_id: string; from: string; to: string; day: number; amount: number }) =>
    api.post<{ created: number }>("/api/budget/plan", body),
  template: () => api.post("/api/budget/template", {}),
  paymentMethod: (id: string, finance_card: string) =>
    api.put(`/api/data/payment_methods/${id}`, { finance_card }),
};
