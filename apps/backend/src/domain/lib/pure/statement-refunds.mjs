// Shared by the PDF review and server projections. Only exact, non-installment
// purchases can cancel; installment identity is a separate association.
// Source-backed installment/FX refunds can be linked without cancelling money.
import { parseStatementOriginalAmount } from "./statement-original-amount.mjs";
export function refundMerchantName(value, source = "") {
  // Remove only an explicit country token, never the .tr part of a domain.
  const original = String(value || "").replace(/\s+tr\s*$/i, "");
  const hasDomain = /[a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?/i.test(
    original,
  );
  const name = original
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^iyzico\s*\/\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(?:iade\w*|iptal\w*|refund\w*|reversal\w*|returned|return|credit|alacak\w*)\b/g,
      " ",
    )
    .replace(/\b(?:islem|islemi|tutar|tutari|bedel|bedeli)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (hasDomain) return name.replace(/\s+istanbul(?:\s+tr)?$/, "");
  // Older parser versions removed ISTANBUL TR from purchases, but not refunds.
  // Restore that exact lost suffix only when the original PDF row proves it.
  // Keep other cities/branches distinct; an equal amount alone is not identity.
  if (name && source) {
    const originalRow = ` ${refundMerchantName(source)} `;
    if (originalRow.includes(` ${name} istanbul tr `)) return `${name} istanbul`;
  }
  return name;
}
const currencies = {
  TRY: "TRY",
  TL: "TRY",
  "₺": "TRY",
  USD: "USD",
  $: "USD",
  EUR: "EUR",
  "€": "EUR",
  GBP: "GBP",
  "£": "GBP",
};
const number = String.raw`(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d{1,3}(?:[ \u00a0\u202f\u2007]\d{3})+[,.]\d{2}|\d+[,.]\d{2})`;
const currencyPattern = String.raw`TRY|TL|₺|USD|EUR|GBP|\$|€|£`;
const postedPattern = new RegExp(
  String.raw`(?:^|\s)([+−-]?)\s*(?:(${currencyPattern})\s*)?(${number})(?:\s*(${currencyPattern}))?\s*([+−-]?)\s*(?:A|ALACAK)?\s*$`,
  "i",
);
// Every caller uses this source boundary. A confirmed correction may override
// the printed amount, but an unresolved amount issue can never auto-match.
export function statementRefundSourceSafe(row) {
  if (!row || typeof row !== "object" || !Number.isFinite(row.amount) || row.amount < 0 || row.amount > 100000000 || Math.abs(row.amount * 100 - Math.round(row.amount * 100)) > 0.00001 || !["TRY", "USD", "EUR", "GBP"].includes(row.currency)) return false;
  if (row.amount_issue != null || (row.amount_confirmed != null && typeof row.amount_confirmed !== "boolean")) return false;
  if (row.source != null && typeof row.source !== "string") return false;
  if (row.amount_confirmed === true || !row.source) return true;
  if (typeof row.source !== "string" || row.source.length > 10000 || /�|\(cid:\d+\)/.test(row.source)) return false;
  if (/\d\s*\/\s*\d+[,.]\d{2}/.test(row.source)) return false;
  const ratios = [...row.source.matchAll(/(?:^|\s)(\d{1,3})\s*\/\s*(\d{1,3})(?=\s|\)|$)/g)];
  if (ratios.length > 1 || ratios.some((match) => Number(match[1]) < 1 || Number(match[1]) > Number(match[2]))) return false;
  if (ratios.length && String(row.installment || "").replace(/\s/g, "") !== `${Number(ratios[0][1])}/${Number(ratios[0][2])}`) return false;
  const source = row.source
    .replace(/^\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*/, "")
    .replace(/\bAnapara\s*:.*$/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/(?:^|\s)\d{1,3}\s*\/\s*\d{1,3}(?=\s|$)/g, " ");
  const match = source.match(postedPattern);
  if (!match) return !/\d[,.]\d{2}/.test(source);
  if (/\d[,.]\d{2}/.test(source.slice(0, match.index)) || /\d[ \u00a0\u202f\u2007]\d{3}/.test(match[3]) || (match[1] && match[5])) return false;
  const prefix = currencies[match[2]?.toUpperCase()], suffix = currencies[match[4]?.toUpperCase()];
  if (prefix && suffix && prefix !== suffix) return false;
  const digits = match[3].replace(/[ \u00a0\u202f\u2007]/g, "");
  const cents = Number(digits.slice(0, -3).replace(/[.,]/g, "")) * 100 + Number(digits.slice(-2));
  if (!Number.isSafeInteger(cents) || cents !== Math.round(row.amount * 100) || (suffix || prefix || "TRY") !== row.currency) return false;
  const credit = /[−-]/.test(match[1] + match[5]);
  return !(credit && row.kind === "charge");
}
function sourceReference(row) {
  const groups = [...String(row.source || "").matchAll(/\(([^()]*)\)/g)]
    .map((match) => match[1])
    .filter((text) => /\d[,.]\d{2}/.test(text));
  if (!groups.length) return { valid: true, amount: null, currency: null };
  if (groups.length !== 1) return { valid: false, amount: null, currency: null };
  const reference = parseStatementOriginalAmount(groups[0]);
  return reference ? { valid: true, ...reference } : { valid: false, amount: null, currency: null };
}
function purchaseReference(row) {
  const reference = sourceReference(row);
  return {
    ...reference,
    valid: reference.valid && (reference.amount === null || reference.currency === row.currency),
  };
}
export function statementPurchaseTotal(row) {
  const ref = purchaseReference(row);
  return ref.valid &&
    ref.amount !== null &&
    Math.round(ref.amount * 100) >= Math.round(row.amount * 100)
    ? ref.amount
    : null;
}
function installment(value) {
  if (!value) return { valid: true, total: 0 };
  const ratio = String(value).match(/^\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*$/);
  return ratio && Number(ratio[1]) > 0 && Number(ratio[1]) <= Number(ratio[2])
    ? { valid: true, total: Number(ratio[2]) }
    : { valid: false, total: 0 };
}
function usable(row) {
  return (
    row &&
    typeof row.id === "string" &&
    !row.uncertain &&
    !row.amount_issue &&
    ["charge", "refund"].includes(row.kind) &&
    ["TRY", "USD", "EUR", "GBP"].includes(row.currency) &&
    typeof row.amount === "number" &&
    Number.isFinite(row.amount) &&
    row.amount > 0 &&
    row.amount <= 100000000 &&
    Math.abs(row.amount * 100 - Math.round(row.amount * 100)) < 0.00001 &&
    typeof row.date === "string" &&
    /^20\d{2}-\d{2}-\d{2}$/.test(row.date) &&
    Number.isFinite(Date.parse(row.date + "T12:00:00Z")) &&
    new Date(row.date + "T12:00:00Z").toISOString().slice(0, 10) === row.date &&
    installment(row.installment).valid &&
    sourceReference(row).valid &&
    statementRefundSourceSafe(row)
  );
}
function compatible(charge, refund) {
  const chargePlan = installment(charge.installment),
    refundPlan = installment(refund.installment);
  // A charge can say 3/3 while its refund says 2/3. Plan lengths must agree.
  // Never multiply/divide monthly amounts to infer a matching purchase total.
  if (chargePlan.total !== refundPlan.total) return false;
  const chargeRef = sourceReference(charge),
    refundRef = sourceReference(refund);
  const chargeForeign = chargeRef.amount !== null && chargeRef.currency !== charge.currency;
  const refundForeign = refundRef.amount !== null && refundRef.currency !== refund.currency;
  if (chargeForeign || refundForeign)
    return chargeForeign && refundForeign && chargeRef.currency === refundRef.currency &&
      Math.round(chargeRef.amount * 100) === Math.round(refundRef.amount * 100);
  const a = chargeRef.amount,
    b = refundRef.amount;
  if (a !== null && Math.round(a * 100) < Math.round(charge.amount * 100))
    return false;
  if (b !== null && Math.round(b * 100) < Math.round(refund.amount * 100))
    return false;
  return (
    a === null || b === null || Math.round(a * 100) === Math.round(b * 100)
  );
}
function refundAssociation(charge, refund) {
  if (!compatible(charge, refund)) return null;
  const chargeRef = sourceReference(charge),
    refundRef = sourceReference(refund);
  if (chargeRef.amount !== null && chargeRef.currency !== charge.currency)
    return { originalAmount: chargeRef.amount, originalCurrency: chargeRef.currency };
  const count = installment(charge.installment).total;
  if (count > 0 && Math.round(charge.amount * 100) === Math.round(refund.amount * 100)) return {};
  if (count < 2) return null;
  // Two explicit matching purchase totals identify the same installment plan.
  if (chargeRef.amount !== null && refundRef.amount !== null) return {};
  // With a total on only one row, the actual installments must explain it.
  // This covers a final installment that absorbs the plan's rounding balance.
  const total = chargeRef.amount ?? refundRef.amount;
  if (total === null) return null;
  const a = Math.round(charge.amount * 100), b = Math.round(refund.amount * 100);
  const totalCents = Math.round(total * 100);
  return a * (count - 1) + b === totalCents || b * (count - 1) + a === totalCents ? {} : null;
}
function proximityAssociation(charge, refund) {
  // This is only a relationship fallback. It must never cancel source money
  // or claim a whole subscription purchase was fully reversed.
  if (charge.currency !== "TRY" || charge.date >= refund.date ||
    installment(charge.installment).total !== installment(refund.installment).total) return false;
  const a = sourceReference(charge), b = sourceReference(refund);
  if (a.amount !== null && b.amount !== null &&
    (a.currency !== b.currency || Math.round(a.amount * 100) !== Math.round(b.amount * 100))) return false;
  const chargeCents = Math.round(charge.amount * 100), refundCents = Math.round(refund.amount * 100);
  return Math.abs(chargeCents - refundCents) * 100 <= chargeCents * 2;
}

