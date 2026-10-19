import { automaticLogoUrls, isLegacyWorkspaceLogo } from "./subscriptionLogo";

describe("automatic subscription icons", () => {
  it.each([
    "https://google.com",
    "https://www.google.com/workspace",
    "https://workspace.google.com",
    "https://nas.local",
  ])("keeps Workspace's bundled logo first for legacy URL %s", (url) => {
    expect(automaticLogoUrls({ name: "Google Workspace", url })[0]).toBe(
      "/assets/logos/google-workspace.png",
    );
  });
  it.each([
    "0123456789abcdef_logo-workspace.google.com.webp",
    "logo-google.webp",
    "logo-googleworkspace.png",
    "logo.webp",
    "logo_workspace_google_com_abcdefghij.webp",
  ])("recognizes the legacy automatic Workspace filename %s", (logo) => {
    expect(isLegacyWorkspaceLogo({ name: "Google Workspace", logo })).toBe(true);
    expect(isLegacyWorkspaceLogo({ name: "Google One", logo })).toBe(false);
  });
  it("keeps custom uploaded Workspace filenames intact", () => {
    expect(
      isLegacyWorkspaceLogo({
        name: "Google Workspace",
        logo: "0123456789abcdef_custom-company-logo.webp",
      }),
    ).toBe(false);
  });
  it.each(["Google Workspace", "Google Workspace Business Standard", "G Suite", "GSuite"])(
    "uses the bundled Workspace logo for %s",
    (name) => {
      expect(automaticLogoUrls({ name, url: "" })[0]).toBe("/assets/logos/google-workspace.png");
    },
  );
  it("keeps the Workspace override separate from other Google services", () => {
    for (const name of ["Google", "Google One", "Google Drive"])
      expect(automaticLogoUrls({ name, url: "" })).not.toContain(
        "/assets/logos/google-workspace.png",
      );
  });
  it("sends only the public hostname, excluding credentials, paths and queries", () => {
    expect(
      automaticLogoUrls({
        name: "Custom",
        url: "https://name:secret@www.example.com/billing?token=private#details",
      }),
    ).toEqual([
      "https://icon.horse/icon/example.com",
      "https://icons.duckduckgo.com/ip3/example.com.ico",
    ]);
  });

  it.each([
    "http://192.168.1.1",
    "http://localhost:5000",
    "https://nas.local",
    "https://nas.lan",
    "https://nas.internal",
    "https://example.test",
    "file:///private",
    "https://[::1]",
  ])("does not disclose local or unsupported address %s", (url) => {
    expect(automaticLogoUrls({ name: "Custom", url })).toEqual([]);
  });
});
