import { type CellObject, utils, type WorkSheet } from "xlsx";

export type SpreadsheetCellValue = string | number | boolean | null | undefined | CellObject;

export type SheetTone = "canvas" | "cardMonth" | "cardCategory" | "cardPurchases" | "cardBalance" | "cardMinimum" | "body" | "label" | "muted" | "title" | "header" | "salaryHeader" | "salaryYear" | "section" | "income" | "expense" | "total" | "paid" | "paidOlive" | "billPaid" | "billStatus" | "pending" | "partial" | "finished" | "sky" | "violet" | "amber" | "tagGreen" | "tagSky" | "tagAmber" | "tagViolet" | "ledgerBody" | "ledgerLabel" | "ledgerTotal" | "ledgerHeader" | "ledgerOverview" | "ledgerIncome" | "ledgerExpense" | "ledgerPositive" | "ledgerNegative" | "ledgerPositiveLabel" | "ledgerNegativeLabel" | "ledgerPaid" | "ledgerUnpaid" | "ledgerPartial" | "ledgerExpected" | "ledgerReceived";
export interface SheetChart {
  title: string;
  categories: string;
  labels: string[];
  axisLabels?: string[];
  series: { name: string; nameRange?: string; range: string; values: (number | null)[]; color: string; format?: string }[];
  row: number;
  column: number;
  width: number;
  height: number;
  multiple?: boolean;
  markers?: (string | null)[];
}
export interface SheetCellBorder {
  color: string;
  edges: ("left" | "right" | "top" | "bottom")[];
}
export interface SheetAppearance {
  cells: Record<string, SheetTone>;
  fontFamily?: string;
  fontColors?: Record<string, SheetTone>;
  fontSizes?: Partial<Record<SheetTone, number>>;
  blankTone?: SheetTone;
  horizontal?: Record<string, "left" | "right" | "center">;
  borderColor?: string;
  clearBorders?: boolean;
  outlined?: string[];
  borders?: Record<string, SheetCellBorder>;
  uniformBackground?: boolean;
  rules: { range: string; formula: string; tone: SheetTone }[];
  charts: SheetChart[];
  freeze: { row: number; column: number };
  startColumn?: number;
  zoom: number;
  tab: string;
}
export const appearance = (sheet: WorkSheet): SheetAppearance => sheet["!monline"] ||= {
  cells: {}, blankTone: "canvas", rules: [], charts: [], freeze: { row: 4, column: 1 }, zoom: 90, tab: "D9FF65",
};
export function paint(sheet: WorkSheet, range: string, tone: SheetTone) {
  const bounds = utils.decode_range(range), meta = appearance(sheet);
  for (let r = bounds.s.r; r <= bounds.e.r; r++) for (let c = bounds.s.c; c <= bounds.e.c; c++) {
    const address = utils.encode_cell({ r, c });
    sheet[address] ||= { t: "s", v: "" };
    meta.cells[address] = tone;
  }
}
// Store the exported status color separately from the base cell style, so
// static previews get the color without replacing fills, borders or bold text.
export function paintFont(sheet: WorkSheet, range: string, tone: SheetTone) {
  const bounds = utils.decode_range(range), colors = appearance(sheet).fontColors ||= {};
  for (let r = bounds.s.r; r <= bounds.e.r; r++) for (let c = bounds.s.c; c <= bounds.e.c; c++) {
    const address = utils.encode_cell({ r, c });
    if (sheet[address]) colors[address] = tone;
  }
}
export function put(sheet: WorkSheet, row: number, column: number, value: SpreadsheetCellValue, tone: SheetTone = "body") {
  const address = utils.encode_cell({ r: row - 1, c: column });
  sheet[address] = typeof value === "object" && value ? value : { t: typeof value === "number" ? "n" : typeof value === "boolean" ? "b" : "s", v: value ?? "" };
  appearance(sheet).cells[address] = tone;
  return address;
}
export function merge(sheet: WorkSheet, row: number, from: number, to: number) {
  if (to > from) (sheet["!merges"] ||= []).push({ s: { r: row - 1, c: from }, e: { r: row - 1, c: to } });
}
/** Draw only the outside of a range, leaving its interior borders clear. */
export function outlineRange(sheet: WorkSheet, range: string, color = "BFBFBF") {
  const bounds = utils.decode_range(range), borders = appearance(sheet).borders ||= {};
  for (let r = bounds.s.r; r <= bounds.e.r; r++) for (let c = bounds.s.c; c <= bounds.e.c; c++) {
    const edges: SheetCellBorder["edges"] = [];
    if (c === bounds.s.c) edges.push("left");
    if (c === bounds.e.c) edges.push("right");
    if (r === bounds.s.r) edges.push("top");
    if (r === bounds.e.r) edges.push("bottom");
    if (!edges.length) continue;
    const address = utils.encode_cell({ r, c });
    sheet[address] ||= { t: "s", v: "" };
    borders[address] = { color, edges };
  }
}
