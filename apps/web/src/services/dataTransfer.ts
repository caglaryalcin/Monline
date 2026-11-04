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
  sourceCollection?: "subscriptions";
  sourceRecordId?: string;
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

export type TransferScope = "calendar" | "subscriptions";
export interface ScopedBackup {
  format: "monline-scoped-backup";
  version: 1;
  scope: TransferScope;
  backup: AccountBackup;
}

export async function exportBackup(
  onProgress: (done: number, total: number) => void,
  scope?: TransferScope,
) {
  const scoped = scope
    ? await api.get<ScopedBackup>(`/api/transfer/${scope}/export`, { timeoutMs: 120_000 })
    : undefined;
  const backup = scoped?.backup ?? (await snapshot());
  onProgress(0, backup.files.length);
  const token = backup.files.length ? await client.files.getToken() : "";
  let totalBytes = 0;
  // Sequential reads bound memory and avoid flooding the NAS or file storage.
  for (const [index, file] of backup.files.entries()) {
    const url = client.files.getURL(
      { collectionId: file.sourceCollection || file.collection, id: file.sourceRecordId || file.recordId } as Parameters<
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
  const blob = new Blob([JSON.stringify(scoped ?? backup, null, 2)], { type: "application/json" });
  if (blob.size > MAX_BYTES) throw new Error("transfer_too_large");
  downloadBlob(blob, `monline-${scope ?? "backup"}-${new Date().toISOString().slice(0, 10)}.json`);
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

async function parseImportFile(file: File): Promise<unknown> {
  if (file.size > MAX_BYTES) throw new Error("transfer_too_large");
  try { return JSON.parse(await file.text()); }
  catch { throw new Error("transfer_invalid_backup"); }
}

function validateAccountBackup(value: unknown): AccountBackup {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("transfer_invalid_backup");
  const parsed = value as AccountBackup;
  if (parsed.format !== "monline-account-backup" || parsed.version !== 1 ||
      !parsed.profile || typeof parsed.profile !== "object" || Array.isArray(parsed.profile) ||
      !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data) ||
      !Array.isArray(parsed.files) || !Array.isArray(parsed.cycles)) throw new Error("transfer_invalid_backup");
  // Older account exports predate statement support.
  if (parsed.data.bank_statements === undefined) parsed.data.bank_statements = [];
  if (!TRANSFER_COLLECTIONS.every((name) => Array.isArray(parsed.data[name]))) throw new Error("transfer_invalid_backup");
  const fileTables: Record<string, { rows: TransferRecord[]; fields: string[] }> = {
    users: { rows: [{ ...parsed.profile, id: parsed.accountId }], fields: ["avatar"] },
    subscriptions: { rows: parsed.data.subscriptions, fields: ["logo"] },
    payment_methods: { rows: parsed.data.payment_methods, fields: ["icon"] },
    payment_records: { rows: parsed.data.payment_records, fields: ["proof", "logo"] },
  };
  const attachments = new Set<string>();
  if (Object.values(parsed.data).some((rows) => !Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))))
    throw new Error("transfer_invalid_backup");
  let attachmentBytes = 0;
  for (const file of parsed.files) {
    if (!file || typeof file.collection !== "string" || typeof file.recordId !== "string" ||
        typeof file.field !== "string" || typeof file.name !== "string" || !file.name ||
        typeof file.base64 !== "string" || file.base64.length % 4 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64))
      throw new Error("transfer_invalid_backup");
    const table = Object.prototype.hasOwnProperty.call(fileTables, file.collection) ? fileTables[file.collection] : undefined;
    const row = table?.rows.find((record) => record.id === file.recordId);
    const key = JSON.stringify([file.collection, file.recordId, file.field]);
    if (!table?.fields.includes(file.field) || !row || row[file.field] !== file.name || attachments.has(key) || [...file.name].some((char) => char === "/" || char === "\\" || char.charCodeAt(0) < 32))
      throw new Error("transfer_invalid_backup");
    attachments.add(key);
    attachmentBytes += file.base64.length * 0.75;
    if (attachmentBytes > 64 * 1024 * 1024 || file.base64.length > 16 * 1024 * 1024) throw new Error("transfer_too_large");
  }
  for (const [collection, table] of Object.entries(fileTables))
    for (const row of table.rows)
      for (const field of table.fields)
        if (row[field] && !attachments.has(JSON.stringify([collection, row.id, field]))) throw new Error("transfer_invalid_backup");
  return parsed;
}

export async function readImportFile(file: File): Promise<AccountBackup> {
  return validateAccountBackup(await parseImportFile(file));
}

export async function importData(backup: AccountBackup): Promise<ImportResult> {
  return api.post<ImportResult>(
    "/api/account/import",
    { backup, restoreSettings: true },
    { timeoutMs: 120_000 },
  );
}

export async function readScopedImport(file: File, scope: TransferScope): Promise<ScopedBackup> {
  const parsed = await parseImportFile(file) as ScopedBackup | null;
  if (!parsed || parsed.format !== "monline-scoped-backup" || parsed.version !== 1 || parsed.scope !== scope || !parsed.backup)
    throw new Error("transfer_invalid_backup");
  const backup = validateAccountBackup(parsed.backup);
  return { ...parsed, backup };
}
export const importScopedData = (data: ScopedBackup) =>
  api.post<ImportResult>(`/api/transfer/${data.scope}/import`, data, { timeoutMs: 120_000 });
