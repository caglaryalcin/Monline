const express = require("express");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const runtime = require("../../src/runtime.cjs");
let directory, repository, server, owner, sub, currency, statement, original;
const statementHash = "a".repeat(64);
const today = new Date("2026-11-28T12:00:00Z");
const day = (offset) =>
  new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);
function create(name, values) {
  const record = new DataRecord(repository.findCollectionByNameOrId(name));
  for (const [key, value] of Object.entries(values)) record.set(key, value);
  return repository.save(record);
}
const records = (name) =>
  repository.findRecordsByFilter(name).map((record) => record.publicExport());
const snapshot = () =>
  Object.fromEntries(
    [
      "subscriptions",
      "payment_records",
      "bank_statements",
      "subscription_history",
    ].map((name) => [name, records(name)]),
  );
function charge(id = "charge1", date = day(-5), amount = 100) {
  return {
    id,
    date,
    amount,
    currency: "TRY",
    merchant: "NETFLIX",
    subscription_service: "Netflix",
    category: "digital",
    kind: "charge",
  };
}
function setCharges(rows) {
  statement = repository.findRecordById("bank_statements", statement.id);
  statement.set("transactions", rows);
  repository.save(statement);
}
async function request(route, body, auth = true) {
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}${route}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth": auth ? "yes" : "no",
      },
      body: JSON.stringify(body),
    },
  );
  return { status: response.status, body: await response.json() };
}
function importBody(choices = [], ids = ["charge1"], combine = []) {
  return {
    utc_offset_minutes: 0,
    paid_offsets: Object.fromEntries(ids.map((id) => [id, 0])),
    payment_matches: choices,
    groups: [
      { subscription_id: sub.id, transaction_ids: ids, combine_dates: combine },
    ],
  };
}
function transfer(body = importBody(), auth = true) {
  return request(`/api/statements/${statement.id}/import`, body, auth);
}
async function reviews(body = importBody()) {
  const response = await transfer(body);
  expect(response.status, JSON.stringify(response.body)).toBe(400);
  expect(response.body.error).toBe("statement_import_payment_review");
  return response.body.payment_reviews;
}
const choice = (review, id = original.id) => ({
  transaction_ids: review.transaction_ids,
  review_token: review.review_token,
  payment_id: id,
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(today);
  directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "monline-statement-review-"),
  );
  repository = new Repository(directory);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = req.get("x-auth") === "no" ? null : owner;
    next();
  });
  runtime.configure(app, repository, {});
  for (const name of [
    "routes_reactivation.js",
    "subscription_reactivation.js",
    "subscription_history.js",
    "subscription_category.js",
    "subscription_start.js",
    "statement_schedule.js",
    "routes_statements.js",
  ]) {
    delete require.cache[require.resolve("../../src/domain/" + name)];
    require("../../src/domain/" + name);
  }
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ error: error.message }),
  );
  owner = create("users", {
    email: "review@example.test",
    password: "fixture",
  });
  currency = create("currencies", {
    user: owner.id,
    name: "Turkish Lira",
    code: "TRY",
    symbol: "₺",
    rate: 1,
    is_main: true,
  });
  const category = create("categories", { user: owner.id, name: "Streaming" });
  const cycle = create("cycles", { name: "Monthly" });
  sub = create("subscriptions", {
    user: owner.id,
    name: "Netflix",
    record_type: "expense",
    price: 100,
    currency: currency.id,
    category: category.id,
    cycle: cycle.id,
    frequency: 1,
    inactive: true,
    auto_renew: true,
    start_date: day(-60),
    next_payment: day(-20),
  });
  statement = create("bank_statements", {
    user: owner.id,
    bank: "enpara",
    period: day(0).slice(0, 7),
    file_hash: statementHash,
    file_name: "fixture.pdf",
    page_count: 1,
    transactions: [charge()],
  });
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const reactivated = await request(`/api/subscriptions/${sub.id}/reactivate`, {
    paid_date: day(-6),
    next_payment: day(20),
    price: 100,
    utc_offset_minutes: 0,
    paid_utc_offset_minutes: 0,
    expected_currency: currency.id,
    expected_next_payment: sub.getString("next_payment"),
  });
  expect(reactivated.status, JSON.stringify(reactivated.body)).toBe(200);
  original = repository.findRecordsByFilter("payment_records")[0];
});
afterEach(async () => {
  vi.useRealTimers();
  if (server) await new Promise((resolve) => server.close(resolve));
  repository.connection.close();
  const target = path.resolve(directory);
  if (
    path.dirname(target) !== path.resolve(os.tmpdir()) ||
    !path.basename(target).startsWith("monline-statement-review-")
  )
    throw Error("Unexpected fixture path");
  fs.rmSync(target, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
});
it("returns a review without committing any import writes", async () => {
  const before = snapshot(),
    [review] = await reviews();
  expect(review).toMatchObject({
    date: day(-5),
    amount: 100,
    currency: "TRY",
    subscription_name: "Netflix",
    candidates: [
      { payment_id: original.id, date: day(-6), amount: 100, currency: "TRY" },
    ],
  });
  expect(snapshot()).toEqual(before);
});
it("links once using the statement dates and next billing day, preserves the amount and notes, and remains idempotent", async () => {
  const [review] = await reviews(),
    before = original.publicExport();
  const result = await transfer(importBody([choice(review)]));
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  expect(result.body).toMatchObject({
    payments_imported: 0,
    payments_skipped: 1,
  });
  expect(records("payment_records")).toHaveLength(1);
  expect(records("payment_records")[0]).toMatchObject({
    id: original.id,
    amount: before.amount,
    due_date: day(-5),
    paid_at: day(-5) + "T00:00:00.000Z",
    scheduled_date: before.due_date.slice(0, 10),
    notes: before.notes,
  });
  expect(records("payment_records")[0].statement_sources).toContain(
    `[monline-statement:${statementHash}:charge1]`,
  );
  expect(
    repository
      .findRecordById("subscriptions", sub.id)
      .getString("next_payment")
      .slice(0, 10),
  ).toBe("2026-12-23");
  expect((await transfer()).status).toBe(200);
  expect(records("payment_records")).toHaveLength(1);
});
it("imports a separate payment only after an explicit separate choice", async () => {
  const [review] = await reviews();
  expect((await transfer(importBody([choice(review, null)]))).status).toBe(200);
  expect(records("payment_records")).toHaveLength(2);
  expect(
    records("payment_records").find((record) => record.id === original.id)
      .paid_at,
  ).toBe(original.getString("paid_at"));
});
it("asks again when the existing payment changes while the review is open", async () => {
  const [review] = await reviews();
  const edited = repository.findRecordById("payment_records", original.id);
  edited.set("amount", 120);
  repository.save(edited);
  const before = snapshot(),
    [updated] = await reviews(importBody([choice(review)]));
  expect(updated.review_token).not.toBe(review.review_token);
  expect(updated.candidates[0].amount).toBe(120);
  expect(snapshot()).toEqual(before);
});
it("rejects a forged payment target and rolls everything back", async () => {
  const [review] = await reviews(),
    before = snapshot();
  const result = await transfer(
    importBody([choice(review, "xxxxxxxxxxxxxxx")]),
  );
  expect(result.body.error).toBe("statement_import_payment_changed");
  expect(snapshot()).toEqual(before);
});
it("cannot link a different account's payment", async () => {
  const other = create("users", {
    email: "other-review@example.test",
    password: "fixture",
  });
  const otherCurrency = create("currencies", {
    user: other.id,
    name: "Turkish Lira",
    code: "TRY",
    symbol: "₺",
    rate: 1,
    is_main: true,
  });
  const foreign = create("payment_records", {
    user: other.id,
    subscription_id: "",
    name: "Netflix",
    amount: 100,
    currency: otherCurrency.id,
    due_date: day(-6),
    paid_at: day(-6) + "T12:00:00Z",
  });
  const [review] = await reviews(),
    before = snapshot();
  expect(
    review.candidates.some((candidate) => candidate.payment_id === foreign.id),
  ).toBe(false);
  expect(
    (await transfer(importBody([choice(review, foreign.id)]))).status,
  ).toBe(400);
  expect(snapshot()).toEqual(before);
});
it("rejects using one calendar payment for two different statement charges atomically", async () => {
  setCharges([charge("charge1", day(-5)), charge("charge2", day(-4))]);
  const ids = ["charge1", "charge2"],
    before = snapshot(),
    review = await reviews(importBody([], ids));
  expect(review).toHaveLength(2);
  const result = await transfer(
    importBody(
      review.map((item) => choice(item)),
      ids,
    ),
  );
  expect(result.body.error).toBe("statement_import_payment_reused");
  expect(snapshot()).toEqual(before);
});
it("links an explicitly combined day's charges to one existing total", async () => {
  setCharges([charge("charge1", day(-5), 40), charge("charge2", day(-5), 60)]);
  const ids = ["charge1", "charge2"],
    [review] = await reviews(importBody([], ids, [day(-5)]));
  expect(review.amount).toBe(100);
  expect(review.transaction_ids).toHaveLength(2);
  const result = await transfer(importBody([choice(review)], ids, [day(-5)]));
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  expect(records("payment_records")).toHaveLength(1);
  expect(records("payment_records")[0].statement_sources).toContain(
    `[monline-statement:${statementHash}:charge2]`,
  );
});
it("warns about exact-day payments too and links only after a choice", async () => {
  setCharges([charge("charge1", day(-6))]);
  const [review] = await reviews();
  const result = await transfer(importBody([choice(review)]));
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  expect(records("payment_records")).toHaveLength(1);
});
it("warns across the entire month even when dates are more than seven days apart", async () => {
  setCharges([charge("charge1", "2026-11-01")]);
  const before = snapshot(),
    [review] = await reviews();
  expect(review.candidates[0].payment_id).toBe(original.id);
  expect(snapshot()).toEqual(before);
  expect((await transfer(importBody([choice(review)]))).status).toBe(200);
  expect(records("payment_records")[0]).toMatchObject({
    due_date: "2026-11-01",
    paid_at: "2026-11-01T00:00:00.000Z",
  });
  expect(
    repository
      .findRecordById("subscriptions", sub.id)
      .getString("next_payment")
      .slice(0, 10),
  ).toBe("2026-12-01");
});
it("does not confuse nearby payments from different calendar months", async () => {
  original.set("due_date", "2026-10-31");
  original.set("paid_at", "2026-10-31T00:00:00Z");
  repository.save(original);
  setCharges([charge("charge1", "2026-11-01")]);
  expect((await transfer()).status).toBe(200);
  expect(records("payment_records")).toHaveLength(2);
});
it("does not match the same month number in a different year", async () => {
  setCharges([charge("charge1", "2025-11-22")]);
  expect((await transfer()).status).toBe(200);
  expect(records("payment_records")).toHaveLength(2);
});
it("preserves the existing amount when a different statement amount is explicitly linked", async () => {
  setCharges([charge("charge1", day(-5), 105)]);
  const [review] = await reviews();
  expect(review.amount).toBe(105);
  expect(review.candidates[0].amount).toBe(100);
  expect((await transfer(importBody([choice(review)]))).status).toBe(200);
  expect(records("payment_records")[0].amount).toBe(100);
});
it("requires authentication", async () => {
  expect((await transfer(importBody(), false)).status).toBe(401);
});

it("reviews a same-month payment previously linked to a different statement", async () => {
  original.set("statement_sources", [
    "[monline-statement:older-document:older-row]",
  ]);
  repository.save(original);
  const [review] = await reviews();
  expect((await transfer(importBody([choice(review)]))).status).toBe(200);
  const [payment] = records("payment_records");
  expect(payment).toMatchObject({
    id: original.id,
    due_date: day(-5),
    paid_at: day(-5) + "T00:00:00.000Z",
  });
  expect(payment.statement_sources).toContain(
    "[monline-statement:older-document:older-row]",
  );
  expect((await transfer()).status).toBe(200);
  expect(records("payment_records")).toHaveLength(1);
});
it("uses the subscription currency for older payments with no currency snapshot", async () => {
  original.set("currency", "");
  repository.save(original);
  const [review] = await reviews();
  expect(review.candidates[0].payment_id).toBe(original.id);
});
it("preserves an earlier scheduled origin when a moved payment is linked", async () => {
  original.set("scheduled_date", "2026-11-02");
  repository.save(original);
  const [review] = await reviews();
  expect((await transfer(importBody([choice(review)]))).status).toBe(200);
  expect(records("payment_records")[0]).toMatchObject({
    scheduled_date: "2026-11-02",
    due_date: day(-5),
  });
});
it("uses the statement day's UTC offset when correcting the paid timestamp", async () => {
  const [review] = await reviews();
  const body = importBody([choice(review)]);
  body.utc_offset_minutes = -180;
  body.paid_offsets.charge1 = -180;
  expect((await transfer(body)).status).toBe(200);
  expect(records("payment_records")[0]).toMatchObject({
    due_date: day(-5),
    paid_at: "2026-11-22T21:00:00.000Z",
  });
});
it("does not regenerate the original scheduled payment after correcting its date", async () => {
  const [review] = await reviews();
  expect((await transfer(importBody([choice(review)]))).status).toBe(200);
  const current = repository.findRecordById("subscriptions", sub.id);
  const {
    saveScheduledPayment,
  } = require("../../src/domain/lib/scheduled-payments.js");
  expect(saveScheduledPayment(repository, current, day(-6), true)).toBe(false);
  expect(records("payment_records")).toHaveLength(1);
});
it("does not silently deduplicate an exact-day charge explicitly marked separate", async () => {
  setCharges([charge("charge1", day(-6))]);
  const before = snapshot(),
    [review] = await reviews();
  const result = await transfer(importBody([choice(review, null)]));
  expect(result.body.error).toBe("statement_import_conflict");
  expect(snapshot()).toEqual(before);
});
