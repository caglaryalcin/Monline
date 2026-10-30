import type { WorkSheet } from "xlsx";

import type { SheetAppearance, SheetCellBorder, SheetTone } from "./spreadsheetAppearance";
import { escapeSpreadsheetXml as xml } from "./spreadsheetXml";

export interface WorksheetStyleOptions {
  colorTone?: SheetTone;
  size?: number;
  borderColor?: string;
  clearBorders?: boolean;
  uniformBackground?: boolean;
  family?: string;
  outlined?: boolean;
  borderOverride?: SheetCellBorder;
}
export type WorksheetStyleResolver = (
  tone: SheetTone,
  numberFormat: number,
  alignment: boolean | "center",
  options: WorksheetStyleOptions,
) => number;

/** Preserve editable values and formula caches while assigning presentation styles. */
export function styleWorksheetCellsXml(
  data: string,
  sheet: WorkSheet,
  meta: SheetAppearance,
  originalFormats: number[],
  resolveStyle: WorksheetStyleResolver,
) {
  // Shared strings are for literal inputs. Formula string results must
  // retain their actual cached text (including ""), never an SST index.
  data = data.replace(/<c\b([^>]*)>([\s\S]*?)<\/c>/g, (tag, attributes: string, body: string) => {
    const address = attributes.match(/\br="([^"]+)"/)?.[1] || "";
    const cell = sheet[address];
    // A genuinely blank input is an empty cell, not a shared string whose
    // index some importers can mistake for a numeric value.
    if (!cell?.f && cell?.t === "s" && cell.v === "")
      return `<c${attributes.replace(/\s+t="[^"]*"/, "")}/>`;
    if (!cell?.f || cell.t !== "s") return tag;
    return `<c${attributes.replace(/\bt="[^"]*"/, 't="str"')}>${body.replace(/<v>[\s\S]*?<\/v>/, `<v>${xml(cell.v ?? "")}</v>`)}</c>`;
  });
  data = data.replace(/<c\b([^>]*?)(\/?>)/g, (_match, attributes: string, close: string) => {
    const address = attributes.match(/\br="([^"]+)"/)?.[1] || "";
    const old = Number(attributes.match(/\bs="(\d+)"/)?.[1] || 0);
    const cell = sheet[address];
    const tone =
      meta.blankTone && (cell?.v == null || cell.v === "")
        ? meta.blankTone
        : meta.cells[address] || "body";
    const horizontal = meta.horizontal?.[address];
    const alignment =
      horizontal === "center"
        ? "center"
        : horizontal
          ? horizontal === "right"
          : tone === "ledgerHeader" && !/^A\d+$/.test(address)
            ? "center"
            : cell?.t === "n";
    const index = resolveStyle(tone, originalFormats[old] || 0, alignment, {
      colorTone: meta.fontColors?.[address],
      size: meta.fontSizes?.[tone],
      borderColor: meta.borderColor,
      clearBorders: meta.clearBorders,
      uniformBackground: meta.uniformBackground,
      family: meta.fontFamily,
      outlined: meta.outlined?.includes(address),
      borderOverride: meta.borders?.[address],
    });
    const typed = cell?.t === "n" && !/\bt="/.test(attributes) ? `${attributes} t="n"` : attributes;
    return `<c${typed.replace(/\s+s="\d+"/, "")} s="${index}"${close}`;
  });
  return data;
}
