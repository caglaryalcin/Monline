export interface RefundRow {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  kind: string;
  installment: string;
  source?: string;
  uncertain?: boolean;
  amount_issue?: string;
  amount_confirmed?: boolean;
}
export interface RefundMatch {
  chargeId: string;
  refundId: string;
  netAmount: number;
  reason: "exact" | "foreign_currency" | "installment" | "amount_proximity";
  originalAmount?: number;
  originalCurrency?: string;
}
export function statementRefundSourceSafe(
  row: Pick<RefundRow, "amount" | "currency" | "kind"> & Partial<Pick<RefundRow, "source" | "installment" | "amount_issue" | "amount_confirmed">>,
): boolean;
export function refundMerchantName(value: string, source?: string): string;
export interface MerchantRefundGroup<T extends RefundRow = RefundRow> {
  id: string;
  merchant: string;
  currency: string;
  charges: T[];
  refunds: T[];
  chargeTotal: number;
  refundTotal: number;
  netAmount: number;
}
/** Aggregate source rows from a single statement, without changing their amounts. */
export function statementMerchantRefundGroups<T extends RefundRow>(rows: T[]): MerchantRefundGroup<T>[];
export function statementPurchaseTotal(
  row: Pick<RefundRow, "source" | "currency" | "amount">,
): number | null;
export function matchStatementRefunds<T extends RefundRow>(
  rows: T[],
): {
  cancelledIds: Set<string>;
  refundedChargeIds: Set<string>;
  matches: RefundMatch[];
  pairs: { chargeId: string; refundId: string }[];
  roundingPairs: {
    chargeId: string;
    refundId: string;
    netAmount: number;
    originalAmount?: number;
    originalCurrency?: string;
  }[];
  unmatchedRefunds: T[];
};
