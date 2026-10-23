const { mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const {
  recoverCalendarHistory,
} = require("../../src/domain/lib/calendar-history-recovery.js");
const {
  exportAccount,
  importAccount,
} = require("../../src/domain/lib/account-backup.js");

let app, directory, user, currency, cycle, sub;
function create(collection, fields) {
  const record = new DataRecord(app.findCollectionByNameOrId(collection));
  for (const [key, value] of Object.entries(fields)) record.set(key, value);
  app.save(record);
  return record;
}
function records(id = sub.id) {
  return app.findRecordsByFilter(
    "payment_records",
    "subscription_id = {:id}",
    "due_date",
    0,
    0,
    { id },
  );
}
beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), "monline-history-upgrade-"));
  app = new Repository(directory);
  user = create("users", {
    email: "upgrade@example.test",
    password: "test-hash",
    tokenKey: "test-key",
    language: "tr",
  });
  currency = create("currencies", {
    user: user.id,
    code: "TRY",
    name: "Turkish Lira",
    symbol: "₺",
    rate: 1,
  });
  cycle = create("cycles", { name: "Monthly" });
  // No current-version creation hooks: this fixture represents a legacy row.
  sub = create("subscriptions", {
    user: user.id,
    currency: currency.id,
    cycle: cycle.id,
    name: "Amazon Prime",
    price: 69.9,
    frequency: 1,
    start_date: "2026-08-23",
    next_payment: "2026-11-23",
    auto_renew: true,
    auto_mark_paid: true,
  });
});
afterEach(() => {
  app.connection.close();
  rmSync(directory, { recursive: true, force: true });
});

it("runs two upgrade passes, keeps existing paid and pending records unchanged, and never recreates later deletions", () => {
  const paid = create("payment_records", {
    user: user.id,
    subscription_id: sub.id,
    due_date: "2026-08-23",
    paid_at: "2026-08-23T12:00:00Z",
    amount: 49.9,
    notes: "original",
  });
  const pending = create("payment_records", {
    user: user.id,
    subscription_id: sub.id,
    due_date: "2026-09-23T00:00:00Z",
    amount: 0,
    notes: "keep pending",
  });
  const result = recoverCalendarHistory(app, "2026-10-23");
  expect(result).toEqual({ created: 1, processed: 2, failures: 0 });
  expect(records()).toHaveLength(3);
  expect(
    app.findRecordById("payment_records", paid.id).publicExport(),
  ).toMatchObject({
    amount: 49.9,
    paid_at: "2026-08-23T12:00:00Z",
    notes: "original",
  });
  expect(
    app.findRecordById("payment_records", pending.id).publicExport(),
  ).toMatchObject({ amount: 0, paid_at: "", notes: "keep pending" });
  const recovered = records().find(
    (record) => record.getString("due_date") === "2026-10-23",
  );
  expect(recovered.publicExport()).toMatchObject({
    amount: 69.9,
    paid_at: "",
    auto_paid: false,
  });
  expect(recovered.getString("notes")).toContain("Tutar tahminidir");
  expect(
    app
      .findRecordById("subscriptions", sub.id)
      .getFloat("calendar_history_recovery_passes"),
  ).toBe(2);
  app.delete(recovered);
  expect(recoverCalendarHistory(app, "2026-10-24")).toEqual({
    created: 0,
    processed: 0,
    failures: 0,
  });
  expect(records()).toHaveLength(2);
});

it("rolls back both records and the pass marker on failure and retries safely", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    app.connection.exec(
      "CREATE TRIGGER fail_history BEFORE INSERT ON payment_records WHEN NEW.due_date = '2026-09-23' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );
    expect(recoverCalendarHistory(app, "2026-10-23")).toMatchObject({
      created: 0,
      processed: 0,
      failures: 2,
    });
    expect(records()).toEqual([]);
    expect(
      app
        .findRecordById("subscriptions", sub.id)
        .getFloat("calendar_history_recovery_passes"),
    ).toBe(0);
    app.connection.exec("DROP TRIGGER fail_history");
    expect(recoverCalendarHistory(app, "2026-10-23")).toEqual({
      created: 3,
      processed: 2,
      failures: 0,
    });
  } finally {
    errors.mockRestore();
  }
});