// These are statement-level merchant totals, not claims that a particular
// purchase was fully reversed. Call with the source rows of ONE statement.
function merchantGroupName(row) {
  const name = refundMerchantName(row.merchant, row.source);
  const brands = [
    ["defacto", /\bdefacto\b/],
    ["ikea", /\bikea\b/],
    ["lc waikiki", /\b(?:lcw|lc waikiki|lcwaikiki)\b/],
    ["jack jones", /\bjack (?:and )?jones\b/],
    ["zara", /\bzara\b/],
    ["beymen", /\bbeymen\b/],
    ["decathlon", /\bdecathlon\b/],
    ["trendyol", /\btrendyol\b/],
    ["hepsiburada", /\bhepsiburada\b/],
    // AMAZON SPOR is a different business from amazon.com.tr.
    ["amazon.com.tr", /\bamazon com tr\b/],
    ["toyzzshop", /\b(?:toyzzshop|toyzz shop)\b/],
  ];
  const brand = brands.find(([, pattern]) => pattern.test(name));
  if (brand) return brand[0];
  // A processor without a merchant is not a store identity.
  if (/^(?:iyzico|param|moka|paytr|payment|odeme)(?: com)?$/.test(name)) return "";
  return name;
}

export function statementMerchantRefundGroups(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row?.id, (counts.get(row?.id) || 0) + 1);
  const groups = new Map();
  for (const row of rows) {
    if (!usable(row) || counts.get(row.id) !== 1) continue;
    const merchant = merchantGroupName(row);
    if (!merchant) continue;
    const id = `${row.currency}:${merchant}`;
    let group = groups.get(id);
    if (!group) {
      group = { id, merchant, currency: row.currency, charges: [], refunds: [] };
      groups.set(id, group);
    }
    group[row.kind === "refund" ? "refunds" : "charges"].push(row);
  }
  return [...groups.values()].filter((group) => group.charges.length && group.refunds.length)
    .map((group) => {
      const chargeCents = group.charges.reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
      const refundCents = group.refunds.reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
      return { ...group, chargeTotal: chargeCents / 100, refundTotal: refundCents / 100,
        netAmount: (chargeCents - refundCents) / 100 };
    });
}

