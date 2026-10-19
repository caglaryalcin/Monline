import { type ReviewTransaction, validStatementDate } from "@/lib/statements";

/** Keep the merchant identity; remove refund labels, not product/channel names. */
export function refundMerchantName(value: string) {
  return value
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(?:iade\w*|iptal\w*|refund\w*|reversal\w*|returned|return|credit|alacak\w*)\b/g,
      " ",
    )
    .replace(/\b(?:islem|islemi|tutar|tutari|bedel|bedeli)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Match full refunds within one PDF, consuming each charge/refund only once. */
export function matchStatementRefunds(rows: ReviewTransaction[]) {
  const cancelledIds = new Set<string>();
  const pending = new Map<string, ReviewTransaction[]>();
  const ordered = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.kind === "charge" || row.kind === "refund")
    .sort(
      (a, b) =>
        a.row.date.localeCompare(b.row.date) ||
        (a.row.kind === b.row.kind ? a.index - b.index : a.row.kind === "charge" ? -1 : 1),
    );

  for (const { row } of ordered) {
    // An ambiguous PDF amount must stay available for manual review.
    if (
      row.uncertain ||
      !validStatementDate(row.date) ||
      !Number.isFinite(row.amount) ||
      row.amount <= 0
    )
      continue;
    const merchant = refundMerchantName(row.merchant);
    if (!merchant) continue;
    const key = JSON.stringify([merchant, row.currency, Math.round(row.amount * 100)]);
    const charges = pending.get(key) ?? [];
    if (row.kind === "charge") {
      charges.push(row);
      pending.set(key, charges);
    } else {
      // The most recent matching charge on/before the refund date. PDF row
      // order may run backwards, and a refund may appear on a later page.
      const charge = charges.pop();
      if (charge) {
        cancelledIds.add(charge.id);
        cancelledIds.add(row.id);
      }
    }
  }
  return {
    cancelledIds,
    unmatchedRefunds: rows.filter((row) => row.kind === "refund" && !cancelledIds.has(row.id)),
  };
}
