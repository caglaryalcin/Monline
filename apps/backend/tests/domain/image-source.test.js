const images = require("../../src/domain/lib/pure/image-source.js");

describe("logo download validation", () => {
  it("only allows HTTPS requests to the configured image providers", () => {
    expect(images.allowedLogoUrl("https://icon.horse/icon/spotify.com")).toBe(
      true,
    );
    expect(images.allowedLogoUrl("https://cdn.simpleicons.org/spotify")).toBe(
      true,
    );
    for (const url of [
      "http://icon.horse/icon/a",
      "https://icon.horse.evil.test/a",
      "https://evil.test/icon.horse/a",
      "https://icon.horse@localhost/a",
      "https://user@icon.horse/a",
      "https://icon.horse:5000/a",
      "https://localhost/a",
      "file:///private",
    ]) {
      expect(images.allowedLogoUrl(url)).toBe(false);
    }
  });

  it("preserves the image bytes instead of converting binary data to UTF-8 text", () => {
    const png = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 255, 128, 0, 254,
    ]);
    expect(images.imageContentType(png)).toBe("image/png");
    expect(images.toBase64(png)).toBe(Buffer.from(png).toString("base64"));
    expect(images.imageContentType(Buffer.from("<html>error</html>"))).toBe(
      null,
    );
    expect(
      images.imageContentType(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      ),
    ).toBe("image/svg+xml");
  });
});
