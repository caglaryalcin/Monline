vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("@/lib/client", () => ({
  default: {
    collection: vi.fn(),
    filter: vi.fn(),
  },
}));

import { api } from "@/lib/api";
import client from "@/lib/client";

import { notificationsService } from "./notifications";

function getCollectionMock(overrides: Record<string, unknown> = {}) {
  return {
    getList: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

describe("notificationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the authenticated account's preferences including shared availability", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ id: "", email_enabled: false, available_channels: { email: true } })
      .mockRejectedValueOnce(new Error("boom"));
    await expect(notificationsService.getConfig("user-1")).resolves.toMatchObject({
      available_channels: { email: true },
    });
    expect(api.get).toHaveBeenCalledWith("/api/notifications/preferences");
    await expect(notificationsService.getConfig("user-1")).rejects.toThrow("boom");
  });
  it("loads and saves shared channels through admin endpoints", async () => {
    await notificationsService.getChannels();
    await notificationsService.saveChannels({ telegram_chat_id: "shared" });
    expect(api.get).toHaveBeenCalledWith("/api/admin/channels");
    expect(api.patch).toHaveBeenCalledWith("/api/admin/channels", { telegram_chat_id: "shared" });
  });

  it("creates, updates, and tests notification config", async () => {
    const create = vi.fn();
    const update = vi.fn();
    (client.collection as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(getCollectionMock({ create }))
      .mockReturnValueOnce(getCollectionMock({ update }));
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: "sent",
    });

    await notificationsService.createConfig({ email_enabled: true });
    await notificationsService.updateConfig("cfg-1", { email_enabled: false });
    await notificationsService.test("email");

    expect(create).toHaveBeenCalledWith({ email_enabled: true });
    expect(update).toHaveBeenCalledWith("cfg-1", { email_enabled: false });
    expect(api.post).toHaveBeenCalledWith("/api/notifications/test", {
      provider: "email",
    });
  });

  it("sends draft credentials in a separate test payload, including empty values", async () => {
    const draft = { ntfy_username: "demo", ntfy_password: "test-password", ntfy_auth_token: "" };
    await notificationsService.test("ntfy", draft);
    expect(api.post).toHaveBeenCalledWith("/api/notifications/test", {
      provider: "ntfy",
      config: draft,
    });
  });
});
