vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
    post: vi.fn(),
    postForm: vi.fn(),
  },
}));

vi.mock("@/lib/client", () => ({
  default: {
    baseUrl: "https://client.example.com",
    authStore: {
      token: "admin-token",
    },
    collection: vi.fn(),
  },
}));

import { api } from "@/lib/api";

import { serverSettingsService } from "./serverSettings";

describe("serverSettingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proxies settings and smtp endpoints", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (api.patch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await serverSettingsService.getSettings();
    await serverSettingsService.updateSettings({ disable_login: true });
    await serverSettingsService.getSmtp();
    await serverSettingsService.updateSmtp({ smtp_host: "mail.example.com" });
    await serverSettingsService.testSmtp();

    expect(api.get).toHaveBeenNthCalledWith(1, "/api/admin/settings");
    expect(api.patch).toHaveBeenCalledWith("/api/admin/settings", {
      disable_login: true,
    });
    expect(api.get).toHaveBeenNthCalledWith(2, "/api/admin/smtp");
    expect(api.post).toHaveBeenNthCalledWith(1, "/api/admin/smtp", {
      smtp_host: "mail.example.com",
    });
    expect(api.post).toHaveBeenNthCalledWith(2, "/api/admin/smtp/test");
  });

  it("backs up, restores, and deletes unused logos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const formData = new FormData();
    formData.append("file", new Blob(["db"]), "backup.zip");
    vi.stubGlobal("fetch", fetchMock);
    (api.postForm as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await serverSettingsService.backupRaw("test-only-password");
    await serverSettingsService.restore(formData);
    await serverSettingsService.deleteUnusedLogos();

    expect(fetchMock).toHaveBeenCalledWith("/api/db/backup", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
      body: JSON.stringify({ password: "test-only-password" }),
    });
    expect(api.postForm).toHaveBeenCalledWith("/api/db/restore", formData, { timeoutMs: 600_000 });
    expect(api.post).toHaveBeenNthCalledWith(1, "/api/admin/deleteunusedlogos");
  });
});
