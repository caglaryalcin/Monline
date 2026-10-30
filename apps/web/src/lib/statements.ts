import { parseStatementOriginalAmount } from "../../../backend/src/domain/lib/pure/statement-original-amount.mjs";

export const STATEMENT_BANKS = {
  enpara: "Enpara",
  denizbank: "DenizBank",
  garanti: "Garanti BBVA",
} as const;
export type StatementBank = keyof typeof STATEMENT_BANKS;
export const TRANSACTION_KINDS = ["charge", "refund", "repayment", "fee", "cash"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
export interface StatementTransaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  kind: TransactionKind;
  page: number;
  installment: string;
  category?: StatementCategory;
  financing?: { principal: number; interest: number; kkdf: number; bsmv: number };
  source?: string;
  amount_confirmed?: boolean;
  subscription_service?: string;
  subscription_match?: "catalog" | "account" | "provider" | "manual";
}
export interface ReviewTransaction extends StatementTransaction {
  included: boolean;
  uncertain: boolean;
  source: string;
  amount_issue?: StatementAmountIssue;
}
export interface StatementDraft {
  bank: StatementBank | "";
  period: string;
  file_name: string;
  file_hash: string;
  page_count: number;
  transactions: StatementTransaction[];
  excluded_transactions?: StatementTransaction[];
  summary?: StatementAccountSummary;
  unresolved?: StatementLine[];
}
export interface StatementAccountSummary {
  previous_balance?: number;
  payments?: number;
  purchases?: number;
  cash?: number;
  fees?: number;
  balance?: number;
  minimum_payment?: number;
}
export interface SavedStatement extends StatementDraft {
  id: string;
  created: string;
}
export interface StatementLine {
  page: number;
  text: string;
  /** Geometry found conflicting values that must not be silently discarded. */
  layout_issue?: boolean;
}

function normalize(value: string) {
  return value
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
const DATE_START = /^\s*(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}|\d{2}))?(?=\s|$)/;
const MONEY =
  /[+−-]?\s*(?:(?:\d{1,3}(?:[.\s]\d{3})+|\d+),\d{2}|\d+\.\d{2})(?:\s*(?:TRY|TL|₺|USD|EUR|GBP|\$|€|£))?(?:\s*[+−-])?/gi;
function numericDates(value: string) {
  const months = [
    "ocak",
    "subat",
    "mart",
    "nisan",
    "mayis",
    "haziran",
    "temmuz",
    "agustos",
    "eylul",
    "ekim",
    "kasim",
    "aralik",
  ];
  return value.replace(
    /(\d{1,2})\s*[.\-/ ]\s*([a-zA-ZçÇğĞıİöÖşŞüÜ]+)\s*[.\-/ ]\s*(\d{4}|\d{2})(?=\s|$)/g,
    (original, day: string, name: string, year: string) => {
      const month = months.indexOf(normalize(name));
      return month < 0 ? original : `${day}/${String(month + 1).padStart(2, "0")}/${year}`;
    },
  );
}

