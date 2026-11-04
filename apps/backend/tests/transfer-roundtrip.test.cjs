const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const root = path.resolve(process.env.MONLINE_TEST_ROOT || ".");
const load = (file) => require(path.join(root, "apps/backend/src", file));
const { Repository, DataRecord } = load("storage.cjs");
const { fileFromBytes } = load("runtime.cjs").files;
const { exportScope, importScope } = load("domain/lib/scoped-transfer.js");
const account = load("domain/lib/account-backup.js");
const logo = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="red" d="M0 0h32v32H0z"/></svg>');
const proof = Buffer.from("%PDF-1.4\nfixture payment proof\n%%EOF\n");

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-transfer-"));
  const source = new Repository(path.join(directory, "source"));
  const target = new Repository(path.join(directory, "target"));
  t.after(() => {
    source.connection.close(); target.connection.close();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith("monline-transfer-"));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const create = (app, name, values) => {
    const record = new DataRecord(app.findCollectionByNameOrId(name));
    for (const [key, value] of Object.entries(values)) record.set(key, value);
    return app.save(record);
  };
  const owner = create(source, "users", { email: "source@example.test", password: "fixture-only", name: "Source", monthly_budget: 700 });
  const recipient = create(target, "users", { email: "target@example.test", password: "fixture-only", name: "Target", monthly_budget: 900 });
  const foreign = create(source, "users", { email: "private@example.test", password: "fixture-only", name: "Private" });
  const cycle = create(source, "cycles", { name: "Monthly" });
  create(target, "cycles", { name: "Monthly" });
  const currency = create(source, "currencies", { user: owner.id, name: "Lira", code: "TRY", symbol: "₺", rate: 1, is_main: true });
  const category = create(source, "categories", { user: owner.id, name: "Plans", color: "#abcdef" });
  const payer = create(source, "household", { user: owner.id, name: "Payer", is_main: true });
  const method = create(source, "payment_methods", { user: owner.id, name: "Card", icon: fileFromBytes(logo, "card.svg"), is_main: true });
  const sub = create(source, "subscriptions", {
    user: owner.id, name: "Google Workspace", brand_name: "Google Workspace", price: 100, currency: currency.id,
    cycle: cycle.id, frequency: 3, next_payment: "2027-01-04", start_date: "2026-01-04", auto_renew: true,
    category: category.id, payer: payer.id, payment_method: method.id, logo: fileFromBytes(logo, "custom-logo.svg"),
    price_changes: [{ effective_date: "2027-01-01", price: 120 }], notify: false,
  });
  const pending = create(source, "payment_records", { user: owner.id, subscription_id: sub.id, due_date: "2026-10-04", amount: 87, paid_at: "", scheduled_date: "2026-10-03", notes: "Unpaid and moved" });
  const paid = create(source, "payment_records", { user: owner.id, subscription_id: "", name: "Independent", brand_name: "SimpleLogin", currency: currency.id,
    due_date: "2026-09-05", paid_at: "2026-09-06T12:00:00Z", amount: 45.67, notes: "Original note", proof: fileFromBytes(proof, "proof.pdf"), logo: fileFromBytes(logo, "payment.svg") });
  create(source, "subscription_history", { user: owner.id, subscription_id: sub.id, event_type: "created", effective_date: "2026-01-04", new_price: 100, new_cycle: "Monthly", new_frequency: 3, new_currency: "TRY" });
  create(source, "categories", { user: foreign.id, name: "Private category" });
  const own = (app, name, id = recipient.id) => app.findRecordsByFilter(name, "user = {:owner}", "", 0, 0, { owner: id });
  const embed = (data, app = source) => {
    const cloned = structuredClone(data);
    const backup = cloned.backup || cloned;
    for (const file of backup.files) {
      const collection = file.sourceCollection || file.collection;
      const id = file.sourceRecordId || file.recordId;
      file.base64 = fs.readFileSync(path.join(app.directory, "storage", collection, id, file.name)).toString("base64");
    }
    return cloned;
  };
  const bytes = (app, collection, record, field) => fs.readFileSync(path.join(app.directory, "storage", collection, record.id, record.getString(field)));
  return { source, target, owner, recipient, foreign, sub, pending, paid, currency, category, payer, method, create, own, embed, bytes };
}

