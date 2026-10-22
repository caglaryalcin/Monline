import { api } from "@/lib/api";
import client from "@/lib/client";
import { serverSettingsService } from "@/services/serverSettings";

export const TRANSFER_COLLECTIONS = [
  "subscriptions",
  "payment_records",
  "subscription_history",
  "yearly_costs",
  "categories",
  "currencies",
  "payment_methods",
  "household",
  "notifications_config",
  "fixer_settings",
  "notification_log",
  "bank_statements",
] as const;
export type TransferCollection = (typeof TRANSFER_COLLECTIONS)[number];
type TransferRecord = { id: string; [key: string]: unknown };
interface BackupFile {
  collection: string;
  recordId: string;
  field: string;
  name: string;
  base64?: string;
}
export interface AccountBackup {
  format: "monline-account-backup";
  version: 1;
  exportedAt: string;
  accountId: string;
  profile: TransferRecord;
  data: Record<TransferCollection, TransferRecord[]>;
  cycles: { id: string; name: string }[];
  files: BackupFile[];
}
export interface ImportResult {
  imported: number;
  skipped: number;
  errors?: { index: number; name?: string; reason?: string; warning?: string }[];
}
const MAX_BYTES = 100 * 1024 * 1024;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function snapshot() {
  return api.get<AccountBackup>("/api/account/export", { cache: "no-store", timeoutMs: 120_000 });
}

export async function exportBackup(onProgress: (done: number, total: number) => void) {
  const backup = await snapshot();
  onProgress(0, backup.files.length);
  const token = backup.files.length ? await client.files.getToken() : "";
  let totalBytes = 0;
  // Sequential reads bound memory and avoid flooding the NAS or file storage.
  for (const [index, file] of backup.files.entries()) {
    const url = client.files.getURL(
      { collectionId: file.collection, id: file.recordId } as Parameters<
        typeof client.files.getURL
      >[0],
      file.name,
      { token },
    );
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${client.authStore.token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error("transfer_file_failed");
    const bytes = new Uint8Array(await response.arrayBuffer());
    totalBytes += bytes.byteLength;
    if (totalBytes > 64 * 1024 * 1024 || bytes.byteLength > 12 * 1024 * 1024)
      throw new Error("transfer_too_large");
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 8192)
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
    file.base64 = btoa(chunks.join(""));
    onProgress(index + 1, backup.files.length);
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  if (blob.size > MAX_BYTES) throw new Error("transfer_too_large");
  downloadBlob(blob, `monline-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function exportInstanceBackup(password: string) {
  const response = await serverSettingsService.backupRaw(password);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const code = data.message;
    throw new Error(
      ["transfer_password_required", "transfer_invalid_password"].includes(code)
        ? code
        : "transfer_export_failed",
    );
  }
  const blob = await response.blob();
  downloadBlob(blob, `monline-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`);
}

export async function readImportFile(file: File): Promise<AccountBackup> {
  if (file.size > MAX_BYTES) throw new Error("transfer_too_large");
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("transfer_invalid_backup");
  }
  // Backups made before statement support have no such dataset.
  if (parsed?.data && parsed.data.bank_statements === undefined) parsed.data.bank_statements = [];
  if (
    parsed?.format !== "monline-account-backup" ||
    parsed.version !== 1 ||
    !parsed.profile ||
    !Array.isArray(parsed.files) ||
    !Array.isArray(parsed.cycles) ||
    !TRANSFER_COLLECTIONS.every((name) => Array.isArray(parsed.data?.[name]))
  )
    throw new Error("transfer_invalid_backup");
  return parsed as AccountBackup;
}

export async function importData(backup: AccountBackup): Promise<ImportResult> {
  return api.post<ImportResult>(
    "/api/account/import",
    { backup, restoreSettings: true },
    { timeoutMs: 120_000 },
  );
}
