const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const root = path.resolve(process.env.MONLINE_TEST_ROOT || ".");
const load = (file) => require(path.join(root, "apps/backend/src", file));
const { Repository, DataRecord } = load("storage.cjs");
const { quickPay } = load("domain/lib/quick-payment.js");
const now = new Date("2026-11-04T12:00:00Z");

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-quick-pay-"));
  const app = new Repository(directory);
  t.after(() => {
    app.connection.close();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith("monline-quick-pay-"));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const create = (name, values) => {
    const record = new DataRecord(app.findCollectionByNameOrId(name));
    for (const [key, value] of Object.entries(values)) record.set(key, value);
    return app.save(record);
  };
  const user = create("users", { email: "quick@example.test", password: "test-only", name: "User", payment_tracking: true });
  const currency = create("currencies", { user: user.id, code: "TRY", name: "Lira", symbol: "₺", rate: 1 });
  const cycle = create("cycles", { name: "Monthly" });
  const sub = create("subscriptions", { user: user.id, name: "Plan", price: 100, currency: currency.id, cycle: cycle.id,
    frequency: 1, next_payment: "2026-11-06", start_date: "2026-01-06", auto_renew: true, record_type: "expense" });
  const body = { due_date: "2026-11-06", expected_amount: 100, expected_currency: currency.id, utc_offset_minutes: -180 };
  const pay = (input = {}, owner = user.id, at = now) => quickPay(app, owner, sub.id, { ...body, ...input }, at);
  const payment = (values = {}) => create("payment_records", { user: user.id, subscription_id: sub.id,
    due_date: "2026-10-06", amount: 87, currency: currency.id, ...values });
  return { app, create, user, currency, sub, pay, payment, body };
}

test("creates one confirmed payment and retries leave it unchanged", (t) => {
  const f = fixture(t);
  const before = f.sub.publicExport();
  const result = f.pay();
  const saved = result.publicExport();
  assert.equal(result.get("amount"), 100);
  assert.equal(result.getString("paid_at"), now.toISOString());
  assert.equal(result.get("auto_paid"), false);
  assert.equal(f.pay({}, f.user.id, new Date("2026-11-04T12:01:00Z")).id, result.id);
  assert.equal(f.app.countRecords("payment_records"), 1);
  assert.deepEqual(f.app.findRecordById("payment_records", result.id).publicExport(), saved);
  assert.deepEqual(f.app.findRecordById("subscriptions", f.sub.id).publicExport(), before);
});

test("confirms a past pending record without replacing its amount, notes or moved date", (t) => {
  const f = fixture(t);
  const pending = f.payment({ scheduled_date: "2026-10-05", notes: "Keep this note" });
  const oldPaid = f.payment({ due_date: "2026-09-06", amount: 51, paid_at: "2026-09-06T11:00:00Z" });
  const old = oldPaid.publicExport();
  const saved = f.pay({ due_date: "2026-10-06", expected_amount: 87 });
  assert.equal(saved.id, pending.id);
  assert.equal(saved.get("amount"), 87);
  assert.equal(saved.getString("notes"), "Keep this note");
  assert.equal(saved.getString("scheduled_date"), "2026-10-05");
  assert.deepEqual(f.app.findRecordById("payment_records", oldPaid.id).publicExport(), old);
});

for (const [field, value] of [["inactive", true], ["auto_mark_paid", true], ["record_type", "credit"]])
  test(`rejects subscriptions with ${field}=${value}`, (t) => {
    const f = fixture(t);
    f.sub.set(field, value); f.app.save(f.sub);
    assert.throws(() => f.pay(), /quick_payment_unavailable/);
    assert.equal(f.app.countRecords("payment_records"), 0);
  });

test("requires payment tracking and ownership", (t) => {
  const f = fixture(t);
  assert.throws(() => f.pay({}, "another-user"), /Record not found/);
  f.user.set("payment_tracking", false); f.app.save(f.user);
  assert.throws(() => f.pay(), /quick_payment_unavailable/);
});

test("rejects arbitrary, invalid and early dates without writing anything", (t) => {
  const f = fixture(t);
  for (const due_date of ["2026-11-07", "2026-11-03", "2026-02-30", "invalid"])
    assert.throws(() => f.pay({ due_date }), /quick_payment_unavailable/);
  for (const utc_offset_minutes of [undefined, 841, -841, 1.5])
    assert.throws(() => f.pay({ utc_offset_minutes }), /quick_payment_unavailable/);
  assert.equal(f.app.countRecords("payment_records"), 0);
});

