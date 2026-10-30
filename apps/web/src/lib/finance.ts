export type FinanceKind = "salary" | "income" | "expense";
export const BILL_TYPES = ["electricity", "water", "internet", "gas", "mobile"] as const;
export type BillType = (typeof BILL_TYPES)[number];
export const ROW_TAGS = ["", "credit_card", "loan", "rent", ...BILL_TYPES] as const;
export type ExpenseRowTag = (typeof ROW_TAGS)[number];
export const INCOME_ROW_TAGS = ["", "salary"] as const;
export type FinanceRowTagValue = ExpenseRowTag | "salary";
export interface FinanceRow {
  id: string;
  name: string;
  kind: FinanceKind;
  expense_type?: "" | "credit_card";
  bill_type?: "" | BillType;
  is_loan?: boolean;
  is_rent?: boolean;
  is_auto_carryover?: boolean;
  loan_id?: string;
  payment_card?: string;
  notes: string;
  row_order?: number;
  source_subscription?: string;
  year?: number;
  origin_row?: string;
  is_deleted?: boolean;
}
export function financeRowsForYear(rows: FinanceRow[], year: number, data: Partial<FinanceData> = {}) {
  const active = new Set(rows.filter((row) => !row.is_deleted && row.year === year).map((row) => row.id));
  for (const record of data.finance_entries || [])
    if (Number(record.date.slice(0, 4)) === year) active.add(record.row_id);
  for (const records of [data.finance_statement_links, data.finance_card_transactions])
    for (const record of records || [])
      if (Number(record.month.slice(0, 4)) === year) active.add(record.row_id);
  for (const row of rows)
    if (active.has(row.id) && row.payment_card) active.add(row.payment_card);
  const forks = new Set(rows.filter((row) => row.year === year && row.origin_row).map((row) => row.origin_row));
  const visible = rows.filter((row) => !row.is_deleted &&
    (row.year === year || (!row.year && !forks.has(row.id) && (row.is_auto_carryover || active.has(row.id)))));
  const all = new Map(rows.map((row) => [row.id, row]));
  const cards = new Map(visible.map((row) => [row.origin_row || row.id, row.id]));
  return visible.map((row) => {
    const card = all.get(row.payment_card || "");
    return { ...row, payment_card: row.payment_card ? cards.get(card?.origin_row || card?.id || row.payment_card) || row.payment_card : "" };
  }).sort((a, b) => Number(!!a.is_auto_carryover) - Number(!!b.is_auto_carryover) || (a.row_order || 0) - (b.row_order || 0));
}
export function isFinanceCarryoverRow(row: FinanceRow) {
  return row.kind === "expense" && row.is_auto_carryover === true;
}
export function financeStartYear(data: FinanceData) {
  const rows = new Map(data.finance_rows.filter((row) => !row.is_deleted).map((row) => [row.id, row]));
  const years = data.finance_rows
    .filter((row) => !row.is_deleted && !isFinanceCarryoverRow(row) && row.year)
    .map((row) => row.year!);
  for (const entry of data.finance_entries)
    if (rows.has(entry.row_id)) years.push(Number(entry.date.slice(0, 4)));
  for (const records of [data.finance_statement_links, data.finance_card_transactions])
    for (const record of records || [])
      if (rows.has(record.row_id)) years.push(Number(record.month.slice(0, 4)));
  const valid = years.filter((year) => Number.isInteger(year) && year >= 1970 && year <= 2200);
  return valid.length ? Math.min(...valid) : null;
}
// Preserve historical opening-balance calculations for old manually entered
// deficit rows. Their names do not make them protected system rows.
export function isFinanceDeficitRow(row: FinanceRow) {
  const name = row.name
    .normalize("NFD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim();
  return isFinanceCarryoverRow(row) || (row.kind === "expense" && name === "onceki ay eksi");
}
// Keep existing saved cards and bill/loan tags compatible with one UI selector.
export function financeRowTag(row?: FinanceRow): FinanceRowTagValue {
  if (row?.kind === "salary") return "salary";
  if (row?.kind !== "expense") return "";
  return row.expense_type === "credit_card"
    ? "credit_card"
    : row.is_loan
      ? "loan"
      : row.is_rent
        ? "rent"
        : row.bill_type || "";
}
export function financeRowTagValues(tag: ExpenseRowTag) {
  return {
    expense_type: tag === "credit_card" ? ("credit_card" as const) : ("" as const),
    is_loan: tag === "loan",
    is_rent: tag === "rent",
    bill_type: BILL_TYPES.includes(tag as BillType) ? (tag as BillType) : ("" as const),
  };
}
export interface FinanceEntry {
  id: string;
  row_id: string;
  date: string;
  amount: number;
  status: "planned" | "settled";
  settled_date: string;
  notes: string;
  source_payment?: string;
  payment_tag?: "" | "credit_card" | "direct";
}
export interface SalaryChange {
  id: string;
  effective_date: string;
  amount: number;
  notes: string;
}
export interface FinanceBenchmark {
  id: string;
  month: string;
  usd: number;
  eur: number;
  minimum_wage: number;
  rate_date: string;
  source: string;
  updated_at: string;
  salary_tag?: "" | SalaryTag;
}
export const SALARY_TAGS = ["job_change", "raise", "seniority_raise", "seniority_inflation_raise"] as const;
export type SalaryTag = (typeof SALARY_TAGS)[number];
export interface FinanceData {
  card_payment_checks?: Record<string, CardPaymentCheck>;
  entry_verifications?: Record<string, "verified" | "changed">;
  finance_rows: FinanceRow[];
  finance_entries: FinanceEntry[];
  salary_history: SalaryChange[];
  finance_benchmarks: FinanceBenchmark[];
  finance_card_transactions?: FinanceCardTransaction[];
  finance_statement_links?: FinanceStatementLink[];
}
export interface CardPaymentCheck {
  status: "matched" | "mismatch" | "missing_card" | "missing_ledger" | "unpaid_ledger" | "missing_statement_payments" | "multiple_payment_months" | "incomplete_statement";
  ledger_month: string;
  payment_months?: string[];
  statement_month: string;
  ledger_row_id: string;
  ledger_row_name: string;
  ledger_amount: number | null;
  statement_payments: number | null;
  statement_refunds?: number;
  statement_card_payments?: number | null;
  difference: number | null;
  pending_amount: number;
  pending_count: number;
}
export interface FinanceStatementLink {
  id: string;
  row_id: string;
  month: string;
  statement_id: string;
}
export interface FinanceCardTransaction {
  id: string;
  row_id: string;
  month: string;
  date: string;
  merchant: string;
  amount: number;
  notes: string;
}
export const cents = (amount: number) => Math.round(amount * 100);
export function sumEntries(entries: FinanceEntry[]) {
  return entries.reduce((sum, entry) => sum + cents(entry.amount), 0) / 100;
}
export function canTagPayment(row: FinanceRow) {
  return row.kind === "expense" && row.expense_type !== "credit_card";
}
export function isCardPaid(entry: FinanceEntry, row: FinanceRow) {
  return (
    canTagPayment(row) &&
    (entry.payment_tag === "credit_card" || (entry.payment_tag !== "direct" && !!row.payment_card))
  );
}
export function financeMonths(data: FinanceData, year: number) {
  const activeRows = data.finance_rows.filter((row) => !row.is_deleted);
  const rows = new Map(activeRows.map((row) => [row.id, row]));
  const carryoverRows = new Set(activeRows.filter(isFinanceDeficitRow).map((row) => row.id));
  const entriesByMonth = new Map<string, FinanceEntry[]>();
  for (const entry of data.finance_entries) {
    const month = entry.date.slice(0, 7);
    if (!rows.has(entry.row_id) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) continue;
    const entries = entriesByMonth.get(month) ?? [];
    entries.push(entry);
    entriesByMonth.set(month, entries);
  }
  const amountsForMonth = (month: string) => {
    const entries = entriesByMonth.get(month) ?? [];
    const income = entries.filter(
      (entry) => rows.get(entry.row_id)?.kind !== "expense" && rows.has(entry.row_id),
    );
    const expense = entries.filter((entry) => {
      const row = rows.get(entry.row_id);
      return row?.kind === "expense" && !carryoverRows.has(row.id) && !isCardPaid(entry, row);
    });
    const received = sumEntries(income.filter((entry) => entry.status === "settled"));
    const expected = sumEntries(income.filter((entry) => entry.status === "planned"));
    const paid = sumEntries(expense.filter((entry) => entry.status === "settled"));
    const pending = sumEntries(expense.filter((entry) => entry.status === "planned"));
    return { received, expected, paid, pending };
  };
  let previousRemaining = 0;
  const firstPeriod = [...entriesByMonth.entries()].sort(([left], [right]) => left.localeCompare(right))[0];
  const firstMonth = firstPeriod?.[0];
  // Preserve an existing opening balance when there is no earlier ledger history.
  const manualOpening = firstPeriod && carryoverRows.size
    ? Math.abs(sumEntries(firstPeriod[1].filter(
        (entry) => carryoverRows.has(entry.row_id),
      )))
    : 0;
  const carriedAmount = (month: string) => Math.max(
    0,
    -previousRemaining,
    month === firstMonth ? cents(manualOpening) : 0,
  );
  // Empty months preserve a deficit; positive balances are not carried forward.
  for (const month of [...entriesByMonth.keys()].filter((month) => month < `${year}-01`).sort()) {
    const amounts = amountsForMonth(month);
    previousRemaining = cents(amounts.received) - cents(amounts.paid) - carriedAmount(month);
  }
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const amounts = amountsForMonth(month);
    const carryover = carriedAmount(month);
    previousRemaining = cents(amounts.received) - cents(amounts.paid) - carryover;
    return {
      month,
      ...amounts,
      carryover: carryover / 100,
      openingCarryover: index === 0 ? carryover / 100 : month === firstMonth ? manualOpening : 0,
      remaining: previousRemaining / 100,
      forecast:
        (previousRemaining + cents(amounts.expected) - cents(amounts.pending)) / 100,
    };
  });
}
export function salaryAt(changes: SalaryChange[], date: string) {
  return (
    [...changes]
      .filter((change) => change.effective_date <= date)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0]?.amount ?? null
  );
}
export const percentChange = (value: number | null, previous: number | null) =>
  value != null && previous != null && previous > 0 ? (value / previous - 1) * 100 : null;
