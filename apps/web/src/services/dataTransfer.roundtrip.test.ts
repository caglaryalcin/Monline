import { Blob as NodeBlob, File as NodeFile } from "node:buffer";

import { api } from "@/lib/api";
import client from "@/lib/client";
import { exportBackup, importScopedData, readImportFile, readScopedImport, type ScopedBackup, type TransferScope } from "@/services/dataTransfer";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/lib/client", () => ({ default: { authStore: { token: "session" }, files: { getToken: vi.fn(), getURL: vi.fn() } } }));
const binary = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
let downloaded: Blob | undefined;
let click: ReturnType<typeof vi.spyOn>;

function manifest(scope: TransferScope) {
  return {
    format: "monline-scoped-backup", version: 1, scope,
    backup: {
      format: "monline-account-backup", version: 1, accountId: "original-owner", profile: { id: "original-owner" },
      data: {
        subscriptions: scope !== "calendar" ? [{ id: "sub", name: "Plan", logo: "logo.svg" }] : [],
        payment_records: scope === "calendar" ? [{ id: "payment", name: "Plan", amount: 100, logo: "logo.svg" }] : [],
        categories: [], currencies: [], payment_methods: [], household: [], subscription_history: [], yearly_costs: [],
        notifications_config: [], notification_log: [], bank_statements: [],
      },
      cycles: [], files: [{ collection: scope === "calendar" ? "payment_records" : "subscriptions", recordId: scope === "calendar" ? "payment" : "sub", field: "logo", name: "logo.svg",
        ...(scope === "calendar" ? { sourceCollection: "subscriptions", sourceRecordId: "original-sub" } : {}) }],
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks(); downloaded = undefined;
  vi.stubGlobal("Blob", NodeBlob); vi.stubGlobal("File", NodeFile);
  vi.stubGlobal("URL", { createObjectURL: vi.fn((blob: Blob) => { downloaded = blob; return "blob:download"; }), revokeObjectURL: vi.fn() });
  vi.mocked(client.files.getToken).mockResolvedValue("file-token");
  vi.mocked(client.files.getURL).mockImplementation((record, name) => `/files/${record.collectionId}/${record.id}/${name}`);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(binary)));
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { click.mockRestore(); vi.unstubAllGlobals(); });

it.each(["subscriptions", "calendar"] as const)("exports a %s file that the importer reads without losing attachments", async (scope) => {
  vi.mocked(api.get).mockResolvedValue(manifest(scope));
  const progress = vi.fn();
  await exportBackup(progress, scope);
  expect(click).toHaveBeenCalledTimes(1);
  expect(progress).toHaveBeenLastCalledWith(1, 1);
  const file = new File([downloaded!], "export.json", { type: "application/json" });
  const parsed = await readScopedImport(file, scope);
  expect(parsed.scope).toBe(scope);
  expect(Uint8Array.from(atob(parsed.backup.files[0].base64!), (char) => char.charCodeAt(0))).toEqual(binary);
  if (scope === "calendar") {
    expect(client.files.getURL).toHaveBeenCalledWith({ collectionId: "subscriptions", id: "original-sub" }, "logo.svg", { token: "file-token" });
  }
  vi.mocked(api.post).mockResolvedValue({ imported: 1, skipped: 0 });
  await importScopedData(parsed);
  expect(api.post).toHaveBeenCalledWith(`/api/transfer/${scope}/import`, parsed, { timeoutMs: 120_000 });
});

it("never downloads a partial export if an attachment cannot be read", async () => {
  vi.mocked(api.get).mockResolvedValue(manifest("calendar"));
  vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));
  await expect(exportBackup(vi.fn(), "calendar")).rejects.toThrow("transfer_file_failed");
  expect(click).not.toHaveBeenCalled();
  expect(downloaded).toBeUndefined();
});

it.each(["missing-body", "missing-descriptor", "invalid-base64", "duplicate-descriptor", "wrong-record", "path-name"])("rejects broken attachment metadata: %s", async (failure) => {
  const data = manifest("subscriptions") as unknown as ScopedBackup;
  const file = data.backup.files[0];
  file.base64 = btoa("original");
  if (failure === "missing-body") delete file.base64;
  if (failure === "missing-descriptor") data.backup.files = [];
  if (failure === "invalid-base64") file.base64 = "invalid?";
  if (failure === "duplicate-descriptor") data.backup.files.push({ ...file });
  if (failure === "wrong-record") file.recordId = "different";
  if (failure === "path-name") file.name = "../logo.svg";
  await expect(readScopedImport(new File([JSON.stringify(data)], "bad.json"), "subscriptions")).rejects.toThrow("transfer_invalid_backup");
  expect(api.post).not.toHaveBeenCalled();
});

it("rejects malformed record collections with the expected validation error", async () => {
  const data = manifest("calendar");
  (data.backup.data as Record<string, unknown>).payment_records = [null];
  await expect(readScopedImport(new File([JSON.stringify(data)], "bad.json"), "calendar")).rejects.toThrow("transfer_invalid_backup");
});

it("continues to accept complete account JSON backups", async () => {
  const data = manifest("subscriptions").backup;
  data.files = [];
  data.data.subscriptions = [];
  expect((await readImportFile(new File([JSON.stringify(data)], "account.json"))).format).toBe("monline-account-backup");
});