test("subscription round trip preserves relations, files, price schedules and settings", (t) => {
  const f = fixture(t);
  const exported = f.embed(exportScope(f.source, f.owner.id, "subscriptions"));
  assert.equal(exported.backup.data.payment_records.length, 0);
  assert.equal(exported.backup.data.categories.length, 1);
  importScope(f.target, f.recipient.id, "subscriptions", exported);
  const [sub] = f.own(f.target, "subscriptions");
  assert.equal(sub.getString("name"), "Google Workspace");
  assert.equal(sub.get("frequency"), 3);
  assert.deepEqual(sub.get("price_changes"), [{ effective_date: "2027-01-01", price: 120 }]);
  assert.equal(f.target.findRecordById("categories", sub.getString("category")).getString("name"), "Plans");
  assert.equal(f.target.findRecordById("currencies", sub.getString("currency")).getString("code"), "TRY");
  assert.equal(f.target.findRecordById("cycles", sub.getString("cycle")).getString("name"), "Monthly");
  assert.deepEqual(f.bytes(f.target, "subscriptions", sub, "logo"), logo);
  assert.deepEqual(f.bytes(f.target, "payment_methods", f.own(f.target, "payment_methods")[0], "icon"), logo);
  assert.equal(f.own(f.target, "payment_records").length, 0);
  assert.equal(f.target.findRecordById("users", f.recipient.id).get("monthly_budget"), 900);
  assert.equal(importScope(f.target, f.recipient.id, "subscriptions", exported).imported, 0);
  assert.equal(f.own(f.target, "subscriptions").length, 1);
});

test("calendar-only round trip preserves status, moved dates, documents and inherited branding", (t) => {
  const f = fixture(t);
  const exported = f.embed(exportScope(f.source, f.owner.id, "calendar"));
  importScope(f.target, f.recipient.id, "calendar", exported);
  const payments = f.own(f.target, "payment_records");
  const pending = payments.find((record) => record.getString("notes") === "Unpaid and moved");
  const paid = payments.find((record) => record.getString("name") === "Independent");
  assert.equal(pending.get("amount"), 87);
  assert.equal(pending.getString("paid_at"), "");
  assert.equal(pending.getString("scheduled_date"), "2026-10-03");
  assert.equal(pending.getString("subscription_id"), "");
  assert.equal(pending.getString("brand_name"), "Google Workspace");
  assert.deepEqual(f.bytes(f.target, "payment_records", pending, "logo"), logo);
  assert.equal(paid.get("amount"), 45.67);
  assert.equal(paid.getString("paid_at"), "2026-09-06T12:00:00Z");
  assert.deepEqual(f.bytes(f.target, "payment_records", paid, "proof"), proof);
  assert.deepEqual(f.bytes(f.target, "payment_records", paid, "logo"), logo);
  assert.equal(f.own(f.target, "subscriptions").length, 0);
  assert.equal(importScope(f.target, f.recipient.id, "calendar", exported).imported, 0);
  assert.equal(f.own(f.target, "payment_records").length, 2);
});

test("calendar import recognizes subscriptions already imported into the target account", (t) => {
  const f = fixture(t);
  importScope(f.target, f.recipient.id, "subscriptions", f.embed(exportScope(f.source, f.owner.id, "subscriptions")));
  importScope(f.target, f.recipient.id, "calendar", f.embed(exportScope(f.source, f.owner.id, "calendar")));
  const [sub] = f.own(f.target, "subscriptions");
  const pending = f.own(f.target, "payment_records").find((record) => record.getString("notes") === "Unpaid and moved");
  assert.equal(pending.getString("subscription_id"), sub.id);
});

