import { normalizeMerchant, statementCategory } from "./statementCategories";
import { cleanStatementText } from "./statementDetails";
import { type ReportItem,statementReport } from "./statementReport";
import type { SavedStatement, StatementTransaction } from "./statements";

/** The reference Python report groups positive purchases before refunds.
 * Reclassify its original descriptions at export time, so archived defaults
 * do not freeze an older rule set. The stored statement is never modified. */
export function statementCardReport(statement: SavedStatement) {
  const rows = statement.transactions.map(cardReportTransaction);
  const groups = statementReport(rows.filter(row => row.kind !== "refund"), statement.summary, statement.excluded_transactions);
  for (const group of groups) {
    if (group.category !== "fees") continue;
    const merged = new Map<string, ReportItem>();
    for (const item of group.items) {
      const name = normalizeMerchant(item.merchant);
      const type = item.feeType || (name.includes("alisveris faizi") ? "interest" : name.includes("kkdf") ? "kkdf" : name.includes("bsmv") ? "bsmv" : undefined);
      const key = type || name;
      const previous = merged.get(key);
      merged.set(key, { ...item, ...(type ? { feeType: type } : {}),
        amount: (Math.round(item.amount * 100) + Math.round((previous?.amount || 0) * 100)) / 100,
        count: item.count + (previous?.count || 0) });
    }
    group.items = [...merged.values()].sort((a, b) => b.amount - a.amount);
  }
  const financingFees = rows.filter(row => row.kind === "charge" && row.currency === "TRY" && row.financing)
    .reduce((sum, row) => sum + (["interest", "kkdf", "bsmv"] as const).reduce((subtotal, key) => subtotal + Math.round(row.financing![key] * 100), 0), 0) / 100;
  return {
    groups,
    financingFees,
    refunds: rows.filter(row => row.kind === "refund"),
  };
}

export function cardReportTransaction(row: StatementTransaction): StatementTransaction {
  const merchant = cleanStatementText(row.merchant).replace(/\s+/g, " ").trim();
  const source = cleanStatementText(row.source || "").split(/\r?\n/)[0].replace(/\s+/g, " ").trim();
  const description = source.match(/^\d{2}[/.]\d{2}[/.]\d{4}\s+(.+?)\s+-?\s*\d[\d.,]*\s+(?:TL|TRY|USD|EUR|GBP)\s*$/)?.[1];
  // An edited merchant is authoritative. Only use a matching original source
  // to restore location/original-currency details stripped by the UI parser.
  const original = description && normalizeMerchant(description).includes(normalizeMerchant(merchant)) ? description : null;
  const cleaned = (original || merchant)
    .replace(/\([^)]*\d[\d.,]*\s+TL\)\s*\d+\/\d+/g, "")
    .replace(/\s+ISTANBUL\s+TR\b/g, "")
    .replace(/\s+/g, " ").trim();
  const label = row.installment && cleaned.endsWith(` ${row.installment}`)
    ? cleaned.slice(0, -row.installment.length).trim() : cleaned;
  return { ...row, merchant: label, category: original ? statementCategory(label) : row.category || statementCategory(label) };
}