export function validStatementDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function readDate(match: RegExpMatchArray, period: string) {
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : Number(period.slice(0, 4));
  if (year < 100) year += 2000;
  // The statement can contain December purchases in a January billing period.
  if (!match[3] && month > Number(period.slice(5, 7)) + 6) year--;
  const value = `${year}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return validStatementDate(value) ? value : "";
}

function isDatedRateNotice(text: string) {
  const normalized = normalize(text.trim());
  // A dated policy announcement is prose, not a transaction. Require both
  // explicit effective-date language and a rate/fee description, with no
  // independent posted amount outside parentheses. Unknown rows stay reviewable.
  return /^(?:itibariyla|(?:tarihinden\s+)?itibaren|effective(?:\s+from)?|as\s+of)\b/.test(normalized) &&
    /(?:%\s*\d|\d\s*%)/.test(normalized) &&
    /\b(?:islem|ucret\w*|oran\w*|faiz|minimum|dahil|fees?|rates?)\b/.test(normalized) &&
    !statementAmountTokens(text).some((token) => !token.parenthesized);
}

export function detectStatement(lines: StatementLine[]) {
  const text = normalize(
    numericDates(
      lines
        .slice(0, 150)
        .map((line) => cleanStatementText(line.text))
        .join("\n"),
    ),
  );
  const bank: StatementBank | "" = /enpara/.test(text)
    ? "enpara"
    : /denizbank|deniz bank/.test(text)
      ? "denizbank"
      : /garanti|bonus card|bonuscard/.test(text)
        ? "garanti"
        : "";
  const date = text.match(
    /(?:ekstre tarihi|hesap kesim tarihi|hesap ozeti tarihi|ekstre kesim tarihi)\s*:?\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/,
  );
  return { bank, period: date ? `${date[3]}-${date[2].padStart(2, "0")}` : "" };
}

// The first parser handles shared dated transaction-row layouts. Every
// extracted statement must be reviewed: banks change their PDF layouts.
// No totals are invented to balance a statement and no subscription is marked paid.
export function parseStatement(lines: StatementLine[], period: string, bank?: StatementBank | "") {
  const controlGlyphs = lines.some((line) => hasStatementControlGlyphs(line.text));
  lines = lines.map((line) => ({ ...line, text: cleanStatementText(line.text, controlGlyphs) }));
  const transactions: ReviewTransaction[] = [],
    unresolved: StatementLine[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index],
      workingText = numericDates(line.text),
      dateMatch = workingText.match(DATE_START);
    if (line.layout_issue) {
      unresolved.push({ page: line.page, text: line.text });
      continue;
    }
    if (!dateMatch) {
      // Keep malformed dated rows for review instead of silently losing them.
      if (/^\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(workingText) && /\d+[,.]\d/.test(workingText))
        unresolved.push(line);
      continue;
    }
    let remainder = workingText
      .slice(dateMatch[0].length)
      .trim()
      .replace(/\bAnapara\s*:.*$/i, "");
    const secondDate = remainder.match(DATE_START);
    if (secondDate) remainder = remainder.slice(secondDate[0].length).trim();
    if (isDatedRateNotice(remainder)) continue;
    let source = line.text,
      continued = false;
    const initialInstallment = statementInstallment(remainder);
    const nextText = lines[index + 1]?.text || "";
    const nextAmounts = statementAmountTokens(statementInstallment(nextText).masked).filter(
      (token) => !token.parenthesized,
    );
    const nextIsSummary =
      /^(?:toplam|genel toplam|ekstre|hesap|donem|onceki|asgari|minimum|kart limiti|son odeme|sayfa|anapara|faiz|kkdf|bsmv|yapilan odemeler|odemeler|harcamalar|borc|total|statement|previous|balance|page|fees|interest|payments)\b/.test(
        normalize(nextText.trim()),
      );
    if (
      !initialInstallment.joined &&
      !statementAmountTokens(initialInstallment.masked).some((token) => !token.parenthesized) &&
      lines[index + 1]?.page === line.page &&
      nextAmounts.length === 1 &&
      !nextIsSummary &&
      !/\d\s*$/.test(initialInstallment.masked) &&
      !/\d+[,.]\d/.test(remainder.replace(/\([^)]*\)/g, "")) &&
      !DATE_START.test(numericDates(lines[index + 1].text))
    ) {
      remainder += " " + lines[index + 1].text;
      source += " " + lines[index + 1].text;
      continued = true;
    }
    const date = readDate(dateMatch, period);
    if (!date) {
      unresolved.push({ page: line.page, text: source });
      continue;
    }
    const installmentInfo = statementInstallment(remainder);
    const tokens = statementAmountTokens(installmentInfo.masked);
    const candidates = tokens.filter((token) => !token.parenthesized);
    const chosen = candidates.length === 1 ? candidates[0] : undefined;
    let issue: StatementAmountIssue | undefined = installmentInfo.joined
      ? "joined_installment"
      : candidates.length > 1
        ? "multiple_amounts"
        : !chosen
          ? "invalid_amount"
          : undefined;
    let unexplained = installmentInfo.masked;
    for (const token of tokens)
      unexplained =
        unexplained.slice(0, token.start) +
        " ".repeat(token.end - token.start) +
        unexplained.slice(token.end);
    unexplained = maskStatementPercentages(unexplained).replace(/\([^)]*\)/g, " ");
    if (
      chosen &&
      (/\d+[,.]\d/.test(unexplained) || /\b(?:puan|bonus)\b/i.test(remainder.slice(chosen.end)))
    )
      issue ||= "multiple_amounts";
    if (!chosen && !/\d+[,.]\d/.test(remainder)) {
      unresolved.push({ page: line.page, text: source });
      continue;
    }
    const rawMerchant = remainder.slice(0, chosen?.start ?? remainder.length);
    const merchant = maskStatementPercentages(installmentInfo.masked)
      .slice(0, chosen?.start ?? remainder.length)
      .replace(/\(([^()]*)\)/g, (original, value: string) => parseStatementOriginalAmount(value) ? " " : original)
      .replace(/\d+\s*\/\s*[\d.,]+.*$/, " ")
      .replace(MONEY, " ")
      .replace(/\(\s*\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const text = normalize(merchant);
    if (
      !merchant ||
      /^(onceki donem|donem borcu|devreden bakiye|toplam|minim(um|al)|asgari)/.test(text)
    ) {
      unresolved.push({ page: line.page, text: source });
      continue;
    }
    const currency = chosen?.currency || tokens[0]?.currency || "TRY";
    const purchaseTotal = tokens.filter(
      (token) => token.parenthesized && token.currency === currency,
    );
    if (
      chosen &&
      installmentInfo.installment &&
      purchaseTotal.length === 1 &&
      Math.round(chosen.amount * 100) > Math.round(purchaseTotal[0].amount * 100)
    )
      issue = "installment_total";
    if (chosen && /\+/.test(chosen.text)) issue ||= "invalid_amount";
    // Plain spaces can be digit grouping or a merchant/column boundary. Without
    // reliable geometry there is no safe way to infer which digits belong.
    if (chosen && /\d \d{3}(?:[,.]| )/.test(chosen.text)) issue ||= "multiple_amounts";
    // Unsupported/conflicting trailing currency codes must never fall back to TRY.
    if (chosen && /^\s*(?:[A-Z]{3}|[¥₹])(?:\s|$)/.test(remainder.slice(chosen.end)))
      issue ||= "invalid_amount";
    const amount = issue ? NaN : chosen!.amount;
    const kind: TransactionKind = isStatementRepayment(merchant)
      ? "repayment"
      : /iade|iptal|refund|reversal/.test(text) ||
          chosen?.credit ||
          (chosen && /\b(alacak|a)\s*$/i.test(remainder.slice(chosen.end)))
        ? "refund"
        : /faiz|ucret|komisyon|vergi|bsmv|kkdf|aidat/.test(text)
          ? "fee"
          : /nakit (avans|cekim)/.test(text)
            ? "cash"
            : "charge";
    const installment =
      installmentInfo.installment || remainder.match(/\b\d{1,3}[. ]*taksit/i)?.[0] || "";
    const detailLines = [source];
    for (const next of lines.slice(index + 1, index + 3)) {
      if (next.page !== line.page || DATE_START.test(numericDates(next.text))) break;
      detailLines.push(next.text);
    }
    const financing =
      !issue && installment && currency === "TRY"
        ? readFinancing(detailLines.join(" "), amount)
        : undefined;
    transactions.push({
      id: `p${line.page}-l${index}`,
      date,
      merchant: merchant.slice(0, 250),
      amount,
      currency,
      kind,
      page: line.page,
      installment,
      source,
      included: !issue,
      uncertain: !!issue,
      category:
        kind === "repayment" ? "other" : kind === "fee" ? "fees" : statementCategory(rawMerchant),
      ...(issue ? { amount_issue: issue } : {}),
      ...(financing ? { financing } : {}),
    });
    if (continued) index++;
  }
  return {
    transactions,
    unresolved,
    summary: readStatementSummary(lines, bank || detectStatement(lines).bank),
  };
}

export function statementTotals(rows: StatementTransaction[]) {
  const totals: Record<string, { spending: number; refunds: number; repayments: number }> = {};
  for (const row of rows) {
    if (!Number.isFinite(row.amount)) continue;
    const total = (totals[row.currency] ??= { spending: 0, refunds: 0, repayments: 0 });
    const add = (value: number) => (Math.round(value * 100) + Math.round(row.amount * 100)) / 100;
    if (row.kind === "refund") total.refunds = add(total.refunds);
    else if (row.kind === "repayment") total.repayments = add(total.repayments);
    else total.spending = add(total.spending);
  }
  return totals;
}
import {
  maskStatementPercentages,
  type StatementAmountIssue,
  statementAmountTokens,
  statementInstallment,
} from "./statementAmounts";
import { type StatementCategory, statementCategory } from "./statementCategories";
import {
  cleanStatementText,
  hasStatementControlGlyphs,
  isStatementRepayment,
  readFinancing,
  readStatementSummary,
} from "./statementDetails";
