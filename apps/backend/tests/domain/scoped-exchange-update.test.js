const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const runtime = require("../../src/runtime.cjs");
const { Repository, DataRecord } = require("../../src/storage.cjs");

let directory, repository, server, base, send;
function createCurrency(id, code, rate, user = "owner", isMain = false) {
  const record = new DataRecord(
    repository.findCollectionByNameOrId("currencies"),
  );
  for (const [key, value] of Object.entries({
    id,
    name: code,
    symbol: code,
    code,
    rate,
    user,
    is_main: isMain,
  }))
    record.set(key, value);
  repository.save(record);
}
function rate(id) {
  return repository.findRecordById("currencies", id).get("rate");
}
async function update(body, user = "owner") {
  const response = await fetch(base + "/api/fixer/update", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Test-User": user },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-scoped-rates-"));
  repository = new Repository(directory);
  repository.connection
    .prepare("INSERT INTO users (id, email) VALUES (?, ?)")
    .run("owner", "owner@example.test");
  repository.connection
    .prepare("INSERT INTO users (id, email) VALUES (?, ?)")
    .run("other", "other@example.test");
  createCurrency("try000000000000", "TRY", 1, "owner", true);
  createCurrency("usd000000000000", "USD", 0.02);
  createCurrency("eur000000000000", "EUR", 0.018);
  createCurrency("otherusd0000000", "USD", 7, "other");
  const settings = new DataRecord(
    repository.findCollectionByNameOrId("fixer_settings"),
  );
  settings.set("user", "owner");
  settings.set("api_key", "test-key");
  repository.save(settings);
  send = vi.spyOn(runtime.httpClient, "send").mockResolvedValue({
    statusCode: 200,
    json: { success: true, rates: { EUR: 1, TRY: 50, USD: 1.2 } },
  });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = req.get("X-Test-User") ? { id: req.get("X-Test-User") } : null;
    next();
  });
  runtime.configure(app, repository, {});
  delete require.cache[require.resolve("../../src/domain/routes_fixer.js")];
  require("../../src/domain/routes_fixer.js");
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ error: error.message }),
  );
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (server) await new Promise((resolve) => server.close(resolve));
  repository?.connection.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
it("updates only USD against TRY, leaving EUR and other owners untouched", async () => {
  expect(await update({ currencyId: "usd000000000000" })).toEqual({
    status: 200,
    data: { updated: 1, base: "TRY" },
  });
  expect(rate("usd000000000000")).toBeCloseTo(1.2 / 50);
  expect(rate("try000000000000")).toBe(1);
  expect(rate("eur000000000000")).toBe(0.018);
  expect(rate("otherusd0000000")).toBe(7);
  expect(send).toHaveBeenCalledTimes(1);
});
it.each([
  ["EUR", "USD", 1.2],
  ["USD", "EUR", 1 / 1.2],
  ["GBP", "JPY", 160 / 0.8],
  ["JPY", "GBP", 0.8 / 160],
])(
  "updates %s-based %s rates without changing unrelated currencies",
  async (mainCode, cardCode, expectedRate) => {
    repository.connection.exec(
      "UPDATE currencies SET is_main = 0 WHERE user = 'owner'",
    );
    for (const code of [mainCode, cardCode]) {
      const id = code.toLowerCase().padEnd(15, "0");
      const existing = repository.findRecordsByFilter(
        "currencies",
        "user = {:u} && code = {:code}",
        "",
        1,
        0,
        { u: "owner", code },
      );
      if (!existing.length) createCurrency(id, code, 0.5);
    }
    const mainId = mainCode.toLowerCase().padEnd(15, "0");
    const main = repository.findRecordById("currencies", mainId);
    main.set("is_main", true);
    main.set("rate", 1);
    repository.save(main);
    const cardId = cardCode.toLowerCase().padEnd(15, "0");
    const before = repository
      .findRecordsByFilter("currencies")
      .map((currency) => [currency.id, currency.get("rate")]);
    send.mockResolvedValue({
      statusCode: 200,
      json: { rates: { EUR: 1, USD: 1.2, TRY: 50, GBP: 0.8, JPY: 160 } },
    });

    expect(await update({ currencyId: cardId })).toEqual({
      status: 200,
      data: { updated: 1, base: mainCode },
    });
    expect(rate(cardId)).toBeCloseTo(expectedRate);
    for (const [id, previousRate] of before) {
      if (id !== cardId) expect(rate(id)).toBe(previousRate);
    }
  },
);

it("keeps the settings page's full currency update available", async () => {
  expect(await update({})).toEqual({
    status: 200,
    data: { updated: 3, base: "TRY" },
  });
  expect(rate("usd000000000000")).toBeCloseTo(1.2 / 50);
  expect(rate("eur000000000000")).toBeCloseTo(1 / 50);
  expect(rate("otherusd0000000")).toBe(7);
});
it("skips the main currency without requiring an API key or provider request", async () => {
  repository.connection.exec("DELETE FROM fixer_settings");
  expect(await update({ currencyId: "try000000000000" })).toEqual({
    status: 200,
    data: { updated: 0, base: "TRY" },
  });
  expect(send).not.toHaveBeenCalled();
});
it.each(["otherusd0000000", "absent"])(
  "rejects inaccessible currency %s before contacting the provider",
  async (currencyId) => {
    expect((await update({ currencyId })).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
    expect(rate("otherusd0000000")).toBe(7);
  },
);
it.each([[""], [null], [42], [[]]])(
  "rejects malformed currency IDs: %j",
  async (currencyId) => {
    expect((await update({ currencyId })).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  },
);
it.each([undefined, 0, -1])(
  "reports missing or invalid USD rate %s without overwriting stored rates",
  async (usd) => {
    send.mockResolvedValue({
      statusCode: 200,
      json: { rates: { TRY: 50, ...(usd === undefined ? {} : { USD: usd }) } },
    });
    expect((await update({ currencyId: "usd000000000000" })).status).toBe(502);
    expect(rate("usd000000000000")).toBe(0.02);
    expect(rate("eur000000000000")).toBe(0.018);
  },
);
it("requires authentication for a targeted update", async () => {
  expect((await update({ currencyId: "usd000000000000" }, "")).status).toBe(
    403,
  );
  expect(send).not.toHaveBeenCalled();
});
