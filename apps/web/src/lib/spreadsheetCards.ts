import { type CellObject, type WorkSheet } from "xlsx";

import { appearance, paint, put, type SheetTone } from "./spreadsheetAppearance";
import {CARD_FONT_FAMILY,fitMonthColumns} from "./spreadsheetCardSizing";
import type { SpreadsheetLabel } from "./spreadsheetExportLabels";
import type { SpreadsheetWorkbook } from "./spreadsheetWorkbook";
import { cellRef, FIRST_ROW, formula, literal, moneyFormat, quoteSheet, roundedSum } from "./spreadsheetWorkbook";
import { statementCardReport } from "./statementCardReport";
import { normalizeMerchant, STATEMENT_CATEGORIES, type StatementCategory } from "./statementCategories";
import { STATEMENT_BANKS, type StatementAccountSummary } from "./statements";
import { statementTranslations } from "./statementTranslations";


const TURKISH_FINANCING_NAMES = {interest: "Alışveriş faizi", kkdf: "Faizlerin KKDF'si*", bsmv: "Faiz ve ücretlerin BSMV'si*", unitemized: statementTranslations.tr.statement_financing_unitemized};

type Item = { name: string; card: string; amount: number; installment: string };
type CardMonth = { cards: Set<string>; items: Map<StatementCategory, Item[]>; refunds: number[]; financingFees: number[]; statementRows: number[] };

/** One reader column per month, backed by editable numeric inputs in hidden
 * columns. Display text never becomes the source of financial calculations. */
