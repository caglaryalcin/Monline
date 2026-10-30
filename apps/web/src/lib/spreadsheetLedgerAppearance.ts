import { utils, type WorkSheet } from "xlsx";

import type { FinanceEntry, FinanceRow } from "./finance";
import { appearance, paint, paintFont } from "./spreadsheetAppearance";
import type { SpreadsheetWorkbook } from "./spreadsheetWorkbook";
import { cellRef, dateValue, formula, literal } from "./spreadsheetWorkbook";

/** Compact annual ledger, following the user's Excel reference. Financial
 * formulas and their addresses remain unchanged; only the view is adapted. */
export function applyLedgerAppearance(sheet: WorkSheet, book: SpreadsheetWorkbook) {
  const last = utils.decode_range(sheet["!ref"] || "A1").e.r + 1;
  const meta = appearance(sheet),
    label = book.label;
  meta.horizontal ||= {};
  meta.blankTone = "canvas";
  meta.rules = [];
  meta.zoom = 90;
  paint(sheet, `A4:O${last}`, "ledgerBody");
  paint(sheet, `A5:A${last}`, "ledgerLabel");
  paint(sheet, `N5:O${last}`, "ledgerTotal");
  const header = (r: number) => {
    // The ledgerHeader font keeps months and annual total/average labels bold.
    paint(sheet, `A${r}:O${r}`, "ledgerHeader");
    paintFont(sheet, `N${r}:O${r}`, "ledgerHeader");
    for (let c = 1; c <= 12; c++) {
      meta.horizontal![cellRef(r, c)] = "right";
      const cell = sheet[cellRef(r, c)];
      if (typeof cell?.v !== "number") continue;
      const date = new Date(Date.UTC(1899, 11, 30) + cell.v * 86400000);
      const locale = book.language.replace(/_/g, "-");
      const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" })
        .format(date)
        .toLocaleUpperCase(locale);
      cell.z = `"${month.replace(/"/g, '""')}"`;
    }
    for (const address of [`N${r}`, `O${r}`])
      if (typeof sheet[address]?.v === "string")
        sheet[address].v = sheet[address].v.toLocaleUpperCase(book.language.replace(/_/g, "-"));
  };
  for (let r = 1; r <= last; r++) {
    (sheet["!rows"] ||= [])[r - 1] = { hpt: 19.5, ...(r < 4 ? { hidden: true } : {}) };
    if (r < 4) continue;
    const text = sheet[`A${r}`]?.v;
    if (text === label("incomeSection") || text === label("expenseSection")) {
      header(r);
      paint(sheet, `A${r}`, text === label("incomeSection") ? "ledgerIncome" : "ledgerExpense");
    } else if (r > 7 && (text == null || text === "")) {
      sheet["!rows"]![r - 1] = { hidden: true, hpt: 3 };
    }
    for (let c = 1; c < 15; c++) {
      const cell = sheet[cellRef(r, c)];
      if (typeof cell?.z === "string") cell.z = cell.z.replace(/\[Red\]/g, "").replace(/₺/g, " TL");
    }
  }
  header(4);
  paint(sheet, "A4", "ledgerOverview");
  sheet.A5.v = label("income");
  sheet.A6.v = label("expenseSection");
  paint(sheet, "A5:O5", "ledgerPositive");
  paint(sheet, "A6:O6", "ledgerNegative");
  paint(sheet, "A7:O7", "ledgerBody");
  for (const r of [5, 6, 7])
    paint(
      sheet,
      `A${r}`,
      r === 5 ? "ledgerPositiveLabel" : r === 6 ? "ledgerNegativeLabel" : "ledgerLabel",
    );
  paint(sheet, "N5:O6", "ledgerTotal");
  paintFont(sheet, "N5:O5", "ledgerPositive");
  paintFont(sheet, "N6:O6", "ledgerNegative");
  paint(sheet, "N7:O7", "ledgerTotal");
  const columns = (sheet["!cols"] ||= []);
  [22, ...Array(12).fill(13.2), 17.5, 20].forEach((wch, i) => {
    columns[i] = { wch };
  });
}

export function applyLedgerPaymentColors(
  sheet: WorkSheet,
  book: SpreadsheetWorkbook,
  year: number,
  rows: { row: FinanceRow; sheetRow: number }[],
  entries: FinanceEntry[],
) {
  const meta = appearance(sheet),
    last = utils.decode_range(sheet["!ref"] || "A1").e.r + 1;
  const source = (column: string) => book.range("entries", column, entries.length);
  const periods = new Map<string, FinanceEntry[]>();
  for (const entry of entries) {
    if (!entry.date.startsWith(`${year}-`)) continue;
    const key = `${entry.row_id}:${entry.date.slice(0, 7)}`;
    const group = periods.get(key) || [];
    group.push(entry);
    periods.set(key, group);
  }
  for (const { row, sheetRow: r } of rows) {
    const paid = literal(book.label(row.kind === "expense" ? "paid" : "received"));
    const flag = (column: number, criteria: string, matching: FinanceEntry[]) => {
      const address = cellRef(r, column),
        count = `COUNTIFS(${criteria})`;
      const settled = `COUNTIFS(${criteria},${source("D")},${paid})`;
      const paidCount = matching.filter((entry) => entry.status === "settled").length;
      // Called only for populated periods; the formula also handles later Excel deletions.
      const value = paidCount === matching.length ? 1 : paidCount === 0 ? 0 : 2;
      sheet[address] = formula(
        `IF(${count}=0,-1,IF(${settled}=${count},1,IF(${settled}=0,0,2)))`,
        value,
        "0",
      );
      return `$${address}`;
    };
    const rules = (range: string, amount: string, status: string) => {
      const savedState = sheet[status.replace(/\$/g, "")]?.v;
      for (const [state, tone] of [
        [1, row.kind === "expense" ? "ledgerPaid" : "ledgerReceived"],
        [0, row.kind === "expense" ? "ledgerUnpaid" : "ledgerExpected"],
        [2, row.kind === "expense" ? "ledgerPartial" : "ledgerExpected"],
      ] as const) {
        meta.rules.push({ range, formula: `AND(ISNUMBER(${amount}),${status}=${state})`, tone });
        if (savedState === state) paintFont(sheet, range, tone);
      }
    };
    for (let month = 1; month <= 12; month++) {
      const period = `${year}-${String(month).padStart(2, "0")}`,
        matching = periods.get(`${row.id}:${period}`) || [];
      if (!matching.length) continue;
      const address = cellRef(r, month);
      const criteria = `${source("K")},${literal(row.id)},${source("B")},${dateValue(period)},${source("V")},1`;
      const status = flag(16 + month, criteria, matching);
      rules(address, address, status);
    }
  }
  for (let column = 17; column <= 29; column++) (sheet["!cols"] ||= [])[column] = { hidden: true };
  sheet["!ref"] = `A1:AD${last}`;
}
