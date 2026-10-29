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

import { fixerService } from "./fixer";

function getCollectionMock(overrides: Record<string, unknown> = {}) {
  return {
    getList: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

describe("fixerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads global settings and propagates failures instead of hiding them", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ id: "global", provider: "fixer", api_key_configured: true })
      .mockRejectedValueOnce(new Error("boom"));
    await expect(fixerService.getSettings()).resolves.toMatchObject({
      id: "global",
      api_key_configured: true,
    });
    expect(api.get).toHaveBeenCalledWith("/api/admin/exchange");
    await expect(fixerService.getSettings()).rejects.toThrow("boom");
  });
  it("saves shared settings without an account selector", async () => {
    await fixerService.saveSettings({ enabled: true });
    expect(api.patch).toHaveBeenCalledWith("/api/admin/exchange", { enabled: true });
  });
  it("exposes safe availability and a global refresh separately", async () => {
    await fixerService.getStatus();
    expect(api.get).toHaveBeenCalledWith("/api/exchange/status");
    await fixerService.updateAllRates();
    expect(api.post).toHaveBeenCalledWith("/api/admin/exchange/update");
  });

  it("triggers a rates update through the API client", async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      updated: 5,
      base: "USD",
    });

    await fixerService.updateRates();

    expect(api.post).toHaveBeenCalledWith("/api/fixer/update", {});
  });

  it("limits a card refresh to its currency", async () => {
    await fixerService.updateRates("cur-usd");
    expect(api.post).toHaveBeenCalledWith("/api/fixer/update", { currencyId: "cur-usd" });
  });

  it("returns the last exchange update from record properties, or null on error", async () => {
    const getWithGetter = vi.fn().mockResolvedValue({
      items: [
        {
          get: vi.fn().mockReturnValue("2026-03-20T10:00:00Z"),
          last_update: "2026-03-20T10:00:00Z",
        },
      ],
    });
    const getWithProperty = vi.fn().mockResolvedValue({
      items: [{ last_update: "2026-03-21T10:00:00Z" }],
    });
    const getFailure = vi.fn().mockRejectedValue(new Error("boom"));
    const getEmpty = vi.fn().mockResolvedValue({ items: [] });
    const getMissing = vi.fn().mockResolvedValue({ items: [{}] });

    (client.collection as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(getCollectionMock({ getList: getWithGetter }))
      .mockReturnValueOnce(getCollectionMock({ getList: getWithProperty }))
      .mockReturnValueOnce(getCollectionMock({ getList: getFailure }))
      .mockReturnValueOnce(getCollectionMock({ getList: getEmpty }))
      .mockReturnValueOnce(getCollectionMock({ getList: getMissing }));

    await expect(fixerService.getLastUpdate()).resolves.toBe("2026-03-20T10:00:00Z");
    await expect(fixerService.getLastUpdate()).resolves.toBe("2026-03-21T10:00:00Z");
    await expect(fixerService.getLastUpdate()).resolves.toBeNull(); // failure
    await expect(fixerService.getLastUpdate()).resolves.toBeNull(); // empty
    await expect(fixerService.getLastUpdate()).resolves.toBeNull(); // missing

    expect(getWithGetter).toHaveBeenCalledWith(1, 1, { sort: "-last_update" });
  });
});
