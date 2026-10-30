import { matchStatementRefunds as matchSourceRefunds } from "../../../backend/src/domain/lib/pure/statement-refunds.mjs";
import type { ReviewTransaction } from "./statements";

export {
  refundMerchantName,
  statementMerchantRefundGroups,
  statementPurchaseTotal,
  statementRefundSourceSafe,
} from "../../../backend/src/domain/lib/pure/statement-refunds.mjs";

export function matchStatementRefunds(rows: ReviewTransaction[]) {
  const result = matchSourceRefunds(rows);
  const matchedRefunds = new Set([
    ...result.pairs.map((pair) => pair.refundId),
    ...result.roundingPairs.map((pair) => pair.refundId),
  ]);
  return {
    ...result,
    unmatchedRefunds: rows.filter(
      (row) => row.kind === "refund" && !matchedRefunds.has(row.id),
    ),
  };
}
