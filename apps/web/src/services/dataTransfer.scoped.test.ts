import { File as NodeFile } from "node:buffer";

import { readImportFile, readScopedImport } from "@/services/dataTransfer";

beforeAll(() => vi.stubGlobal("File", NodeFile));
afterAll(() => vi.unstubAllGlobals());

function exportedBackup() {
  return {
    format: "monline-scoped-backup", version: 1, scope: "subscriptions",
    backup: {
      format: "monline-account-backup", version: 1, accountId: "owner", profile: { id: "owner" },
      data: { ...Object.fromEntries(["subscriptions", "payment_records", "subscription_history", "yearly_costs", "categories", "currencies", "payment_methods", "household", "notifications_config", "notification_log", "bank_statements"].map((name) => [name, []])), payment_accounts: [], subscriptions: [{ id: "plan", name: "Plan" }] },
      cycles: [{ id: "monthly", name: "Monthly" }], files: [],
    },
  };
}
const file = (value: unknown) => ({ size: 100, text: async () => JSON.stringify(value) }) as File;

describe("subscription export compatibility", () => {
  it("accepts the v1.13 export shape without obsolete fixer_settings", async () => {
    const backup = exportedBackup();
    expect(backup.backup.data).not.toHaveProperty("fixer_settings");
    const parsed = await readScopedImport(file(backup), "subscriptions");
    expect(parsed.backup.data.subscriptions).toEqual([{ id: "plan", name: "Plan" }]);
  });
  it("also reads account backups produced by the same exporter", async () => {
    expect(await readImportFile(file(exportedBackup().backup))).toMatchObject({ format: "monline-account-backup" });
  });
  it("does not accept a subscription export as a calendar export", async () => {
    await expect(readScopedImport(file(exportedBackup()), "calendar")).rejects.toThrow("transfer_invalid_backup");
  });
  it("still rejects a missing required dataset", async () => {
    const backup = exportedBackup();
    delete (backup.backup.data as Record<string, unknown>).categories;
    await expect(readScopedImport(file(backup), "subscriptions")).rejects.toThrow("transfer_invalid_backup");
  });
  it("still rejects incomplete file metadata and invalid JSON", async () => {
    const backup = exportedBackup();
    delete (backup.backup as Partial<typeof backup.backup>).files;
    await expect(readScopedImport(file(backup), "subscriptions")).rejects.toThrow("transfer_invalid_backup");
    await expect(readScopedImport({ size: 1, text: async () => "{" } as File, "subscriptions")).rejects.toThrow("transfer_invalid_backup");
  });
});
