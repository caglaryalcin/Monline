import { type CellObject, utils, type WorkBook, type WorkSheet } from "xlsx";

import type { SpreadsheetSnapshot } from "@/services/spreadsheetExport";

import { appearance, paint, type SpreadsheetCellValue } from "./spreadsheetAppearance";
import { type SpreadsheetLabel, spreadsheetLabels } from "./spreadsheetExportLabels";

export type ExcelValue = SpreadsheetCellValue;
export const FIRST_ROW = 5;
export const quoteSheet = (name: string) => `'${name.replace(/'/g, "''")}'`;
export const literal = (value: string) => `"${value.replace(/"/g, '""')}"`;
export const cellRef = (row: number, column: number) =>
  utils.encode_cell({ r: row - 1, c: column });
export const formula = (f: string, value: string | number, z?: string): CellObject => ({
  t: typeof value === "number" ? "n" : "s",
  v: value,
  f,
  ...(z ? { z } : {}),
});
// Shift decimal digits as text so binary floating-point noise does not alter a tie.
function shiftDecimal(value: number, places: number): number {
  const [coefficient, exponent] = value.toExponential().split("e");
  return Number(`${coefficient}e${Number(exponent) + places}`);
}
function roundForExcel(value: number, decimals: number): number {
  const shifted = shiftDecimal(value, decimals);
  // Excel ROUND resolves ties away from zero, including negative values.
  return shiftDecimal(Math.sign(shifted) * Math.round(Math.abs(shifted)), -decimals);
}

/** Link a reader cell to an editable source and retain its cached display value. */
export function linkedCell(
  sheetName: string,
  address: string,
  source: CellObject | undefined,
  decimals?: number,
): CellObject {
  const reference = `${quoteSheet(sheetName)}!${address}`;
  const numeric = decimals == null ? reference : `ROUND(${reference},${decimals})`;
  const cached =
    typeof source?.v === "number"
      ? decimals == null
        ? source.v
        : roundForExcel(source.v, decimals)
      : typeof source?.v === "string"
        ? source.v
        : "";
  return formula(
    `IF(ISNUMBER(${reference}),${numeric},IF(${reference}="","",${reference}))`,
    cached,
    typeof source?.z === "string" ? source.z : undefined,
  );
}
export const numeric = (value: number | null | undefined, z = "#,##0.00"): ExcelValue =>
  value == null ? null : { t: "n", v: value, z };
export const moneyFormat = (code = "TRY") => {
  const symbol =
    ({ TRY: "₺", USD: "$", EUR: "€", GBP: "£" } as Record<string, string>)[code] ||
    code.replace(/[^A-Z]/g, "");
  return `#,##0.00"${symbol}";[Red]-#,##0.00"${symbol}";0.00"${symbol}"`;
};
export const money = (value: number | null | undefined, code = "TRY") =>
  numeric(value, moneyFormat(code));
export function dateValue(value: string | undefined | null) {
  if (!value || !/^\d{4}-\d{2}/.test(value)) return null;
  const iso = `${value.slice(0, 7)}-${value.length >= 10 ? value.slice(8, 10) : "01"}`;
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== iso)
    throw new Error("spreadsheet_invalid_date");
  return (parsed - Date.UTC(1899, 11, 30)) / 86400000;
}
export const dateCell = (value?: string | null, month = false): ExcelValue =>
  numeric(dateValue(value), month ? "mmmm yyyy" : "dd.mm.yyyy");
export const cents = (value: number) => Math.round(value * 100);
export const roundedSum = (values: number[]) =>
  values.reduce((sum, value) => sum + cents(value), 0) / 100;

export class SpreadsheetWorkbook {
  readonly workbook: WorkBook = utils.book_new();
  readonly label: (key: SpreadsheetLabel) => string;
  constructor(
    readonly snapshot: SpreadsheetSnapshot,
    readonly language: string,
  ) {
    this.label = spreadsheetLabels(language);
    this.workbook.Props = {
      Title: "Monline",
      Author: "Monline",
      CreatedDate: new Date(snapshot.exported_at),
    };
  }
  monthFormat(long = false) {
    const locale = this.language.startsWith("tr")
      ? "041F"
      : this.language.startsWith("de")
        ? "0407"
        : "0409";
    return `[$-${locale}]${long ? "mmmm yyyy" : "mmm"}`;
  }
  name(key: SpreadsheetLabel) {
    return this.label(key);
  }
  range(key: SpreadsheetLabel, column: string, count: number) {
    return `${quoteSheet(this.name(key))}!$${column}$${FIRST_ROW}:$${column}$${Math.max(FIRST_ROW, FIRST_ROW + count - 1)}`;
  }
  table(
    key: SpreadsheetLabel,
    headers: string[],
    rows: ExcelValue[][],
    options: {
      name?: string;
      note?: string;
      widths?: number[];
      hidden?: number[];
    } = {},
  ): WorkSheet {
    const name = options.name || this.label(key);
    if (rows.length + FIRST_ROW > 1048576 || headers.length > 16384 || name.length > 31)
      throw new Error("spreadsheet_too_large");
    const data: ExcelValue[][] = [[name], [options.note || ""], [], headers, ...rows];
    for (const row of data)
      for (const value of row) {
        const text =
          typeof value === "string"
            ? value
            : value && typeof value === "object" && value.t === "s"
              ? value.v
              : null;
        if (typeof text === "string" && text.length > 32767)
          throw new Error("spreadsheet_cell_too_long");
      }
    const sheet = utils.aoa_to_sheet(data);
    paint(sheet, `A1:${cellRef(Math.max(5, rows.length + 4), headers.length - 1)}`, "body");
    paint(sheet, `A1:${cellRef(1, headers.length - 1)}`, "title");
    paint(sheet, `A2:${cellRef(2, headers.length - 1)}`, "muted");
    paint(sheet, `A4:${cellRef(4, headers.length - 1)}`, "header");
    appearance(sheet);
    sheet["!cols"] = headers.map((header, column) => ({
      wch: options.widths?.[column] || Math.min(44, Math.max(16, header.length + 3)),
      ...(options.hidden?.includes(column) ? { hidden: true } : {}),
    }));
    sheet["!rows"] = [{ hpt: 26 }, { hpt: options.note ? 32 : 6 }, { hpt: 7 }, { hpt: 30 }];
    if (headers.length > 1)
      sheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      ];
    if (rows.length)
      sheet["!autofilter"] = {
        ref: utils.encode_range({
          s: { r: 3, c: 0 },
          e: { r: rows.length + 3, c: headers.length - 1 },
        }),
      };
    utils.book_append_sheet(this.workbook, sheet, name);
    return sheet;
  }
}