export function matchStatementRefunds(rows) {
  const cancelledIds = new Set(), refundedChargeIds = new Set(), pairs = [], roundingPairs = [], matches = [], counts = new Map();
  for (const row of rows) counts.set(row?.id, (counts.get(row?.id) || 0) + 1);
  const usableRows = rows.filter((row) => usable(row) && counts.get(row.id) === 1);
  const charges = usableRows.filter((row) => row.kind === "charge");
  const refunds = usableRows.filter((row) => row.kind === "refund");
  const candidates = new Map();
  const uses = new Map();
  for (const refund of refunds) {
    const merchant = refundMerchantName(refund.merchant, refund.source);
    if (!merchant) continue;
    const sameMerchantCharges = charges.filter((charge) =>
      charge.date <= refund.date && charge.currency === refund.currency &&
      refundMerchantName(charge.merchant, charge.source) === merchant,
    );
    const compatibleCharges = sameMerchantCharges.filter((charge) => compatible(charge, refund));
    // Prefer exact posted amounts, but retain every equal candidate. No latest
    // date, array order, or merchant-only guess may break an ambiguity.
    const exact = compatibleCharges.filter((charge) => Math.round(charge.amount * 100) === Math.round(refund.amount * 100));
    const referenced = compatibleCharges.filter((charge) => refundAssociation(charge, refund) !== null);
    const possible = exact.length ? exact : referenced.length ? referenced : sameMerchantCharges.filter((charge) => proximityAssociation(charge, refund));
    candidates.set(refund.id, possible);
    for (const charge of possible) uses.set(charge.id, (uses.get(charge.id) || 0) + 1);
  }
  const matchedRefundIds = new Set();
  for (const refund of refunds) {
    const possible = candidates.get(refund.id) || [];
    if (possible.length !== 1 || uses.get(possible[0].id) !== 1) continue;
    const charge = possible[0];
    const equal = Math.round(charge.amount * 100) === Math.round(refund.amount * 100);
    const isInstallment = installment(charge.installment).total > 0;
    const reference = refundAssociation(charge, refund);
    const isProximity = !reference && (!equal || !compatible(charge, refund)) && proximityAssociation(charge, refund);
    const pair = {
      chargeId: charge.id,
      refundId: refund.id,
      netAmount: (Math.round(charge.amount * 100) - Math.round(refund.amount * 100)) / 100,
      ...(reference || {}),
    };
    const reason = isProximity ? "amount_proximity" : equal && !isInstallment ? "exact" : reference?.originalCurrency ? "foreign_currency" : "installment";
    matches.push({ ...pair, reason });
    if (equal && !isInstallment && !isProximity) {
      cancelledIds.add(charge.id);
      cancelledIds.add(refund.id);
      pairs.push({ chargeId: charge.id, refundId: refund.id });
      refundedChargeIds.add(charge.id);
    } else {
      roundingPairs.push(pair);
      // A full original-currency reversal must not become a paid subscription.
      // An installment association alone says nothing about the whole purchase.
      if (!isInstallment && reference?.originalCurrency) refundedChargeIds.add(charge.id);
    }
    matchedRefundIds.add(refund.id);
  }
  return {
    cancelledIds,
    refundedChargeIds,
    pairs,
    roundingPairs,
    matches,
    unmatchedRefunds: rows.filter(
      (row) => row?.kind === "refund" && !matchedRefundIds.has(row.id),
    ),
  };
}
