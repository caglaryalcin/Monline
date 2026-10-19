export const STATEMENT_BANKS = { enpara: "Enpara", denizbank: "DenizBank", garanti: "Garanti BBVA" } as const;
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
  subscription_service?: string;
  subscription_match?: "catalog" | "account" | "provider" | "manual";
}
export interface ReviewTransaction extends StatementTransaction {
  included: boolean;
  uncertain: boolean;
  source: string;
}
export interface StatementDraft {
  bank: StatementBank | "";
  period: string;
  file_name: string;
  file_hash: string;
  page_count: number;
  transactions: StatementTransaction[];
}
export interface SavedStatement extends StatementDraft { id: string; created: string }
export interface StatementLine { page: number; text: string }

function normalize(value: string) {
  return value.replace(/ı/g, "i").replace(/İ/g, "I").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
const DATE_START = /^\s*(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}|\d{2}))?(?=\s|$)/;
const MONEY = /[+−-]?\s*(?:(?:\d{1,3}(?:[.\s]\d{3})+|\d+),\d{2}|\d+\.\d{2})(?:\s*(?:TRY|TL|₺|USD|EUR|GBP|\$|€|£))?(?:\s*[+−-])?/gi;
function numericDates(value: string) {
  const months = ["ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"];
  return value.replace(/(\d{1,2})\s*[.\-/ ]\s*([a-zA-ZçÇğĞıİöÖşŞüÜ]+)\s*[.\-/ ]\s*(\d{4}|\d{2})(?=\s|$)/g, (original, day: string, name: string, year: string) => {
    const month = months.indexOf(normalize(name));
    return month < 0 ? original : `${day}/${String(month + 1).padStart(2, "0")}/${year}`;
  });
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
function readMoney(value: string) {
  const currency = /USD|\$/i.test(value) ? "USD" : /EUR|€/i.test(value) ? "EUR" : /GBP|£/i.test(value) ? "GBP" : "TRY";
  let numeric = value.replace(/[^\d.,]/g, "");
  numeric = numeric.includes(",") ? numeric.replace(/\./g, "").replace(",", ".") : numeric;
  return { amount: Number(numeric), currency, credit: /[-−]/.test(value) };
}

export function detectStatement(lines: StatementLine[]) {
  const text = normalize(numericDates(lines.slice(0, 150).map((line) => line.text).join("\n")));
  const bank: StatementBank | "" = /enpara/.test(text) ? "enpara" : /denizbank|deniz bank/.test(text) ? "denizbank" : /garanti|bonus card|bonuscard/.test(text) ? "garanti" : "";
  const date = text.match(/(?:ekstre tarihi|hesap kesim tarihi|hesap ozeti tarihi|ekstre kesim tarihi)\s*:?\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  return { bank, period: date ? `${date[3]}-${date[2].padStart(2, "0")}` : "" };
}

// The first parser handles shared dated transaction-row layouts. Every
// extracted statement must be reviewed: banks change their PDF layouts.
// No totals are invented to balance a statement and no subscription is marked paid.
export function parseStatement(lines: StatementLine[], period: string) {
  const transactions: ReviewTransaction[] = [];
  const unresolved: StatementLine[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const workingText = numericDates(line.text);
    const dateMatch = workingText.match(DATE_START);
    if (!dateMatch) continue;
    let remainder = workingText.slice(dateMatch[0].length).trim();
    const secondDate = remainder.match(DATE_START);
    if (secondDate) remainder = remainder.slice(secondDate[0].length).trim();
    let source = line.text;
    let continued = false;
    // A wrapped amount/merchant may be on the following baseline, never another page.
    if (!Array.from(remainder.matchAll(MONEY)).length && lines[index + 1]?.page === line.page && !DATE_START.test(numericDates(lines[index + 1].text))) {
      remainder += ` ${lines[index + 1].text}`;
      source += ` ${lines[index + 1].text}`;
      continued = true;
    }
    const amountMatches = Array.from(remainder.matchAll(MONEY));
    const date = readDate(dateMatch, period);
    if (!date || !amountMatches.length) { unresolved.push({ page: line.page, text: source }); continue; }
    // Parenthesized purchase totals belong to installment metadata, not this month's debit.
    const candidates = amountMatches.filter((match) => {
      const before = remainder.slice(0, match.index);
      return before.lastIndexOf("(") <= before.lastIndexOf(")");
    });
    const chosen = candidates[candidates.length - 1];
    if (!chosen || chosen.index === undefined) { unresolved.push({ page: line.page, text: source }); continue; }
    let merchant = remainder.slice(0, chosen.index).trim();
    // Strip other monetary columns out of the merchant, keeping installment info.
    merchant = merchant.replace(MONEY, " ").replace(/\(\s*\)/g, "").replace(/\s+/g, " ").trim();
    const text = normalize(merchant);
    if (!merchant || /^(onceki donem|donem borcu|devreden bakiye|toplam|minim(um|al)|asgari)/.test(text)) {
      unresolved.push({ page: line.page, text: source }); continue;
    }
    const money = readMoney(chosen[0]);
    if (!Number.isFinite(money.amount) || money.amount > 100000000) { unresolved.push({ page: line.page, text: source }); continue; }
    const kind: TransactionKind = /odemeniz|odeme tesekkur|kart (borc|odeme)|kredi karti odeme|hesaptan odeme|otomatik odeme tahsilat/.test(text) ? "repayment"
      : /iade|iptal|refund|reversal/.test(text) || money.credit || /\b(alacak|a)\s*$/i.test(remainder.slice(chosen.index + chosen[0].length)) ? "refund"
        : /faiz|ucret|komisyon|vergi|bsmv|kkdf|aidat/.test(text) ? "fee"
          : /nakit (avans|cekim)/.test(text) ? "cash" : "charge";
    const installment = remainder.match(/(?:\b(\d{1,2})\s*\/\s*(\d{1,2})\b|\b(\d{1,2})[. ]*taksit)/i)?.[0] ?? "";
    // Multiple amount columns can include foreign equivalents or reward points.
    // Require explicit selection rather than silently importing the wrong column.
    const uncertain = candidates.length > 1 || /\+/.test(chosen[0]) || /\b(taksit|puan|bonus)\b/.test(normalize(remainder.slice(chosen.index + chosen[0].length)));
    transactions.push({
      id: `p${line.page}-l${index}`, date, merchant: merchant.slice(0, 250),
      amount: money.amount, currency: money.currency, kind, page: line.page,
      installment, source, included: !uncertain, uncertain,
    });
    if (continued) index++;
  }
  return { transactions, unresolved };
}

export function statementTotals(rows: StatementTransaction[]) {
  const totals: Record<string, { spending: number; refunds: number; repayments: number }> = {};
  for (const row of rows) {
    if (!Number.isFinite(row.amount)) continue;
    const total = totals[row.currency] ??= { spending: 0, refunds: 0, repayments: 0 };
    if (row.kind === "refund") total.refunds += row.amount;
    else if (row.kind === "repayment") total.repayments += row.amount;
    else total.spending += row.amount;
  }
  return totals;
}
