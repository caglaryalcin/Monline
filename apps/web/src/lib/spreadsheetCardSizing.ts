import { utils, type WorkSheet } from "xlsx";

import { appearance } from "./spreadsheetAppearance";
import { cellRef } from "./spreadsheetWorkbook";
export const CARD_FONT_FAMILY = "Trebuchet MS";

export function fitMonthColumns(sheet: WorkSheet, rows: number, columns: number) {
  const meta = appearance(sheet);
  const context =
    typeof document !== "undefined" && typeof CanvasRenderingContext2D !== "undefined"
      ? document.createElement("canvas").getContext("2d")
      : null;
  sheet["!cols"] = Array.from({ length: 12 }, (_, column) => {
    if (column >= columns) return { wpx: 48, MDW: 7, hidden: true };
    let pixels = 0;
    for (let row = 1; row <= rows; row++) {
      const address = cellRef(row, column),
        cell = sheet[address];
      if (cell?.v == null || cell.v === "") continue;
      const tone = meta.cells[address] || "body";
      const size = meta.fontSizes?.[tone] ?? (tone === "cardMonth" ? 12 : 10);
      const bold = tone === "cardCategory" || tone === "cardMonth" || tone === "cardPurchases";
      const text = utils.format_cell(cell);
      if (context) context.font = `${bold ? "bold " : ""}${size}pt "${CARD_FONT_FAMILY}"`;
      for (const line of text.split(/\r?\n/)) {
        // Browser exports use the rendered font; non-browser callers use the
        // same content with a conservative font-width estimate.
        const width = context
          ? context.measureText(line).width
          : (([...line].reduce(
              (sum, character) =>
                sum +
                (/\s/.test(character)
                  ? 0.28
                  : /[.,:;!|il]/.test(character)
                    ? 0.25
                    : /[MW@]/.test(character)
                      ? 0.85
                      : /[A-Z0-9─]/.test(character)
                        ? 0.56
                        : 0.5),
              0,
            ) *
              size *
              4) /
              3) *
            (bold ? 1.06 : 1);
        pixels = Math.max(pixels, width);
      }
    }
    // XLSX widths use the Normal font's maximum digit width. SheetJS defaults
    // to 6 px; the exported Arial 10 font uses 7 px. Leaving that unspecified
    // makes the imported columns wider than the measured content.
    return { wpx: Math.min(1780, Math.max(48, Math.ceil(pixels + 10))), MDW: 7 };
  }).concat(Array.from({ length: 12 }, () => ({ wpx: 100, MDW: 7, hidden: true })));
}
