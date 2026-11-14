const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const runtime = require("../../src/runtime.cjs");
const { subscriptionPrice } = require("../../src/domain/lib/pure/subscription-prices.mjs");

let directory, repository, server, owner, sub, currency;
function create(collection, values) {
  const record = new DataRecord(repository.findCollectionByNameOrId(collection));
  for (const [key, value] of Object.entries(values)) record.set(key, value);
  return repository.save(record);
}
function day(offset) { return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10); }
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-reactivate-release-"));
  repository = new Repository(directory);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = req.get("x-owner") === "none" ? null : owner; next(); });
  runtime.configure(app, repository, {});
  for (const name of ["routes_reactivation.js", "subscription_reactivation.js", "subscription_history.js", "subscription_category.js", "subscription_start.js", "statement_schedule.js"]) {
    delete require.cache[require.resolve("../../src/domain/" + name)];
    require("../../src/domain/" + name);
  }
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  owner = create("users", { email: "reactivate@example.test", password: "fixture" });
  currency = create("currencies", { user: owner.id, name: "Turkish Lira", code: "TRY", symbol: "₺", rate: 1, is_main: true });
  const cycle = create("cycles", { name: "Monthly" });
  const category = create("categories", { user: owner.id, name: "Streaming" });
  sub = create("subscriptions", { user: owner.id, name: "Streaming", price: 100, category: category.id,
    currency: currency.id, cycle: cycle.id, frequency: 1, inactive: true, auto_renew: true,
    start_date: day(-90), next_payment: day(-10) });
  server = await new Promise(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
});
afterEach(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  repository.connection.close();
  const target = path.resolve(directory);
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("monline-reactivate-release-")) throw Error("Unexpected fixture path");
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
function request(body = {}, user = "owner") {
  return fetch("http://127.0.0.1:" + server.address().port + "/api/subscriptions/" + sub.id + "/reactivate", {
    method: "POST", headers: { "Content-Type": "application/json", "x-owner": user },
    body: JSON.stringify({ paid_date: day(-1), next_payment: day(30), expected_next_payment: sub.getString("next_payment"),
      expected_currency: currency.id, price: 180, utc_offset_minutes: 0, paid_utc_offset_minutes: 0, ...body }),
  });
}
function records() { return repository.findRecordsByFilter("payment_records", "subscription_id = {:id}", "due_date", 0, 0, { id: sub.id }); }
it("reactivates with one paid record and a new future price without rewriting historical prices", async () => {
  const old = create("payment_records", { user: owner.id, subscription_id: sub.id, currency: currency.id,
    due_date: day(-40), paid_at: day(-40) + "T12:00:00Z", amount: 100, auto_paid: false });
  const response = await request();
  expect(response.status, JSON.stringify(await response.json())).toBe(200);
  const updated = repository.findRecordById("subscriptions", sub.id);
  expect(updated.getBool("inactive")).toBe(false);
  expect(updated.getString("next_payment")).toBe(day(30));
  expect(subscriptionPrice(updated, day(30))).toBe(180);
  expect(subscriptionPrice(updated, day(-40))).toBe(100);
  expect(records()).toHaveLength(2);
  expect(records().find(record => record.id !== old.id).getFloat("amount")).toBe(180);
  expect(repository.findRecordById("payment_records", old.id).getFloat("amount")).toBe(100);
});
it("confirms a pending record without creating duplicates and cannot reactivate twice", async () => {
  const pending = create("payment_records", { user: owner.id, subscription_id: sub.id, currency: currency.id, due_date: day(-1), amount: 100 });
  expect((await request()).status).toBe(200);
  expect(records()).toHaveLength(1);
  expect(repository.findRecordById("payment_records", pending.id).getFloat("amount")).toBe(180);
  expect((await request()).status).toBe(400);
  expect(records()).toHaveLength(1);
});
it("preserves an existing paid record when the renewed amount changes", async () => {
  create("payment_records", { user: owner.id, subscription_id: sub.id, currency: currency.id, due_date: day(-1), amount: 100, paid_at: day(-1) + "T12:00:00Z" });
  expect((await request()).status).toBe(200);
  expect(records()).toHaveLength(1);
  expect(records()[0].getFloat("amount")).toBe(100);
});
it.each([{price: -1}, {paid_date: day(1)}, {next_payment: day(-1)}, {expected_currency: "changed"}, {expected_next_payment: "changed"}])("rejects invalid or stale requests atomically: %j", async (body) => {
  expect((await request(body)).status).toBe(400);
  expect(repository.findRecordById("subscriptions", sub.id).getBool("inactive")).toBe(true);
  expect(records()).toHaveLength(0);
});
it("requires authentication and rolls the payment back if activation fails", async () => {
  expect((await request({}, "none")).status).toBe(401);
  const originalSave = repository.save.bind(repository);
  const save = vi.spyOn(repository, "save").mockImplementation(record => {
    if (record.collection().name === "subscriptions" && !record.getBool("inactive")) throw Error("fixture activation failure");
    return originalSave(record);
  });
  expect((await request()).status).toBe(500);
  expect(records()).toHaveLength(0);
  expect(repository.findRecordById("subscriptions", sub.id).getBool("inactive")).toBe(true);
  save.mockRestore();
});
