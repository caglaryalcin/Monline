import { parseLocalDate, toDateStr } from "@/components/calendar/types";
import {
  type FinanceData,
  type FinanceRow,
  financeRowsForYear,
  isCardPaid,
  isFinanceDeficitRow,
} from "@/lib/finance";
import { buildPaymentStatistics, type MonthlyPaymentTotal } from "@/lib/paymentStatistics";
import type { Currency, PaymentRecord, Subscription } from "@/types";

interface LedgerPaymentTotal {
  row: FinanceRow;
  amount: number;
  count: number;
  dates: string[];
}
export type StatisticsPaymentMonth = MonthlyPaymentTotal & { ledger?: LedgerPaymentTotal[] };
export interface StatisticsPaymentsData {
  paid: StatisticsPaymentMonth[];
  upcoming: StatisticsPaymentMonth[];
  income?: StatisticsPaymentMonth[];
}
export interface StatisticsPaymentItem {
  id: string;
  name: string;
  amount: number;
  count: number;
  dates?: string[];
  nextDate?: string;
  subscription?: Subscription;
  row?: FinanceRow;
}

export function statisticsPaymentItems(month: StatisticsPaymentMonth): StatisticsPaymentItem[] {
  return [
    ...month.subscriptions.map((item) => ({
      ...item,
      id: `subscription:${item.subscription.id}`,
      name: item.subscription.name,
    })),
    ...(month.ledger ?? []).map((item) => ({
      ...item,
      id: `finance:${item.row.id}`,
      name: item.row.name,
    })),
  ].sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name));
}

/** Ledger entries are saved in TRY; only existing planned entries are projected. */
export function buildFinancePaymentStatistics({
  subscriptions,
  currencies,
  records,
  ledger,
  ledgerRate,
  now,
  year,
}: {
  subscriptions: Subscription[];
  currencies: Currency[];
  records: PaymentRecord[];
  ledger?: FinanceData;
  ledgerRate: number | null;
  now: Date;
  year: number;
}): StatisticsPaymentsData {
  const rowsByYear = new Map<number, Map<string, FinanceRow>>();
  const rowForEntry = (rowId: string, date: string) => {
    const entryYear = Number(date.slice(0, 4));
    let rows = rowsByYear.get(entryYear);
    if (!rows) {
      rows = new Map(
        financeRowsForYear(ledger?.finance_rows ?? [], entryYear, ledger).map((row) => [
          row.id,
          row,
        ]),
      );
      rowsByYear.set(entryYear, rows);
    }
    return rows.get(rowId);
  };
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const represented = new Set<string>();
  for (const entry of ledger?.finance_entries ?? []) {
    const row = rowForEntry(entry.row_id, entry.date);
    if (!row || isFinanceDeficitRow(row) || !Number.isFinite(entry.amount)) continue;
    const record = recordsById.get(entry.source_payment ?? "");
    const subscription = record?.subscription_id || row.source_subscription;
    if (!subscription) continue;
    // A moved or early-settled ledger charge replaces its original occurrence too.
    for (const date of [entry.date, record?.due_date, record?.scheduled_date]) {
      const parsed = date && parseLocalDate(date);
      if (parsed) represented.add(`${subscription}:${toDateStr(parsed)}`);
    }
  }
  const payments = buildPaymentStatistics(
    subscriptions,
    currencies,
    records,
    now,
    12,
    12,
    year,
    (subscription, date) => represented.has(`${subscription.id}:${date}`),
  );
  const upcoming: StatisticsPaymentMonth[] = payments.upcoming.map((month) => ({
    ...month,
    ledger: [],
  }));
  const income: StatisticsPaymentMonth[] = upcoming.map((month) => ({
    name: month.name,
    total: 0,
    count: 0,
    unpricedCount: 0,
    subscriptions: [],
    ledger: [],
  }));
  const today = toDateStr(now);
  const validRate = ledgerRate !== null && Number.isFinite(ledgerRate) && ledgerRate > 0;
  for (const entry of ledger?.finance_entries ?? []) {
    const parsed = parseLocalDate(entry.date);
    if (!parsed || entry.bill_skip || entry.status !== "planned" || !Number.isFinite(entry.amount)) continue;
    const date = toDateStr(parsed);
    if (date < today || parsed.getFullYear() !== year) continue;
    const row = rowForEntry(entry.row_id, date);
    if (!row || isFinanceDeficitRow(row) || (row.kind === "expense" && isCardPaid(entry, row)))
      continue;
    const month = (row.kind === "expense" ? upcoming : income)[parsed.getMonth()];
    if (!validRate) {
      month.unpricedCount++;
      continue;
    }
    const amount = entry.amount;
    const detail = month.ledger!.find((item) => item.row.id === row.id);
    if (detail) {
      detail.amount = Math.round((detail.amount + amount) * 100) / 100;
      detail.count++;
      detail.dates.push(date);
    } else month.ledger!.push({ row, amount, count: 1, dates: [date] });
    month.count++;
  }
  for (const month of [...upcoming, ...income]) {
    // Sum stored cents before converting, as the ledger's monthly totals do.
    const storedTotal =
      (month.ledger ?? []).reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
    if (validRate) month.total = Math.round((month.total + storedTotal * ledgerRate!) * 100) / 100;
    for (const item of month.ledger ?? []) {
      item.amount = Math.round(item.amount * ledgerRate! * 100) / 100;
      item.dates.sort();
    }
  }
  return { paid: payments.paid, upcoming, income };
}