test("uses the user's calendar day for the two-day window", (t) => {
  const f = fixture(t);
  assert.throws(() => f.pay({ utc_offset_minutes: 300 }, f.user.id, new Date("2026-11-04T01:00:00Z")), /quick_payment_unavailable/);
  assert(f.pay({ utc_offset_minutes: -180 }, f.user.id, new Date("2026-11-04T01:00:00Z")).id);
});

test("does not recreate a moved occurrence on its original date", (t) => {
  const f = fixture(t);
  const pending = f.payment({ due_date: "2026-11-10", scheduled_date: "2026-11-06" });
  assert.throws(() => f.pay(), /quick_payment_unavailable/);
  assert.equal(f.app.countRecords("payment_records"), 1);
  assert.equal(f.app.findRecordById("payment_records", pending.id).getString("paid_at"), "");
});

test("checks the confirmed amount and currency against current server data", (t) => {
  const f = fixture(t);
  assert.throws(() => f.pay({ expected_amount: 99 }), /quick_payment_changed/);
  assert.throws(() => f.pay({ expected_currency: "another-currency" }), /quick_payment_changed/);
  f.sub.set("price_changes", [{ effective_date: "2026-11-05", price: 120 }]); f.app.save(f.sub);
  assert.throws(() => f.pay(), /quick_payment_changed/);
  assert.equal(f.pay({ expected_amount: 120 }).get("amount"), 120);
});

test("a successful payment is respected when the schedule advances", (t) => {
  const f = fixture(t);
  const paid = f.pay().publicExport();
  load("domain/lib/subscription-schedule.js").advanceSubscription(f.app, f.sub.id, "2026-11-06");
  assert.equal(f.app.countRecords("payment_records"), 1);
  assert.deepEqual(f.app.findRecordById("payment_records", paid.id).publicExport(), paid);
  assert.equal(f.app.findRecordById("subscriptions", f.sub.id).getString("next_payment"), "2026-12-06");
});

test("subscription-scoped export imports without fixer_settings and skips duplicates", (t) => {
  const f = fixture(t);
  const { exportScope, importScope } = load("domain/lib/scoped-transfer.js");
  const backup = exportScope(f.app, f.user.id, "subscriptions");
  assert(!Object.hasOwn(backup.backup.data, "fixer_settings"));
  const other = f.create("users", { email: "import@example.test", password: "test-only", name: "Import target" });
  const result = importScope(f.app, other.id, "subscriptions", backup);
  assert(result.imported > 0);
  assert(importScope(f.app, other.id, "subscriptions", backup).skipped > 0);
  const imported = f.app.findRecordsByFilter("subscriptions", "user = {:user}", "", 0, 0, { user: other.id });
  assert.equal(imported.length, 1);
  assert.equal(imported[0].getString("name"), "Plan");
  assert.equal(f.app.findRecordById("subscriptions", f.sub.id).getString("user"), f.user.id);
});

test("HTTP quick-pay requires authentication and ownership, and is idempotent", async (t) => {
  const f = fixture(t);
  const express = require(require.resolve("express", { paths: [path.join(root, "apps/backend")] }));
  const app = express();
  app.use(express.json());
  const other = f.create("users", { email: "other@example.test", password: "fixture-only", name: "Other" });
  app.use((req, _res, next) => {
    req.user = req.get("x-fixture-user") === "owner" ? f.user : req.get("x-fixture-user") === "other" ? other : null;
    next();
  });
  load("runtime.cjs").configure(app, f.app, {});
  const filename = path.join(root, "apps/backend/src/domain/routes_payment_history.js");
  delete require.cache[require.resolve(filename)];
  require(filename);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  const server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const due_date = new Date().toISOString().slice(0, 10);
  f.sub.set("next_payment", due_date); f.app.save(f.sub);
  const send = (user) => fetch(`http://127.0.0.1:${server.address().port}/api/subscriptions/${f.sub.id}/quick-pay`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(user ? { "x-fixture-user": user } : {}) },
    body: JSON.stringify({ ...f.body, due_date, utc_offset_minutes: 0 }),
  });
  assert.equal((await send()).status, 401);
  assert.equal((await send("other")).status, 404);
  const first = await send("owner");
  assert.equal(first.status, 200);
  const result = await first.json();
  assert(result.payment_id);
  assert.deepEqual(await (await send("owner")).json(), result);
  assert.equal(f.app.countRecords("payment_records"), 1);
});
