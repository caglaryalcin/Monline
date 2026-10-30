export interface StatementPaymentRow {
    currency: string; amount: number; kind: string;
    id?: string; date?: string; merchant?: string; installment?: string;
    source?: string; uncertain?: boolean; amount_issue?: string; page?: number;
}
export function statementSourceRows<T extends { id?: string }>(rows: T[]): T[];
export function statementPaymentTotals(
  rows: StatementPaymentRow[],
  summary?: { payments?: number },
  bank?: string,
): {
  summaryPayments: number | null;
  refundCredits: number;
  cardPayments: number | null;
  calculatedPayments: number;
  repaymentTotal: number;
  cancelledRefunds: number;
  paymentRows: Pick<StatementPaymentRow, "id" | "date" | "merchant" | "amount" | "kind" | "page">[];
};
