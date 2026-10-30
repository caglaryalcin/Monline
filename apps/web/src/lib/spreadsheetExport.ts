import type { SpreadsheetSnapshot } from "@/services/spreadsheetExport";

import { appearance } from "./spreadsheetAppearance";
import { buildCardViews } from "./spreadsheetCards";
import { buildLoans } from "./spreadsheetDebt";
import { buildLedger, buildSalary } from "./spreadsheetLedger";
import { buildSourceSheets } from "./spreadsheetSources";
import { buildReaderViews } from "./spreadsheetViews";
import { SpreadsheetWorkbook } from "./spreadsheetWorkbook";

export function buildSpreadsheet(snapshot: SpreadsheetSnapshot, language = "tr") {
  const book = new SpreadsheetWorkbook(snapshot, language);
  const index = buildLedger(book);
  buildSalary(book, index);
  buildLoans(book, index);
  buildSourceSheets(book);
  const views = buildReaderViews(book, index);
  const cards = buildCardViews(book);
  for (const key of ["loanView", "subscriptionView", "billView", "references"] as const) {
    const sheet = book.workbook.Sheets[book.name(key)];
    if (!sheet) continue;
    const meta = appearance(sheet);
    meta.uniformBackground = true;
    meta.blankTone = "canvas";
    if (key !== "references") meta.clearBorders = true;
  }
  const graphs = views.filter(name => name === book.name("salaryCharts"));
  const readerViews = views.filter(name => name !== book.name("salaryCharts"));
  const years = [...index.years].sort((a, b) => a - b);
  const cardPosition = Math.max(0, readerViews.indexOf(book.name("salaryView")));
  const front = [...years.map(String), ...readerViews.slice(0, cardPosition), ...cards,
    ...readerViews.slice(cardPosition), book.name("references")];
  const hidden = book.workbook.SheetNames.filter((name) => !front.includes(name) && !graphs.includes(name));
  book.workbook.SheetNames = [...front, ...hidden, ...graphs];
  book.workbook.Workbook ||= {};
  book.workbook.Workbook.Sheets = book.workbook.SheetNames.map((name) => ({ name,
    Hidden: (front.includes(name) || graphs.includes(name)) && !(/^\d{4}$/.test(name) && Number(name) <= 2025) ? 0 : 1 }));
  return book.workbook;
}
