import { type AccountBackup, importData, type ImportResult } from "@/services/dataTransfer";
import { serverSettingsService } from "@/services/serverSettings";

export interface InstanceBackupFile {
  file: File;
  legacy: boolean;
}

/** Preserve the authorization check next to the request, independently of disabled controls. */
export async function restoreAccountSelection(
  backup: AccountBackup | null,
  signedIn: boolean,
  onRestored: (result: ImportResult) => Promise<void>,
) {
  if (!backup || !signedIn) return;
  const result = await importData(backup);
  await onRestored(result);
}

export async function restoreInstanceSelection(
  backup: InstanceBackupFile | null,
  isAdmin: boolean,
  onRestored: () => void,
) {
  if (!backup || !isAdmin) return;
  const form = new FormData();
  form.set("file", backup.file);
  await serverSettingsService.restore(form);
  onRestored();
}