export function buildCardViews(book: SpreadsheetWorkbook) {
  const l = book.label, locale = book.language.replace(/_/g, "-");
  const language = book.language.startsWith("tr") ? "tr" : book.language.startsWith("de") ? "de" : "en";
  const words = statementTranslations[language];
  const categoryName = (category: StatementCategory) => words[`statement_category_${category}`];
  const statements = [...book.snapshot.statements].sort((a, b) => a.period.localeCompare(b.period) || a.file_name.localeCompare(b.file_name));
  const names = new Map(book.snapshot.finance.finance_rows.map((row) => [row.id, row.name]));
  const years = new Map<string, { year: number; currency: string; months: Map<number, CardMonth> }>();
  const month = (year: number, currency: string, number: number) => {
    const key = `${year}:${currency}`;
    if (!years.has(key)) years.set(key, { year, currency, months: new Map() });
    const group = years.get(key)!;
    if (!group.months.has(number)) group.months.set(number, { cards: new Set(), items: new Map(), refunds: [], financingFees: [], statementRows: [] });
    return group.months.get(number)!;
  };
  statements.forEach((statement, index) => {
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(statement.period)) return;
    const year = Number(statement.period.slice(0, 4)), number = Number(statement.period.slice(5, 7));
    const linked = book.snapshot.finance.finance_statement_links?.filter((link) => link.statement_id === statement.id)
      .map((link) => names.get(link.row_id)).filter((name): name is string => !!name) || [];
    const card = [...new Set(linked)].join(" / ") || STATEMENT_BANKS[statement.bank as keyof typeof STATEMENT_BANKS] || l("cardName");
    const summaryMonth = month(year, "TRY", number);
    summaryMonth.cards.add(card);
    summaryMonth.statementRows.push(FIRST_ROW + index);
    const report = statementCardReport(statement);
    summaryMonth.financingFees.push(report.financingFees);
    for (const refund of report.refunds) month(year, refund.currency, number).refunds.push(-refund.amount);
    for (const group of report.groups) {
      const current = month(year, group.currency, number);
      current.cards.add(card);
      const items = current.items.get(group.category) || [];
      for (const item of group.items) {
        const name = item.feeType
          ? language === "tr" ? TURKISH_FINANCING_NAMES[item.feeType] : words[`statement_financing_${item.feeType}`]
          : item.merchant;
        items.push({ name, card, amount: item.amount, installment: item.installment });
      }
      current.items.set(group.category, items);
    }
  });

  for (const year of years.values()) for (const current of year.months.values()) {
    const fees = current.items.get("fees");
    if (!fees) continue;
    const merged = new Map<string, Item>();
    for (const item of fees) {
      const key = `${item.card}:${normalizeMerchant(item.name)}`;
      const previous = merged.get(key);
      merged.set(key, { ...item, amount: roundedSum([item.amount, previous?.amount || 0]) });
    }
    current.items.set("fees", [...merged.values()]);
  }

  const visible: string[] = [];
  for (const { year, currency, months } of [...years.values()].sort((a, b) => a.year - b.year || Number(a.currency !== "TRY") - Number(b.currency !== "TRY") || a.currency.localeCompare(b.currency))) {
    if (![...months.values()].some((value) => value.refunds.length || [...value.items.values()].some((items) => items.length))) continue;
    const name = `${year}-KK${currency === "TRY" ? "" : ` ${currency}`}`;
    // Lead with actual imported periods. Empty January–July columns made a
    // partial year look empty in viewers that ignore the saved scroll offset.
    const monthColumns = new Map([...months.keys()].sort((a, b) => a - b).map((number, column) => [number, column]));
    const sheet = book.table("cardView", Array(12).fill(""), [], { name, widths: Array(12).fill(57) });
    delete sheet["!autofilter"];
    sheet["!merges"] = [];
    sheet["!rows"] = [{ hpt: 30 }, { hpt: 8 }];
    paint(sheet, "A1:L5", "body");
    const meta = appearance(sheet);
    meta.fontFamily = CARD_FONT_FAMILY;
    meta.fontSizes = { body: 10, cardCategory: 12, paid: 10, cardPurchases: 10, cardBalance: 12, cardMinimum: 12 };
    meta.clearBorders = true;
    meta.horizontal = {};
    meta.freeze = { row: 1, column: 0 };
    meta.startColumn = 0;
    meta.zoom = 80;
    meta.tab = "DE8400";
    const categoryOrder: StatementCategory[] = [...STATEMENT_CATEGORIES.filter((category) => category !== "other" && category !== "fees"), "other", "fees"];
    const present = categoryOrder.filter((category) => [...months.values()].some((value) => value.items.has(category)));
    const blocks = new Map<StatementCategory, { top: number; height: number }>();
    // All rendered month numbers come from monthColumns, which uses this map's keys.
    const monthAt = (number: number) => months.get(number)!;
    const gross = (number: number) => roundedSum([...monthAt(number).items.values()].flat().map((item) => item.amount));
    const refunds = (number: number) => roundedSum(monthAt(number).refunds);
    const format = moneyFormat(currency).replace(/\[Red\]/g, "").replace(/₺/g, " TL");
    const suffix = currency === "TRY" ? " TL" : ({ USD: "$", EUR: "€", GBP: "£" } as Record<string, string>)[currency] || ` ${currency}`;
    const amounts = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const input = (r: number, c: number) => cellRef(r, c + 12);
    // FIXED takes the precision as a number. TEXT's decimal/grouping pattern
    // is interpreted differently by localized Excel installations.
    const amountExpression = (value: string) => {
      const fixed = `FIXED(${value},2,FALSE)`;
      return `IF(FIXED(1.5,1,TRUE)="1.5",SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${fixed},".","|"),",","."),"|",","),${fixed})`;
    };
    const percentExpression = (value: string) => `${literal("%")}&FIXED(${value}*100,0,TRUE)`;
    const shareText = (value: number, total: number) => total
      ? `%${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value / total * 100)}` : "";
    const displayAmount = (r: number, c: number, label: string, value: CellObject | string, tone: SheetTone = "body", share?: { address: string; value: number }, afterAmount = "") => {
      const source = put(sheet, r, c + 12, value);
      const amount = sheet[source].v;
      const percentFormula = share ? `&IF(${share.address}=0,"",${literal("  ")}&${percentExpression(`${source}/${share.address}`)})` : "";
      const percent = share && typeof amount === "number" ? shareText(amount, share.value) : "";
      const address = put(sheet, r, c, formula(`IF(ISNUMBER(${source}),${literal(label + "  ")}&${amountExpression(source)}&${literal(suffix + afterAmount)}${percentFormula},"")`,
        typeof amount === "number" ? `${label}  ${amounts.format(amount)}${suffix}${afterAmount}${percent ? `  ${percent}` : ""}` : ""), tone);
      meta.horizontal![address] = "right";
      return source;
    };
    const divider = (r: number, c: number) => {
      const address = put(sheet, r, c, "────────────────────────────────────────");
      meta.horizontal![address] = "center";
      sheet["!rows"]![r - 1] = { hpt: 12 };
    };
    const dividerAcrossMonths = (r: number) => {
      for (const c of monthColumns.values()) divider(r, c);
    };
    for (const [number, c] of monthColumns) {
      put(sheet, 1, c, new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, number - 1, 1))).toLocaleUpperCase(locale), "cardMonth");
    }
    let row = 3;
    for (const category of present) {
      const top = row;
      const height = Math.max(1, ...[...months.values()].map((value) => value.items.get(category)?.length || 0));
      blocks.set(category, { top, height });
      for (const [number, c] of monthColumns) {
        const current = months.get(number);
        const items = [...(current?.items.get(category) || [])].sort((a, b) => b.amount - a.amount);
        divider(top - 1, c);
        divider(top + 1, c);
        for (const [i, item] of items.entries()) {
          const merchant = current!.cards.size === 1 ? item.name : `${item.card} · ${item.name}`;
          const installment = item.installment ? ` (${item.installment} ${l("installmentLabel")})` : "";
          displayAmount(top + 2 + i, c, merchant, { t: "n", v: item.amount, z: format }, "body", undefined, installment);
          const hpt = Math.min(409, Math.max(22, Math.ceil((merchant.length + installment.length + 15) / 57) * 14 + 6));
          sheet["!rows"]![top + 1 + i] = { hpt: Math.max(sheet["!rows"]![top + 1 + i]?.hpt || 0, hpt) };
        }
      }
      sheet["!rows"]![top - 1] = { hpt: 18 };
      sheet["!rows"]![top + height + 1] = { hpt: 9 };
      row += height + 4;
    }

    const summary = row;
    const summaryCategories = present.filter(category => category !== "other" && category !== "fees");
    dividerAcrossMonths(summary + 1);
    for (const [number, c] of monthColumns) {
      const grandAddress = input(summary, c);
      const headingAddress = put(sheet, summary, c, l("overview").toLocaleUpperCase(locale), "cardCategory");
      meta.horizontal[headingAddress] = "center";
      const totals = new Map<StatementCategory, number>();
      for (const category of present) {
        const { top, height } = blocks.get(category)!;
        const items = months.get(number)?.items.get(category) || [];
        const value = roundedSum(items.map((item) => item.amount));
        totals.set(category, value);
        const total = put(sheet, top, c + 12, items.length
          ? formula(`ROUND(SUM(${input(top + 2, c)}:${input(top + height + 1, c)}),2)`, value, format) : "");
        if (!items.length) continue;
        const categoryLabel = categoryName(category).toUpperCase();
        const percent = shareText(value, gross(number));
        const heading = put(sheet, top, c, formula(`${literal(categoryLabel + "  ")}&${amountExpression(total)}&${literal(suffix)}&IF(${grandAddress}=0,"",${literal("  ")}&${percentExpression(`${total}/${grandAddress}`)})`,
          `${categoryLabel}  ${amounts.format(value)}${suffix}${percent ? `  ${percent}` : ""}`), "cardCategory");
        meta.horizontal[heading] = "center";
      }
      const refs = present.map(category => input(blocks.get(category)!.top, c));
      put(sheet, summary, c + 12, formula(refs.length ? `ROUND(SUM(${refs.join(",")}),2)` : "0", gross(number), format));
      put(sheet, summary + 1, c + 12, { t: "n", v: roundedSum(monthAt(number).financingFees), z: format });
      const ranked = summaryCategories.filter(category => months.get(number)?.items.get(category)?.length)
        .sort((a, b) => totals.get(b)! - totals.get(a)!);
      ranked.forEach((category, index) => {
        displayAmount(summary + 2 + index, c, categoryName(category).toUpperCase(),
          formula(input(blocks.get(category)!.top, c), totals.get(category)!, format), "body", { address: grandAddress, value: gross(number) });
      });
    }
    sheet["!rows"]![summary - 1] = { hpt: 18 };
    row = summary + 3 + summaryCategories.length;
    if (currency === "TRY") {
      const fields: [SpreadsheetLabel, keyof StatementAccountSummary, string][] = [
        ["previousBalance", "previous_balance", "D"], ["repayments", "payments", "E"], ["purchases", "purchases", "F"],
        ["cashAdvance", "cash", "G"], ["fees", "fees", "H"], ["balance", "balance", "I"], ["minimumPayment", "minimum_payment", "J"],
      ];
      let lastDivider = -1;
      fields.forEach(([label, key, sourceColumn]) => {
        if (key === "cash" && ![...months.values()].some(current => current.statementRows.some(position => (statements[position - FIRST_ROW].summary?.cash || 0) !== 0))) return;
        const tone: SheetTone = key === "payments" ? "paid" : key === "purchases" ? "cardPurchases"
          : key === "balance" ? "cardBalance" : key === "minimum_payment" ? "cardMinimum" : "body";
        const title = key === "purchases" ? words.statement_summary_purchases : key === "fees" ? l("cardFees") : l(label);
        if (key === "balance" && lastDivider !== row - 1) {
          dividerAcrossMonths(row);
          lastDivider = row++;
        }
        const target = row++;
        for (const [number, c] of monthColumns) {
          const monthName = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, number - 1, 1)));
          const paymentTitle = l("monthPayment").replace("{month}", monthName[0].toLocaleUpperCase(locale) + monthName.slice(1));
          const rowTitle = key === "payments" ? paymentTitle : title;
          put(sheet, target, c, rowTitle, tone);
          const positions = monthAt(number).statementRows;
          const values = positions.map((position) => statements[position - FIRST_ROW].summary?.[key]);
          const complete = values.every((value): value is number => typeof value === "number" && Number.isFinite(value));
          const refs = positions.map((position) => `${quoteSheet(book.name("statementSummary"))}!${sourceColumn}${position}`).join(",");
          const financing = roundedSum(monthAt(number).financingFees);
          const adjustment = key === "purchases" ? -financing : key === "fees" ? financing : 0;
          const expression = `${key === "payments" ? "-" : ""}ROUND(SUM(${refs})${key === "purchases" ? `-${input(summary + 1, c)}` : key === "fees" ? `+${input(summary + 1, c)}` : ""},2)`;
          const result = complete ? roundedSum([roundedSum(values as number[]), adjustment]) * (key === "payments" ? -1 : 1) : "";
          const value = key === "cash" ? `IF(SUM(${refs})=0,"",${expression})` : expression;
          displayAmount(target, c, rowTitle, formula(`IF(COUNT(${refs})=${positions.length},${value},"")`, key === "cash" && result === 0 ? "" : result, format), tone);
        }
      });
    }
    // Retain the refund and net calculations without adding visible rows to
    // the concise reference summary requested by the user.
    for (const [number, c] of monthColumns) {
      put(sheet, row, c + 12, { t: "n", v: refunds(number), z: format });
      put(sheet, row + 1, c + 12, formula(`ROUND(SUM(${input(summary, c)},${input(row, c)}),2)`, roundedSum([gross(number), refunds(number)]), format));
    }
    row += 2;
    finish(sheet, row, monthColumns.size);
    visible.push(name);
  }
  return visible;
}

function finish(sheet: WorkSheet, rows: number, columns: number) {
  for (let r = 1; r <= rows; r++) for (let c = 0; c < 12; c++) {
    if (!sheet[cellRef(r, c)]) put(sheet, r, c, "");
  }
  sheet["!ref"] = `A1:X${rows}`;
  fitMonthColumns(sheet, rows, columns);
}
