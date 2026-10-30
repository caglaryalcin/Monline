import { api } from "@/lib/api";
import type { CardPaymentCheck, FinanceBenchmark, FinanceCardTransaction, FinanceData, FinanceEntry, FinanceRow, FinanceRowTagValue, FinanceStatementLink, SalaryTag } from "@/lib/finance";
import type { PastedCell, PastedRow } from "@/lib/financeClipboard";

export type FinanceCellSnapshot = {
  row_id: string;
  month: string;
  entries: FinanceEntry[];
  statement_link: Pick<FinanceStatementLink, "id" | "statement_id"> | null;
};
type FinanceProof = { id: string; target_type: string; target_id: string; statement_id: string; transaction_id: string; fingerprint: string; relation: string };
type FinanceCalendarMove = { id: string; source: string; source_id: string; source_date: string; date: string };

export type FinanceHistory = {
  before: (Required<Omit<FinanceEntry, "payment_tag">> & Pick<FinanceEntry, "payment_tag">)[];
  after: (Required<Omit<FinanceEntry, "payment_tag">> & Pick<FinanceEntry, "payment_tag">)[];
  rows?: {
    before: (Required<Omit<FinanceRow, "payment_card" | "bill_type" | "row_order" | "is_loan" | "is_rent" | "is_auto_carryover" | "loan_id" | "year" | "origin_row" | "is_deleted">> &
      Pick<FinanceRow, "payment_card" | "bill_type" | "row_order" | "is_loan" | "is_rent" | "is_auto_carryover" | "loan_id" | "year" | "origin_row" | "is_deleted">)[];
    after: (Required<Omit<FinanceRow, "payment_card" | "bill_type" | "row_order" | "is_loan" | "is_rent" | "is_auto_carryover" | "loan_id" | "year" | "origin_row" | "is_deleted">> &
      Pick<FinanceRow, "payment_card" | "bill_type" | "row_order" | "is_loan" | "is_rent" | "is_auto_carryover" | "loan_id" | "year" | "origin_row" | "is_deleted">)[];
  };
  transactions?: { before: FinanceCardTransaction[]; after: FinanceCardTransaction[] };
  links?: { before: FinanceStatementLink[]; after: FinanceStatementLink[] };
  matches?: { before: FinanceProof[]; after: FinanceProof[] };
  moves?: { before: FinanceCalendarMove[]; after: FinanceCalendarMove[] };
};
export const financeService = {
  checkCardPayment: (row_id: string, statement_id: string) =>
    api.post<CardPaymentCheck>("/api/finance/card-payment-check", { row_id, statement_id }),
  setOpeningDeficit: (year: number, amount: number | null, expected_amount: number) =>
    api.post<{ history: FinanceHistory }>("/api/finance/opening-deficit", { year, amount, expected_amount }),
  setSalaryTag: (month: string, tag: SalaryTag | "") =>
    api.post<{ month: string; salary_tag: SalaryTag | "" }>("/api/finance/salary-tag", { month, tag }),
  removeRows: (year: number, row_ids: string[]) =>
    api.post<{ deleted_rows: number; history: FinanceHistory }>("/api/finance/rows/delete", { year, row_ids }),
  tagRows: (year: number, rows: { id: string; tag: FinanceRowTagValue }[], tag: FinanceRowTagValue) =>
    api.post<{ tagged_rows: number; history: FinanceHistory }>("/api/finance/rows/tag", { year, rows, tag }),
  cellAction: (action: "clear" | "move", cells: FinanceCellSnapshot[], targets?: FinanceCellSnapshot[]) =>
    api.post<{ updated: number; history: FinanceHistory }>("/api/finance/cells/action", { action, cells, ...(targets ? { targets } : {}) }),
  rowAction: (
    row_id: string,
    action: "insert_above" | "insert_below" | "move_up" | "move_down",
    expected_order: string[],
    values?: Partial<FinanceRow>,
    year?: number,
  ) =>
    api.post<{ changed: boolean; row?: FinanceRow; history: FinanceHistory }>(
      "/api/finance/rows/action",
      { row_id, action, expected_order, year: year ?? values?.year, ...(values ? { values } : {}) },
    ),
  get: () => api.get<FinanceData>("/api/finance"),
  pasteCells: (year: number, cells: PastedCell[], rows?: PastedRow[]) =>
    api.post<{ updated: number; history?: FinanceHistory }>("/api/finance/cells", {
      year,
      cells,
      ...(rows ? { rows } : {}),
    }),
  restore: (history: FinanceHistory) =>
    api.post<{ history: FinanceHistory }>("/api/finance/restore", history),
  save: (collection: keyof FinanceData, body: unknown, id?: string, year?: number) => {
    const values = collection === "finance_rows" && year !== undefined ? { ...(body as Partial<FinanceRow>), year } : body;
    return id ? api.put(`/api/finance/${collection}/${id}`, values) : api.post(`/api/finance/${collection}`, values);
  },
  remove: (collection: keyof FinanceData, id: string, year?: number) =>
    api.del(`/api/finance/${collection}/${id}${collection === "finance_rows" && year ? `?year=${year}` : ""}`),
  plan: (body: unknown) => api.post<{ created: number }>("/api/finance/plan", body),
  rates: (month: string) => api.post<FinanceBenchmark & { missing: ("rates" | "minimum_wage")[] }>("/api/finance/rates", { month }, { timeoutMs: 60000 }),
  ratesYear: (year: number) =>
    api.post<{ updated: number; failed: number; partial: number; unchanged: boolean }>(
      "/api/finance/rates-year",
      { year },
      { timeoutMs: 240000 },
    ),
  salaryPlan: (year: number, row_id: string, name: string) =>
    api.post<{ created: number }>("/api/finance/salary-plan", { year, row_id, name }),
};
