import { parseStatementOriginalAmount } from "../../../backend/src/domain/lib/pure/statement-original-amount.mjs";

export type StatementAmountIssue =
  "joined_installment" | "invalid_amount" | "multiple_amounts" | "installment_total";
const NUMBER = String.raw`(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d{1,3}(?:[ \u00a0\u202f\u2007]\d{3})+[,.]\d{2}|\d+[,.]\d{2})`;
const CURRENCY = String.raw`TRY|TL|₺|USD|EUR|GBP|\$|€|£`;
const TOKEN = new RegExp(
  String.raw`[+−-]?\s*(?:(?:${CURRENCY})\s*)?${NUMBER}(?:\s*(?:${CURRENCY}))?(?:\s*[+−-])?`,
  "gi",
);
export function parseStatementAmount(value: string) {
  const token = value.trim();
  const match = token.match(
    new RegExp(
      String.raw`^([+−-]?)\s*(?:(${CURRENCY})\s*)?(${NUMBER})(?:\s*(${CURRENCY}))?\s*([+−-]?)$`,
      "i",
    ),
  );
  if (!match || (match[1] && match[5])) return null;
  const number = match[3].replace(/[ \u00a0\u202f\u2007]/g, "");
  const [whole, fraction] = [number.slice(0, -3).replace(/[.,]/g, ""), number.slice(-2)];
  // NUMBER already requires one decimal separator followed by exactly two digits.
  const cents = Number(whole) * 100 + Number(fraction);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 10000000000) return null;
  const code = (match[4] || match[2] || "TRY").toUpperCase();
  const currency = ["TL", "₺"].includes(code)
    ? "TRY"
    : code === "$"
      ? "USD"
      : code === "€"
        ? "EUR"
        : code === "£"
          ? "GBP"
          : code;
  const prefix = (match[2] || "").toUpperCase();
  const normalizeCode = (value: string) =>
    ["TL", "₺"].includes(value)
      ? "TRY"
      : value === "$"
        ? "USD"
        : value === "€"
          ? "EUR"
          : value === "£"
            ? "GBP"
            : value;
  if (prefix && normalizeCode(prefix) !== currency) return null;
  return { amount: cents / 100, currency, credit: /[-−]/.test(match[1] + match[5]) };
}
export function statementAmountTokens(text: string) {
  const result: {
    text: string;
    start: number;
    end: number;
    parenthesized: boolean;
    amount: number;
    currency: string;
    credit: boolean;
  }[] = [];
  // Broader original currencies are accepted only inside explicit monetary
  // parentheses. The posted ledger currency support remains unchanged.
  let tokenText = text;
  for (const group of text.matchAll(/\(([^()]*)\)/g)) {
    const original = parseStatementOriginalAmount(group[1]);
    if (!original || ["TRY", "USD", "EUR", "GBP"].includes(original.currency)) continue;
    const start = group.index! + 1, end = start + group[1].length;
    result.push({ text: group[1].trim(), start, end, parenthesized: true, ...original, credit: false });
    tokenText = tokenText.slice(0, start) + " ".repeat(end - start) + tokenText.slice(end);
  }
  const pattern = new RegExp(TOKEN.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tokenText))) {
    const start = match.index,
      end = start + match[0].length;
    const leading = match[0].length - match[0].trimStart().length;
    const prefix = text.slice(0, start + leading);
    const before = prefix.trimEnd().slice(-1),
      directBefore = prefix.slice(-1);
    const after = text[end] || "";
    const adjacentNumber = /[\d.,/]/.test(directBefore);
    const insideIdentifier =
      /[\p{L}_#$€£₺]/u.test(directBefore) || /(?:^|\s)\S*\p{L}\S*[-_]$/u.test(prefix);
    // A merchant abbreviation may end with punctuation before the amount
    // column (GETIR., GM., A. .). Only allow it after letters and whitespace;
    // split numeric fragments such as "5. 28,45" must still be rejected.
    const merchantPunctuation = /(?:^|\s)\S*\p{L}\S*[.,/:](?:\s*[.,/:])*\s+$/u.test(prefix);
    const creditMarker = /^(?:a|alacak)(?:\s|$)/i.test(text.slice(end));
    const unsupportedSign = /[‐‑‒–—﹣－＋]\s*$/.test(prefix);
    const percentage = /%\s*$/.test(prefix) || /^\s*%/.test(text.slice(end));
    const brokenBoundary =
      (/[.,/:]/.test(before) && !merchantPunctuation) ||
      adjacentNumber ||
      insideIdentifier ||
      unsupportedSign ||
      percentage ||
      (/[\d.,/\p{L}]/u.test(after) && !creditMarker);
    const value = brokenBoundary ? null : parseStatementAmount(match[0]);
    if (!value) {
      // Do not retry inside a complete but invalid monetary token (for example,
      // conflicting USD/TL labels) and silently drop its prefix currency.
      if (brokenBoundary) pattern.lastIndex = start + leading + 1;
      continue;
    }
    const rawPrefix = text.slice(0, start);
    result.push({
      text: match[0].trim(),
      start,
      end,
      parenthesized: rawPrefix.lastIndexOf("(") > rawPrefix.lastIndexOf(")"),
      ...value,
    });
  }
  return result.sort((a, b) => a.start - b.start);
}

