import { api } from "@/lib/api";
import type { FinanceData } from "@/lib/finance";
import type { SpendingData } from "@/lib/spending";
import type { SavedStatement } from "@/lib/statements";
import { downloadBlob } from "@/services/dataTransfer";

export type ExportRecord = { id: string; [key: string]: unknown };
export interface SpreadsheetSnapshot {
  version: 1;
  exported_at: string;
  today: string;
  finance: FinanceData;
  spending: SpendingData;
  statements: (SavedStatement & { tracking_hidden?: boolean })[];
  collections: Record<string, ExportRecord[]>;
  cycles: { id: string; name: string }[];
}

export function spreadsheetDownloadName(snapshot: Pick<SpreadsheetSnapshot, "today" | "exported_at">) {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date(snapshot.exported_at)).replace(/:/g, "-");
  return `monline-${snapshot.today}-${time}.xlsx`;
}

export async function exportSpreadsheet(language: string) {
  const snapshot = await api.get<SpreadsheetSnapshot>("/api/spreadsheet-export", { cache: "no-store", timeoutMs: 120_000 });
  const [{ buildSpreadsheet }, { writeSpreadsheet }] = await Promise.all([
    import("@/lib/spreadsheetExport"), import("@/lib/spreadsheetFile"),
  ]);
  const workbook = buildSpreadsheet(snapshot, language);
  const bytes = writeSpreadsheet(workbook, document.documentElement.classList.contains("dark") ? "dark" : "light");
  downloadBlob(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    spreadsheetDownloadName(snapshot));
}
