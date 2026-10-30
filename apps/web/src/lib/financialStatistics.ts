import { isBillRecord, type SpendingData } from "./spending";

export type FinancialStatisticsSection = "loans" | "installments" | "bills";
export interface FinancialStatisticsRow {
  id: string;
  name: string;
  month: string;
  currency: string;
  amount: number;
  paid: number;
  remaining: number;
  status: "settled" | "partial" | "planned";
  card?: string;
  progress?: string;
  futureAmount?: number;
  futureCount?: number;
  installmentCurrent?: number;
  installmentTotal?: number;
}

export function financialStatisticsRows(data: SpendingData, section: FinancialStatisticsSection): FinancialStatisticsRow[] {
  if (section === "loans") return (data.loans ?? []).flatMap((loan) => loan.months.map((payment) => ({
    id: `${loan.row_id}:${payment.month}`,
    name: loan.name,
    month: payment.month,
    currency: loan.currency,
    amount: payment.amount,
    paid: payment.paid_amount,
    remaining: payment.remaining_amount,
    status: payment.status,
  })));
  if (section === "installments") return data.installments.map<FinancialStatisticsRow>((plan) => ({
    id: plan.id,
    name: plan.name,
    month: plan.period,
    currency: plan.currency,
    amount: plan.amount,
    paid: 0,
    remaining: 0,
    status: plan.remaining === 0 ? "settled" : "planned",
    card: plan.card_name,
    progress: `${plan.current} / ${plan.total}`,
    futureAmount: plan.remaining_amount,
    futureCount: plan.remaining,
    installmentCurrent: plan.current,
    installmentTotal: plan.total,
  }));
  const candidates = data.events.filter((event) => isBillRecord(event) && !event.undated);
  const ids = new Set(candidates.map((event) => event.id));
  return candidates.filter((event) => !event.duplicate_of || !ids.has(event.duplicate_of)).map<FinancialStatisticsRow>((event) => ({
    id: event.id,
    name: event.name,
    month: event.date.slice(0, 7),
    currency: event.currency,
    amount: event.amount,
    paid: event.status === "settled" ? event.amount : 0,
    remaining: event.status === "settled" ? 0 : event.amount,
    status: event.status === "settled" ? "settled" : "planned",
  }));
}

export function financialStatisticsSum(rows: FinancialStatisticsRow[], key: "amount" | "paid" | "remaining" | "futureAmount") {
  return rows.reduce((total, row) => total + Math.round((row[key] ?? 0) * 100), 0) / 100;
}
