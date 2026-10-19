const {
  extractImageUrlsFromPage,
} = require("../../src/domain/lib/pure/logo-utils.js");

describe("src/domain/lib/pure/logo-utils.js", () => {
  it("extracts image URLs, upgrades protocol-relative URLs, and deduplicates", () => {
    const html = `
      <img src="https://cdn.example.com/logo.png" />
      <img src="//cdn.example.com/logo.png" />
      <img src="//cdn.example.com/logo.png" />
    `;

    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://cdn.example.com/logo.png",
    ]);
  });

  it("filters favicon, data URLs, wikipedia pages, and non-image paths", () => {
    const html = `
      <img class="favicon" src="https://cdn.example.com/favicon.png" />
      <img src="data:image/png;base64,abc" />
      <img src="https://wikipedia.org/wiki/File:Logo" />
      <img src="https://cdn.example.com/not-an-image" />
      <img src="https://cdn.example.com/real.svg" />
    `;

    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://cdn.example.com/real.svg",
    ]);
  });

  it("falls back to embedded URL detection and respects result limits", () => {
    const html = `
      https://imgs.search.brave.com/abc123
      https://encrypted-tbn0.gstatic.com/images?q=tbn:one
      https://cdn.example.com/logo-one.png
      https://cdn.example.com/logo-two.png
    `;

    expect(extractImageUrlsFromPage(html, 2)).toEqual([
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:one",
      "https://imgs.search.brave.com/abc123",
    ]);
  });

  it("does not enter the fallback block when img tags already fill the limit (line 55 false branch)", () => {
    const html = `<img src="https://cdn.example.com/logo.png" />`;
    // limit=1 is filled by the img tag → imageUrls.length === limit → fallback never entered
    expect(extractImageUrlsFromPage(html, 1)).toEqual([
      "https://cdn.example.com/logo.png",
    ]);
  });

  it("fallback pattern 3 processes plain image URLs in text (lines 69-80)", () => {
    // no img tags → fallback runs; pattern 3 matches a plain .png URL, parses it, adds it
    const html = "https://cdn.example.com/product-logo.png?v=2";
    expect(extractImageUrlsFromPage(html, 5)).toEqual([
      "https://cdn.example.com/product-logo.png?v=2",
    ]);
  });

  it("fallback skips ssl.gstatic.com/gb/images URLs (line 71 true branch)", () => {
    const html = [
      "https://ssl.gstatic.com/gb/images/toolbar.png",
      "https://cdn.example.com/real.png",
    ].join(" ");
    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://cdn.example.com/real.png",
    ]);
  });

  it("fallback skips favicons.search.brave.com plain-text URLs (line 69 true branch)", () => {
    const html =
      "https://favicons.search.brave.com/logo.png https://cdn.example.com/real.png";
    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://cdn.example.com/real.png",
    ]);
  });

  it("fallback skips wikipedia.org/wiki/ plain-text URLs (line 72 true branch)", () => {
    const html =
      "https://wikipedia.org/wiki/Logo.png https://cdn.example.com/real.png";
    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://cdn.example.com/real.png",
    ]);
  });

  it("skips img tags with no src attribute (line 47 !srcMatch branch)", () => {
    const html = `<img alt="logo" /><img src="https://cdn.example.com/real.png" />`;
    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://cdn.example.com/real.png",
    ]);
  });

  it("shouldSkipUrl filters non-http schemes, google s2/favicons, brave-logo, and resize paths in img tags", () => {
    const html = [
      `<img src="ftp://cdn.example.com/logo.png" />`,
      `<img src="https://www.google.com/s2/favicons?domain=netflix.com&sz=64" />`,
      `<img src="https://ssl.gstatic.com/gb/images/header_logo.png" />`,
      `<img src="https://favicons.search.brave.com/img.png" />`,
      `<img src="https://cdn.brave.com/brave-logo.png" />`,
      `<img src="https://cdn.example.com/img/rs:fit:16:16/logo.png" />`,
      `<img src="https://cdn.example.com/real.png" />`,
    ].join("\n");
    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://cdn.example.com/real.png",
    ]);
  });

  it("skips malformed URLs in both img tags and fallback text", () => {
    const html = `
      <img src="https://cdn.example.com:bad.png" />
      https://cdn.example.com:also-bad.png
      https://cdn.example.com/valid.png
    `;

    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://cdn.example.com/valid.png",
    ]);
  });

  it("does not trust hosts that only appear in the path, query, or userinfo", () => {
    const html = [
      `<img src="https://evil.com/imgs.search.brave.com/tracker" />`,
      `<img src="https://evil.com/?q=encrypted-tbn0.gstatic.com/images?q=tbn:x" />`,
      `<img src="https://imgs.search.brave.com@evil.com/tracker" />`,
      `<img src="https://imgs.search.brave.com/real-logo" />`,
    ].join("");
    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://imgs.search.brave.com/real-logo",
    ]);
  });

  it("only blocks gstatic toolbar and wiki pages on their real hosts", () => {
    const html = [
      `<img src="https://cdn.example.com/ssl.gstatic.com/gb/images/logo.png" />`,
      `<img src="https://cdn.example.com/wikipedia.org/wiki/logo.png" />`,
      `<img src="https://en.wikipedia.org/wiki/Logo.png" />`,
      `<img src="https://upload.wikimedia.org/wiki/Logo.png" />`,
    ].join("");
    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://cdn.example.com/ssl.gstatic.com/gb/images/logo.png",
      "https://cdn.example.com/wikipedia.org/wiki/logo.png",
    ]);
  });

  it("fallback skips URLs whose image extension is only in the query or whose host is empty", () => {
    const html =
      "https://cdn.example.com/page?file=logo.png https://?x.png https://cdn.example.com/ok.png";
    expect(extractImageUrlsFromPage(html, 10)).toEqual([
      "https://cdn.example.com/ok.png",
    ]);
  });

  it("works without a global URL parser", () => {
    const originalUrl = globalThis.URL;
    // goja exposes no URL constructor; the parser must not rely on it.
    delete globalThis.URL;
    try {
      const html = [
        `<img src="https://cdn.example.com/logo.png" />`,
        `<img src="//cdn.example.com/other.svg" />`,
        "https://imgs.search.brave.com/abc123",
      ].join(" ");
      expect(extractImageUrlsFromPage(html, 10)).toEqual([
        "https://cdn.example.com/logo.png",
        "https://cdn.example.com/other.svg",
        "https://imgs.search.brave.com/abc123",
      ]);
    } finally {
      globalThis.URL = originalUrl;
    }
  });
});
