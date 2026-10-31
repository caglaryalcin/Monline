import type { SpreadsheetSnapshot } from "../services/spreadsheetExport";
import { buildSpreadsheet } from "./spreadsheetExport";
import { writeSpreadsheet } from "./spreadsheetFile";

// Shared by browser downloads and the server's scheduled exports.
export function renderSpreadsheet(snapshot: SpreadsheetSnapshot, language: string, theme: "dark" | "light") {
  return writeSpreadsheet(buildSpreadsheet(snapshot, language), theme);
}
