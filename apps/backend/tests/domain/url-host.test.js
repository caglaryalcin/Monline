const {
  parseHttpUrl,
  isHostOrSubdomain,
} = require("../../src/domain/lib/pure/url-host.js");

describe("src/domain/lib/pure/url-host.js", () => {
  it("parses host, path, and query of absolute http(s) URLs", () => {
    expect(
      parseHttpUrl("https://Imgs.Search.Brave.com/abc/x.png?q=1#frag"),
    ).toEqual({
      host: "imgs.search.brave.com",
      path: "/abc/x.png",
      query: "q=1",
    });
    expect(parseHttpUrl("http://example.com")).toEqual({
      host: "example.com",
      path: "/",
      query: "",
    });
    expect(parseHttpUrl("  https://example.com:8443/a  ")).toEqual({
      host: "example.com",
      path: "/a",
      query: "",
    });
    expect(parseHttpUrl("https://[::1]:8080/x")?.host).toBe("[::1]");
  });

  it("reads the real host, not trusted names placed in userinfo, path, or query", () => {
    expect(
      parseHttpUrl("https://imgs.search.brave.com@evil.com/x.png")?.host,
    ).toBe("evil.com");
    expect(
      parseHttpUrl("https://evil.com/imgs.search.brave.com/x.png")?.host,
    ).toBe("evil.com");
    expect(
      parseHttpUrl("https://evil.com/?generativelanguage.googleapis.com")?.host,
    ).toBe("evil.com");
  });

  it("rejects non-http schemes, relative URLs, and empty hosts", () => {
    expect(parseHttpUrl("ftp://example.com/x.png")).toBeNull();
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("//example.com/x.png")).toBeNull();
    expect(parseHttpUrl("https:///x.png")).toBeNull();
    expect(parseHttpUrl("https://example.com:bad.png")).toBeNull();
    expect(parseHttpUrl(null)).toBeNull();
  });

  it("matches a domain and its subdomains only", () => {
    expect(isHostOrSubdomain("wikipedia.org", "wikipedia.org")).toBe(true);
    expect(isHostOrSubdomain("en.wikipedia.org", "wikipedia.org")).toBe(true);
    expect(isHostOrSubdomain("notwikipedia.org", "wikipedia.org")).toBe(false);
    expect(isHostOrSubdomain("wikipedia.org.evil.com", "wikipedia.org")).toBe(
      false,
    );
  });
});
