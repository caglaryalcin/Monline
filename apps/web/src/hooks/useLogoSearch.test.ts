import { act, renderHook, waitFor } from "@testing-library/react";

import { api } from "@/lib/api";

import { useLogoSearch } from "./useLogoSearch";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));

describe("useLogoSearch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("discards images smaller than 64 bytes without decoding them", async () => {
    const tinyBlob = new Blob(["x".repeat(32)], { type: "image/png" });
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("clearbit.com/v1/companies")
          ? { ok: false }
          : {
              ok: true,
              headers: { get: () => "image/png" },
              blob: () => Promise.resolve(tinyBlob),
            },
      ),
    );
    const createImageBitmapMock = vi.fn();
    const createObjectURL = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });

    const { result } = renderHook(() => useLogoSearch());

    act(() => result.current.setLogoSearch("tiny"));
    // The search runs after a 350 ms debounce and finishes almost instantly.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(result.current.searching).toBe(false);
      expect(result.current.showLogoResults).toBe(true);
    });
    expect(result.current.logoResults).toEqual([]);
    expect(createImageBitmapMock).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("uses the authenticated download when CORS blocks fetching a provider image", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h48v48H0z"/></svg>';
    vi.mocked(api.get).mockResolvedValue({ contentType: "image/svg+xml", base64: btoa(svg) });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.includes("clearbit.com/v1/companies")
          ? Promise.resolve({ ok: false })
          : Promise.reject(new TypeError("Failed to fetch")),
      ),
    );
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:logo"), revokeObjectURL: vi.fn() });
    const { result, unmount } = renderHook(() => useLogoSearch());
    act(() => result.current.setLogoSearch("Spotify"));
    await waitFor(() => expect(result.current.logoResults.length).toBeGreaterThan(0));
    expect(api.get).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/logo_fetch\?url=https%3A%2F%2F/),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.logoResults[0].contentType).toBe("image/svg+xml");
    expect(result.current.logoResults[0].file.size).toBe(svg.length);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:logo");
  });
});
