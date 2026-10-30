import type { BillType } from "@/lib/finance";
import { createSubscriptionMatcher } from "@/lib/statementSubscriptions";
import type { PaymentRecord, Subscription } from "@/types";

export interface SpendingEvent {
  id: string;
  date: string;
  name: string;
  amount: number;
  currency: string;
  source: "statement" | "ledger" | "manual_card" | "manual_bill";
  kind: "expense" | "refund" | "card_payment" | "carryover" | "loan_payment";
  duplicate_of?: string;
  verification?: "verified" | "changed";
  verified_statement_id?: string;
  status: "recorded" | "settled" | "planned";
  settled_date?: string;
  counts_as_expense: boolean;
  bill: boolean;
  bill_type?: BillType | "";
  statement_id?: string;
  statement_period?: string;
  category?: string;
  installment?: string;
  card_name?: string;
  card_row_id?: string;
  card_paid?: boolean;
  source_key?: string;
  payment_record_id?: string;
  notes?: string;
  row_id?: string;
  provider_row_id?: string;
  manual_bill_id?: string;
  undated?: boolean;
}
export function isBillRecord(event: SpendingEvent) {
  return (
    event.bill &&
    (event.source === "manual_bill" || (event.source === "ledger" && !!event.bill_type))
  );
}
export interface InstallmentPlan {
  id: string;
  name: string;
  currency: string;
  amount: number;
  total_amount?: number | null;
  remaining: number;
  remaining_amount: number;
  current: number;
  total: number;
  date: string;
  period: string;
  next_month: string;
  statement_id: string;
  card_name: string;
  row_id: string;
}
export interface LoanMonth {
  month: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: "settled" | "partial" | "planned";
}
export interface LoanSummary {
  row_id: string;
  name: string;
  start_month?: string | null;
  end_month?: string | null;
  currency: string;
  total_installments: number;
  paid_installments: number;
  remaining_installments: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  months: LoanMonth[];
}
export interface SpendingData {
  statement_months?: string[];
  loans?: LoanSummary[];
  tracked_statements_count?: number;
  imported_payments_count?: number;
  calendar_moves?: {
    source: SpendingEvent["source"];
    source_id: string;
    source_date: string;
    date: string;
  }[];
  events: SpendingEvent[];
  installments: InstallmentPlan[];
  issues: { statement_id: string; row_id: string }[];
  unmatched_installments: string[];
}
export const EMPTY_SPENDING: SpendingData = {
  loans: [],
  events: [],
  installments: [],
  issues: [],
  unmatched_installments: [],
};
export const spendingKey = (userId: string) => ["spending", userId] as const;
export function currentSpendingMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}`;
}
export function estimatedInstallmentTotal(plan: InstallmentPlan) {
  if (plan.total_amount !== undefined) return plan.total_amount;
  const cents = Math.round(plan.amount * 100) * plan.total;
  return Number.isSafeInteger(cents) ? cents / 100 : null;
}
export function spendingTotals(items: { amount: number; currency: string }[]) {
  const totals = new Map<string, number>();
  for (const item of items)
    totals.set(item.currency, (totals.get(item.currency) || 0) + Math.round(item.amount * 100));
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, cents]) => ({ currency, amount: cents / 100 }));
}
export function uncoveredSpending(
  events: SpendingEvent[],
  records: PaymentRecord[],
  subscriptions: Subscription[],
) {
  const ids = new Set(
    subscriptions.filter((sub) => sub.record_type !== "credit").map((sub) => sub.id),
  );
  const paid = records.filter(
    (record) =>
      record.paid_at &&
      (ids.has(record.subscription_id) || (!record.subscription_id && record.name)),
  );
  const sources = new Set(paid.flatMap((record) => record.statement_sources || []));
  const paymentIds = new Set(paid.map((record) => record.id));
  return events.filter(
    (event) =>
      event.kind !== "carryover" &&
      !(event.source === "statement" && event.kind === "card_payment") &&
      !event.duplicate_of &&
      !(event.source_key && sources.has(event.source_key)) &&
      !(event.payment_record_id && paymentIds.has(event.payment_record_id)),
  );
}
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const matchOnline = createSubscriptionMatcher([]);
export function subscriptionSection(
  sub: Subscription,
): "online" | "installments" | "bills" | "other" {
  if (sub.record_type === "credit") return "other";
  if ((sub.payment_limit || 0) > 1) return "installments";
  const category = sub.expand?.category;
  if (
    category?.translation_key === "statement_bills" ||
    /\b(?:bedas|bogazici|elektrik|electricity|igdas|iski|dogalgaz|turkcell|vodafone|turk telekom|turknet|superonline|internet|fatura|bills|rechnungen)\b/.test(
      normalize(`${sub.name} ${category?.name || ""}`),
    )
  )
    return "bills";
  if (
    sub.statement_imported ||
    /\b(?:digital|dijital|abonnements|subscriptions|ai|video|streaming|browsing|gaming|music|muzik|cloud storage|software|yazilim|communication|news)\b/.test(
      normalize(category?.name || ""),
    ) ||
    /^(?:category_default_)(?:ai|video|streaming|browsing|gaming|music|cloud_storage|software|communication|news)$/.test(
      category?.translation_key || "",
    ) ||
    category?.translation_key === "statement_digital" ||
    matchOnline(sub.name)
  )
    return "online";
  return "other";
}
