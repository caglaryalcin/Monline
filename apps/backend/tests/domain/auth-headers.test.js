const {
  extractBearerToken,
} = require("../../src/domain/lib/pure/auth-headers.js");

describe("src/domain/lib/pure/auth-headers.js", () => {
  it("extracts bearer tokens case-insensitively and trims whitespace", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("bearer   xyz789  ")).toBe("xyz789");
    expect(extractBearerToken("plain-value")).toBe("plain-value");
  });

  it("returns an empty string for null or undefined header values", () => {
    expect(extractBearerToken(null)).toBe("");
    expect(extractBearerToken(undefined)).toBe("");
  });
});
