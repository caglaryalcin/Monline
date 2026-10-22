import { exportInstanceBackup } from "./dataTransfer";
import { serverSettingsService } from "./serverSettings";

vi.mock("./serverSettings", () => ({ serverSettingsService: { backupRaw: vi.fn() } }));

it.each(["transfer_password_required", "transfer_invalid_password"])(
  "reports %s without downloading a backup",
  async (message) => {
    const blob = vi.fn();
    vi.mocked(serverSettingsService.backupRaw).mockResolvedValue({
      ok: false,
      json: async () => ({ message }),
      blob,
    } as unknown as Response);
    await expect(exportInstanceBackup("test-only-password")).rejects.toThrow(message);
    expect(serverSettingsService.backupRaw).toHaveBeenCalledWith("test-only-password");
    expect(blob).not.toHaveBeenCalled();
  },
);