test("full JSON round trip preserves subscriptions, calendar records and their attachments", (t) => {
  const f = fixture(t);
  const backup = f.embed(account.exportAccount(f.source, f.owner.id));
  account.importAccount(f.target, f.recipient.id, backup, false, { recoverHistory: false });
  const [sub] = f.own(f.target, "subscriptions");
  const payments = f.own(f.target, "payment_records");
  assert.equal(payments.length, 2);
  assert.equal(payments.find((p) => p.getString("notes") === "Unpaid and moved").getString("subscription_id"), sub.id);
  assert.deepEqual(f.bytes(f.target, "subscriptions", sub, "logo"), logo);
  assert.equal(account.importAccount(f.target, f.recipient.id, backup, false, { recoverHistory: false }).imported, 0);
});

test("an incomplete or wrongly scoped backup is rejected before changing the target", (t) => {
  const f = fixture(t);
  const exported = f.embed(exportScope(f.source, f.owner.id, "subscriptions"));
  const incomplete = structuredClone(exported); delete incomplete.backup.files[0].base64;
  assert.throws(() => importScope(f.target, f.recipient.id, "subscriptions", incomplete), /transfer_invalid_backup/);
  assert.throws(() => importScope(f.target, f.recipient.id, "calendar", exported), /transfer_invalid_backup/);
  assert.equal(f.own(f.target, "subscriptions").length, 0);
  assert.equal(f.own(f.target, "categories").length, 0);
});

test("scoped transfers preserve payment account relations when supported", (t) => {
  const f = fixture(t);
  try { f.source.findCollectionByNameOrId("payment_accounts"); } catch (_) { t.skip("This version does not have payment accounts"); return; }
  const paymentAccount = f.create(f.source, "payment_accounts", { user: f.owner.id, name: "Household account" });
  f.sub.set("payment_account", paymentAccount.id); f.source.save(f.sub);
  const exported = f.embed(exportScope(f.source, f.owner.id, "subscriptions"));
  importScope(f.target, f.recipient.id, "subscriptions", exported);
  const [sub] = f.own(f.target, "subscriptions");
  assert.equal(f.target.findRecordById("payment_accounts", sub.getString("payment_account")).getString("name"), "Household account");
});

test("multi-megabyte proof attachments survive a calendar round trip byte for byte", (t) => {
  const f = fixture(t);
  const content = Buffer.alloc(2 * 1024 * 1024, 0x61); proof.copy(content);
  f.paid.set("proof", fileFromBytes(content, "large-proof.pdf")); f.source.save(f.paid);
  importScope(f.target, f.recipient.id, "calendar", f.embed(exportScope(f.source, f.owner.id, "calendar")));
  const record = f.own(f.target, "payment_records").find((row) => row.getString("name") === "Independent");
  assert.deepEqual(f.bytes(f.target, "payment_records", record, "proof"), content);
});

test("duplicate imports preserve changes made locally after the first import", (t) => {
  const f = fixture(t);
  const exported = f.embed(exportScope(f.source, f.owner.id, "subscriptions"));
  importScope(f.target, f.recipient.id, "subscriptions", exported);
  const [sub] = f.own(f.target, "subscriptions");
  sub.set("name", "Local edited name"); sub.set("price", 125); f.target.save(sub);
  assert.equal(importScope(f.target, f.recipient.id, "subscriptions", exported).imported, 0);
  assert.equal(f.target.findRecordById("subscriptions", sub.id).getString("name"), "Local edited name");
  assert.equal(f.target.findRecordById("subscriptions", sub.id).get("price"), 125);
});

