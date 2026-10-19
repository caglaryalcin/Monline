const { isValidEmail } = require("../../src/email.cjs");
const { compileFilter } = require("../../src/filter.cjs");

it("validates normal email addresses without backtracking on hostile input", () => {
  for (const value of [
    "user@example.test",
    "first.last+tag@sub.example.test",
    "o'connor@example.test",
  ])
    expect(isValidEmail(value)).toBe(true);
  for (const value of [
    null,
    1,
    "",
    "a@b",
    "@example.test",
    "a@@example.test",
    "a@b.",
    "a b@example.test",
    "a\0b@example.test",
    "!@!." + "!.".repeat(100_000),
  ])
    expect(isValidEmail(value)).toBe(false);
});

it("keeps filter strings and bound values parameterized, including escaped quotes", () => {
  const result = compileFilter(
    'name = "a\\\"b" && (price >= 1.25 || user = {:owner})',
    new Set(["name", "price", "user"]),
    { owner: "account-1" },
  );
  expect(result.values).toEqual(['a"b', 1.25, "account-1"]);
  expect(result.sql).toBe('"name" = ? AND ("price" >= ? OR "user" = ?)');
  expect(compileFilter("name = 'a\\'b'", new Set(["name"])).values).toEqual([
    "a'b",
  ]);
});

it("rejects excessive or unterminated filters before expensive parsing", () => {
  const fields = new Set(["name"]);
  for (const value of [
    'name = "' + '\\\\"'.repeat(1000),
    "name = '" + "\\\\'".repeat(1000),
    "x".repeat(100_000),
    'name = "x"' + ' || name = "x"'.repeat(200),
    { name: "x" },
  ])
    expect(() => compileFilter(value, fields)).toThrow();
  expect(() => compileFilter('password = "x"', fields)).toThrow(
    "Unknown filter field",
  );
});
