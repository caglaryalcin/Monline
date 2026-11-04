import { Blob as NodeBlob, File as NodeFile } from "node:buffer";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import { useLogoSearch } from "@/hooks/useLogoSearch";

// Image decoding is covered separately; these tests verify the lookup/save flow.
vi.mock("@/lib/subscriptionLogo", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  prepareLogoBlob: async (blob: Blob) => blob,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([
  ["SimpleLogin", "/assets/logos/simplelogin.svg", "simplelogin"],
  ["Google Workspace", "/assets/logos/google-workspace.png", "googleworkspace"],
])("selects and saves the bundled logo for %s without a favicon request", async (name, asset, slug) => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><path d="M0 0h192v192H0z"/></svg>';
  const fetchLogo = vi.fn(async (url: string) => {
    if (url !== asset) throw new Error("Unexpected remote lookup");
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
  });
  vi.stubGlobal("fetch", fetchLogo);
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("File", NodeFile);
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:bundled-logo"), revokeObjectURL: vi.fn() });
  const { result } = renderHook(() => useLogoSearch(name));
  let saved: File | null = null;
  await act(async () => { saved = await result.current.resolveLogoFile(name); });
  await waitFor(() => expect(result.current.logoFile?.name).toBe(`logo-${slug}.svg`));
  expect(saved).toBeInstanceOf(NodeFile);
  expect(await saved!.text()).toBe(svg);
  expect(result.current.logoUrl).toBe(asset);
  expect(fetchLogo).toHaveBeenCalledTimes(1);
  expect(fetchLogo).toHaveBeenCalledWith(asset, expect.any(Object));
});