test("date-only and timestamp payments deduplicate and preserve existing payment links", (t) => {
  const f = fixture(t);
  importScope(f.target, f.recipient.id, "subscriptions", f.embed(exportScope(f.source, f.owner.id, "subscriptions")));
  const [sub] = f.own(f.target, "subscriptions");
  const existing = f.create(f.target, "payment_records", { user: f.recipient.id, subscription_id: sub.id, due_date: "2026-10-04T00:00:00Z", amount: 777, currency: sub.getString("currency"), notes: "Local record" });
  const beta = require(path.join(root, "package.json")).version.includes("-beta.");
  if (beta) {
    const row = f.create(f.source, "finance_rows", { user: f.owner.id, name: "Linked payment", kind: "expense", year: 2026 });
    f.create(f.source, "finance_entries", { user: f.owner.id, row_id: row.id, date: "2026-10-04", amount: 87, status: "planned", source_payment: f.pending.id });
  }
  account.importAccount(f.target, f.recipient.id, f.embed(account.exportAccount(f.source, f.owner.id)), false, { recoverHistory: false });
  assert.equal(f.own(f.target, "payment_records").length, 2);
  assert.equal(f.target.findRecordById("payment_records", existing.id).get("amount"), 777);
  if (beta) assert.equal(f.own(f.target, "finance_entries")[0].getString("source_payment"), existing.id);
});

test("unsupported JSON datasets are rejected rather than silently discarded", (t) => {
  const f = fixture(t);
  const backup = f.embed(account.exportAccount(f.source, f.owner.id));
  backup.data.future_records = [{ id: "aaaaaaaaaaaaaaa", name: "Unsupported data" }];
  assert.throws(() => account.importAccount(f.target, f.recipient.id, backup, false), /transfer_incompatible_backup/);
  assert.equal(f.own(f.target, "subscriptions").length, 0);
});

test("retired personal exchange settings stay compatible without replacing global integrations", (t) => {
  const f = fixture(t);
  const config = load("server-config.cjs");
  const before = config.exchange(f.target);
  const backup = f.embed(account.exportAccount(f.source, f.owner.id));
  backup.data.fixer_settings = [{ id: "aaaaaaaaaaaaaaa", provider: "fixer", base_currency: "EUR", enabled: true }];
  assert(account.importAccount(f.target, f.recipient.id, backup, false, { recoverHistory: false }).imported > 0);
  assert.deepEqual(config.exchange(f.target), before);
});

test("a later relation error rolls back the whole import and preserves existing data", (t) => {
  const f = fixture(t);
  const existing = f.create(f.target, "categories", { user: f.recipient.id, name: "Existing category" });
  const backup = f.embed(exportScope(f.source, f.owner.id, "subscriptions"));
  backup.backup.data.subscriptions.push({ ...backup.backup.data.subscriptions[0], id: "zzzzzzzzzzzzzzz", name: "Invalid later row", category: "missingcategory", logo: "" });
  assert.throws(() => importScope(f.target, f.recipient.id, "subscriptions", backup), /transfer_invalid_backup/);
  assert.equal(f.own(f.target, "subscriptions").length, 0);
  assert.equal(f.own(f.target, "categories").length, 1);
  assert.equal(f.target.findRecordById("categories", existing.id).getString("name"), "Existing category");
});