// Percentages describe rates, never posted money. Preserve character offsets
// so callers can still point to the original PDF amount/source columns.
export function maskStatementPercentages(text: string) {
  return text.replace(
    /(?:%\s*[+−-]?\d+(?:[.,]\d+)?|[+−-]?\d+(?:[.,]\d+)?\s*%)/g,
    (value) => " ".repeat(value.length),
  );
}

export function statementInstallment(text: string) {
  const matches = [...text.matchAll(/(?:^|\s)(\d{1,3})\s*\/\s*(\d{1,3})(?=\s|\)|$)/g)];
  const valid = matches.filter(
    (match) => Number(match[1]) > 0 && Number(match[1]) <= Number(match[2]),
  );
  let masked = text;
  for (const match of valid)
    masked =
      masked.slice(0, match.index) +
      " ".repeat(match[0].length) +
      masked.slice(match.index! + match[0].length);
  const joined =
    /\d\s*\/\s*\d+[,.]\d{2}/.test(text) || matches.length !== valid.length || valid.length > 1;
  return {
    masked,
    installment: valid.length === 1 ? `${Number(valid[0][1])}/${Number(valid[0][2])}` : "",
    joined,
  };
}
export function validStatementInstallment(value: string) {
  if (!value.includes("/")) return true;
  const match = value.match(/^\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*$/);
  return !!match && Number(match[1]) > 0 && Number(match[1]) <= Number(match[2]);
}
export function statementSourceIssue(row: {
  source?: string;
  installment: string;
  amount: number;
  currency: string;
  amount_confirmed?: boolean;
}): StatementAmountIssue | undefined {
  if (!row.source || row.amount_confirmed) return;
  const source = row.source
    .replace(/^\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*/, "")
    .replace(/\bAnapara\s*:.*$/i, "");
  const info = statementInstallment(source);
  if (info.joined) return "joined_installment";
  const tokens = statementAmountTokens(info.masked);
  const outside = tokens.filter((token) => !token.parenthesized);
  const totals = tokens.filter((token) => token.parenthesized && token.currency === row.currency);
  if (
    row.installment &&
    totals.length === 1 &&
    Math.round(row.amount * 100) > Math.round(totals[0].amount * 100)
  )
    return "installment_total";
  if (outside.length > 1) return "multiple_amounts";
  if (outside.length === 1 && /\d \d{3}(?:[,.]| )/.test(outside[0].text)) return "multiple_amounts";
  if (!outside.length && /\d+[,.]\d/.test(source.replace(/\([^)]*\)/g, "")))
    return "invalid_amount";
  if (
    outside.length === 1 &&
    (Math.round(outside[0].amount * 100) !== Math.round(row.amount * 100) ||
      outside[0].currency !== row.currency)
  )
    return "invalid_amount";
}

// Only an explicit PDF fragment boundary can justify separating two numbers.
export function joinStatementFragments(
  items: { text: string; x: number; width: number; height: number }[],
) {
  let text = "";
  for (const [index, item] of items.entries()) {
    const previous = items[index - 1];
    const gap = previous ? item.x - previous.x - previous.width : 0;
    const installmentBoundary =
      /(?:^|\s)\d{1,3}\s*\/\s*\d{1,3}$/.test(text.trimEnd()) &&
      /^\d[\d.,]*[,.]\d{2}(?:\s|TL|TRY|₺|$)/i.test(item.text.trimStart());
    const startsInstallment = /^\d{1,3}\s*\/\s*\d{0,3}$/.test(item.text.trim());
    const separated =
      previous &&
      (gap > Math.max(1.2, item.height * 0.15) || installmentBoundary || startsInstallment);
    // Keep large visual column gaps distinct from digit grouping spaces. This
    // stops a merchant suffix such as "STORE 42" joining "712,72 TL".
    const separator = separated ? (gap > Math.max(12, item.height * 2) ? "\u2003" : " ") : "";
    text += separator + item.text;
  }
  return text.replace(/[^\S\u2003]+/g, " ").trim();
}