export function salaryAnalysis(data: FinanceData, year: number) {
  const salaryRows = new Set(financeRowsForYear(data.finance_rows, year, data).filter((row) => row.kind === "salary").map((row) => row.id));
  const monthlyEntries = new Map<string, FinanceEntry[]>();
  for (const entry of data.finance_entries) {
    if (!salaryRows.has(entry.row_id) || !entry.date.startsWith(`${year}-`)) continue;
    const month = entry.date.slice(0, 7);
    const records = monthlyEntries.get(month) || [];
    records.push(entry);
    monthlyEntries.set(month, records);
  }
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const records = monthlyEntries.get(month) || [];
    const salary = records.length ? sumEntries(records) : null;
    const reference = data.finance_benchmarks.find((item) => item.month === month);
    return {
      month,
      salary,
      received: sumEntries(records.filter((entry) => entry.status === "settled")),
      status: !records.length ? null : records.every((entry) => entry.status === "settled") ? "settled" as const
        : records.every((entry) => entry.status === "planned") ? "planned" as const : "partial" as const,
      usd: salary != null && reference?.usd ? salary / reference.usd : null,
      eur: salary != null && reference?.eur ? salary / reference.eur : null,
      minimum: salary != null && reference?.minimum_wage ? salary / reference.minimum_wage : null,
      reference,
    };
  });
}