test("installment transfers include finite plans and complete source statements without loan ledger rows", (t) => {
  if (!require(path.join(root, "package.json")).version.includes("-beta.")) { t.skip("No separate debt page in stable"); return; }
  const f = fixture(t);
  const finite = f.create(f.source, "subscriptions", {
    user: f.owner.id, name: "Phone installments", price: 200, currency: f.currency.id, cycle: f.sub.getString("cycle"), frequency: 1,
    next_payment: "2026-12-04", start_date: "2026-11-04", payment_limit: 3, payments_completed: 1, auto_renew: true,
  });
  const sourceStatement = f.create(f.source, "bank_statements", {
    user: f.owner.id, bank: "enpara", file_name: "card.pdf", file_hash: "a".repeat(64), period: "2026-10", page_count: 1,
    summary: {}, unresolved: [], excluded_transactions: [], transactions: [
      { id: "laptop", date: "2026-10-05", merchant: "Laptop", amount: 1000, currency: "TRY", kind: "charge", page: 1, installment: "1/3" },
      { id: "other", date: "2026-10-06", merchant: "Other source transaction", amount: 20, currency: "TRY", kind: "charge", page: 1, installment: "" },
    ],
  });
  f.create(f.source, "finance_rows", { user: f.owner.id, name: "Personal loan", kind: "expense", year: 2026, is_loan: true });
  const exported = f.embed(exportScope(f.source, f.owner.id, "installments"));
  assert.deepEqual(exported.backup.data.subscriptions.map((row) => row.id), [finite.id]);
  assert.equal(exported.backup.data.bank_statements.length, 1);
  assert.equal(exported.backup.data.bank_statements[0].transactions.length, 2);
  assert.equal(exported.backup.data.finance_rows.length, 0);
  assert.equal(exported.backup.data.payment_records.length, 0);
  importScope(f.target, f.recipient.id, "installments", exported);
  assert.equal(f.own(f.target, "subscriptions")[0].getString("name"), "Phone installments");
  assert.equal(f.own(f.target, "bank_statements")[0].getString("file_hash"), sourceStatement.getString("file_hash"));
  const { spendingData } = load("domain/lib/pure/spending.js");
  const { loadSpendingData } = load("domain/lib/spending-data.js");
  const plans = spendingData(loadSpendingData(f.target, f.recipient.id), { trackingOnly: true }).installments;
  assert.equal(plans.length, 1);
  assert.equal(plans[0].name, "Laptop");
  assert.equal(plans[0].remaining, 2);
  assert.equal(plans[0].remaining_amount, 2000);
  assert.equal(f.own(f.target, "finance_rows").length, 0);
  assert.equal(importScope(f.target, f.recipient.id, "installments", exported).imported, 0);
});

test("HTTP export, protected attachment download and confirmed import form a complete round trip", async (t) => {
  const f = fixture(t);
  const express = require(require.resolve("express", { paths: [path.join(root, "apps/backend")] }));
  const listen = async (repository, user) => {
    const app = express(); app.use(express.json({ limit: "100mb" }));
    app.use((req, _res, next) => { req.user = req.get("x-fixture-user") === "owner" ? user : req.get("x-fixture-user") === "other" ? f.foreign : null; next(); });
    load("runtime.cjs").configure(app, repository, {});
    const routes = path.join(root, "apps/backend/src/domain/routes_scoped_transfer.js");
    delete require.cache[require.resolve(routes)]; require(routes);
    load("data-api.cjs").registerDataApi(app, repository, { isAdmin: () => false, resolve: () => null });
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
    const server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}`;
  };
  const source = await listen(f.source, f.owner), target = await listen(f.target, f.recipient);
  const auth = { "x-fixture-user": "owner" };
  assert.equal((await fetch(`${source}/api/transfer/subscriptions/export`)).status, 401);
  for (const scope of ["subscriptions", "calendar", ...(require(path.join(root, "package.json")).version.includes("-beta.") ? ["installments"] : [])]) {
    const response = await fetch(`${source}/api/transfer/${scope}/export`, { headers: auth });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const exported = await response.json();
    for (const file of exported.backup.files) {
      const collection = file.sourceCollection || file.collection, id = file.sourceRecordId || file.recordId;
      const url = `${source}/api/files/${collection}/${id}/${encodeURIComponent(file.name)}`;
      assert.equal((await fetch(url)).status, 403);
      assert.equal((await fetch(url, { headers: { "x-fixture-user": "other" } })).status, 404);
      const download = await fetch(url, { headers: auth });
      assert.equal(download.status, 200);
      file.base64 = Buffer.from(await download.arrayBuffer()).toString("base64");
    }
    const send = (body, headers = auth) => fetch(`${target}/api/transfer/${scope}/import`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    assert.equal((await send(exported, {})).status, 401);
    const imported = await send(exported);
    assert.equal(imported.status, 200, JSON.stringify(await imported.clone().json()));
    const repeated = await send(exported);
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).imported, 0);
    assert.equal((await send({ ...exported, scope: "wrong" })).status, 400);
  }
  assert.equal(f.own(f.target, "subscriptions").length, 1);
  assert.equal(f.own(f.target, "payment_records").length, 2);
});