it("honors month-end anchors, cancellation and paused intervals before the finite payment limit", () => {
  sub.set("start_date", "2026-01-31");
  sub.set("next_payment", "2026-06-30");
  sub.set("billing_anchor_day", 31);
  sub.set("payment_limit", 3);
  sub.set("cancellation_date", "2026-04-30");
  app.save(sub);
  create("subscription_history", {
    user: user.id,
    subscription_id: sub.id,
    event_type: "paused",
    effective_date: "2026-02-01",
  });
  create("subscription_history", {
    user: user.id,
    subscription_id: sub.id,
    event_type: "resumed",
    effective_date: "2026-03-01",
  });
  recoverCalendarHistory(app, "2026-10-23");
  expect(records().map((record) => record.getString("due_date"))).toEqual([
    "2026-01-31",
    "2026-03-31",
    "2026-04-30",
  ]);
});

it("does not recover new subscriptions or credits, and caps non-renewing schedules at their anchor", () => {
  sub.set("calendar_history_recovery_passes", 2);
  app.save(sub);
  const once = create("cycles", { name: "One-Time" });
  const credit = create("subscriptions", {
    user: user.id,
    currency: currency.id,
    cycle: once.id,
    name: "Credit",
    price: 100,
    frequency: 1,
    record_type: "credit",
    next_payment: "2026-09-01",
  });
  const stopped = create("subscriptions", {
    user: user.id,
    currency: currency.id,
    cycle: cycle.id,
    name: "Stopped",
    price: 10,
    frequency: 1,
    auto_renew: false,
    start_date: "2026-08-23",
    next_payment: "2026-09-23",
  });
  recoverCalendarHistory(app, "2026-10-23");
  expect(records()).toEqual([]);
  expect(records(credit.id)).toEqual([]);
  expect(
    records(stopped.id).map((record) => record.getString("due_date")),
  ).toEqual(["2026-08-23", "2026-09-23"]);
});

it("skips inactive subscriptions, preserves their existing history, and completes their upgrade passes", () => {
  sub.set("inactive", true);
  app.save(sub);
  const paid = create("payment_records", {
    user: user.id,
    subscription_id: sub.id,
    due_date: "2026-08-23",
    paid_at: "2026-08-23T12:00:00Z",
    amount: 49.9,
  });
  const pending = create("payment_records", {
    user: user.id,
    subscription_id: sub.id,
    due_date: "2026-09-23",
    amount: 59.9,
    notes: "Original pending payment",
  });
  const original = records().map((record) => record.publicExport());
  expect(recoverCalendarHistory(app, "2026-10-23")).toEqual({
    created: 0,
    processed: 2,
    failures: 0,
  });
  expect(records().map((record) => record.publicExport())).toEqual(original);
  expect(records().map((record) => record.id)).toEqual([paid.id, pending.id]);
  const updated = app.findRecordById("subscriptions", sub.id);
  expect(updated.getFloat("calendar_history_recovery_passes")).toBe(2);
  updated.set("inactive", false);
  app.save(updated);
  expect(recoverCalendarHistory(app, "2026-10-24").created).toBe(0);
  expect(records()).toHaveLength(2);
});

it("recovers daily histories longer than the manual editor's 1,000-record limit", () => {
  const daily = create("cycles", { name: "Daily" });
  sub.set("cycle", daily.id);
  sub.set("start_date", "2023-01-01");
  sub.set("next_payment", "2026-10-24");
  app.save(sub);
  const result = recoverCalendarHistory(app, "2026-10-23");
  expect(result.failures).toBe(0);
  expect(result.created).toBeGreaterThan(1000);
  expect(records()).toHaveLength(result.created);
});

it("recovers a legacy account import and carries completion state through modern backups", () => {
  const backup = exportAccount(app, user.id);
  delete backup.data.subscriptions[0].calendar_history_recovery_passes;
  const target = create("users", {
    email: "import@example.test",
    password: "test-hash",
    tokenKey: "test-key",
  });
  importAccount(app, target.id, backup, false);
  const [restored] = app.findRecordsByFilter(
    "subscriptions",
    "user = {:owner}",
    "",
    0,
    0,
    { owner: target.id },
  );
  expect(records(restored.id)).toHaveLength(3);
  expect(restored.getFloat("calendar_history_recovery_passes")).toBe(2);
  app.delete(records(restored.id)[0]);
  const modern = exportAccount(app, target.id);
  expect(modern.data.subscriptions[0].calendar_history_recovery_passes).toBe(2);
  const third = create("users", {
    email: "modern@example.test",
    password: "test-hash",
    tokenKey: "test-key",
  });
  importAccount(app, third.id, modern, false);
  const [again] = app.findRecordsByFilter(
    "subscriptions",
    "user = {:owner}",
    "",
    0,
    0,
    { owner: third.id },
  );
  expect(records(again.id)).toHaveLength(2);
});
