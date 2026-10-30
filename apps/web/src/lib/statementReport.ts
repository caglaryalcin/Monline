import {
  normalizeMerchant,
  STATEMENT_CATEGORIES,
  type StatementCategory,
  statementCategory,
} from "./statementCategories";
import { repairStatementTransactions } from "./statementDetails";
import { statementUnitemizedFees } from "./statementReconciliation";
import { matchStatementRefunds, statementMerchantRefundGroups } from "./statementRefunds";
import type {
  ReviewTransaction,
  StatementAccountSummary,
  StatementTransaction,
} from "./statements";
import {
  type createSubscriptionMatcher,
  isStatementOnlyTransaction,
} from "./statementSubscriptions";

export function prepareFullStatement(
  rows: ReviewTransaction[],
  match: ReturnType<typeof createSubscriptionMatcher>,
) {
  return repairStatementTransactions(rows).map((row) => {
    const detected = row.kind === "charge" ? match(row.merchant) : null;
    const category = detected
      ? "digital"
      : row.category || (row.kind === "fee" ? "fees" : statementCategory(row.merchant));
    return {
      ...row,
      category,
      ...(detected
        ? { subscription_service: detected.service, subscription_match: detected.source }
        : {}),
      uncertain: row.uncertain,
    } as ReviewTransaction;
  });
}

export function statementSubscriptionRows(rows: ReviewTransaction[]) {
  const selected = rows.filter((row) => row.included);
  const { refundedChargeIds } = matchStatementRefunds(selected);
  return selected.filter(
    (row) =>
      row.kind === "charge" &&
      (row.category === "digital" || (!row.category && row.subscription_service)) &&
      !refundedChargeIds.has(row.id) &&
      !isStatementOnlyTransaction(row),
  );
}
export function reviewStatementRows(rows: ReviewTransaction[]) {
  // Recheck the display/save boundary too: an already open draft or an older
  // archive may still carry the original refund classification.
  const { pairs, unmatchedRefunds, roundingPairs, matches } = matchStatementRefunds(rows);
  const unmatchedIds = new Set(unmatchedRefunds.map((row) => row.id));
  // Keep proven individual reversals as-is. A partial/multiple refund is shown
  // as a store subtotal, without inventing an individual purchase match.
  const merchantRefundGroups = statementMerchantRefundGroups(rows)
    .filter((group) => group.refunds.some((refund) => unmatchedIds.has(refund.id)));
  const groupedRefundIds = new Set(merchantRefundGroups.flatMap((group) => group.refunds.map((row) => row.id)));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    rows,
    // Compatibility field only. Source postings are never hidden or moved to
    // excluded records just because an association was found.
    cancelledRows: [] as ReviewTransaction[],
    refunded: pairs.length,
    unmatchedRefunds: unmatchedRefunds.filter((refund) => !groupedRefundIds.has(refund.id)),
    merchantRefundGroups,
    matchedRefunds: matches.map((pair) => ({
      charge: byId.get(pair.chargeId)!,
      refund: byId.get(pair.refundId)!,
      reason: pair.reason,
      netAmount: pair.netAmount,
      originalAmount: pair.originalAmount,
      originalCurrency: pair.originalCurrency,
    })),
    roundingRefunds: roundingPairs.map((pair) => ({
      charge: byId.get(pair.chargeId)!,
      refund: byId.get(pair.refundId)!,
      netAmount: pair.netAmount,
      originalAmount: pair.originalAmount,
      originalCurrency: pair.originalCurrency,
    })),
  };
}

export interface ReportItem {
  merchant: string;
  amount: number;
  count: number;
  installment: string;
  derived?: boolean;
  feeType?: "interest" | "kkdf" | "bsmv" | "unitemized";
}
export interface ReportGroup {
  category: StatementCategory;
  currency: string;
  total: number;
  share: number;
  items: ReportItem[];
}
export function statementReport(
  rows: StatementTransaction[],
  summary: StatementAccountSummary = {},
  excluded: StatementTransaction[] = [],
): ReportGroup[] {
  const groups = new Map<
    string,
    { category: StatementCategory; currency: string; cents: number; items: Map<string, ReportItem> }
  >();
  const add = (
    category: StatementCategory,
    currency: string,
    merchant: string,
    cents: number,
    installment = "",
    feeType?: ReportItem["feeType"],
    derived = false,
  ) => {
    const key = `${category}:${currency}`;
    const group = groups.get(key) || {
      category,
      currency,
      cents: 0,
      items: new Map<string, ReportItem>(),
    };
    group.cents += cents;
    // Installments stay separate, even when their merchant descriptors match.
    const itemKey = installment
      ? `${merchant}:${group.items.size}`
      : `${normalizeMerchant(merchant)}:${feeType || ""}`;
    const previous = group.items.get(itemKey);
    group.items.set(itemKey, {
      merchant,
      installment,
      count: (previous?.count || 0) + 1,
      amount: ((previous ? Math.round(previous.amount * 100) : 0) + cents) / 100,
      ...(feeType ? { feeType } : {}),
      ...(derived ? { derived } : {}),
    });
    groups.set(key, group);
  };
  for (const row of rows) {
    if (row.kind === "repayment") continue;
    const sign = row.kind === "refund" ? -1 : 1;
    const category =
      row.category ||
      (row.subscription_service
        ? "digital"
        : row.kind === "fee"
          ? "fees"
          : statementCategory(row.merchant));
    const financing =
      row.financing && row.kind === "charge" && row.currency === "TRY" ? row.financing : undefined;
    if (financing) {
      // Keep exact accounting even if rounded source components differ by a few cents.
      const fees = ["interest", "kkdf", "bsmv"] as const;
      const financingCents = fees.reduce((sum, key) => sum + Math.round(financing[key] * 100), 0);
      add(
        category,
        row.currency,
        row.merchant,
        Math.round(row.amount * 100) - financingCents,
        row.installment,
      );
      for (const fee of fees)
        if (financing[fee])
          add("fees", row.currency, fee, Math.round(financing[fee] * 100), "", fee);
    } else
      add(
        category,
        row.currency,
        row.merchant,
        sign * Math.round(row.amount * 100),
        row.installment,
      );
  }
  const unitemized = Math.round(statementUnitemizedFees(rows, summary, excluded) * 100);
  if (unitemized > 0) add("fees", "TRY", "unitemized", unitemized, "", "unitemized", true);
  const totals = new Map<string, number>();
  for (const group of groups.values())
    totals.set(group.currency, (totals.get(group.currency) || 0) + group.cents);
  return [...groups.values()]
    .map((group) => ({
      category: group.category,
      currency: group.currency,
      total: group.cents / 100,
      share: totals.get(group.currency) ? (group.cents / totals.get(group.currency)!) * 100 : 0,
      items: [...group.items.values()].sort((a, b) => b.amount - a.amount),
    }))
    .sort(
      (a, b) =>
        STATEMENT_CATEGORIES.indexOf(a.category) - STATEMENT_CATEGORIES.indexOf(b.category) ||
        a.currency.localeCompare(b.currency),
    );
}
