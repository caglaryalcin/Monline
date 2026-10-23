const { mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const {
  advanceSubscription,
  advanceDueSubscriptions,
} = require("../../src/domain/lib/subscription-schedule.js");
const {
  prepareBackfill,
  saveBackfill,
} = require("../../src/domain/lib/subscription-backfill.js");

let app, directory, user, cycle, sub;
function create(collection, values) {
  const record = new DataRecord(app.findCollectionByNameOrId(collection));
  for (const [key, value] of Object.entries(values)) record.set(key, value);
  app.save(record);
  return record;
}
function payments() {
  return app.findRecordsByFilter(
    "payment_records",
    "subscription_id = {:sub}",
    "due_date",
    0,
    0,
    { sub: sub.id },
  );
}
beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), "monline-schedule-"));
  app = new Repository(directory);
  user = create("users", {
    email: "schedule@example.test",
    password: "test-hash",
    tokenKey: "test-key",
    payment_tracking: true,
  });
  cycle = create("cycles", { name: "Monthly" });
  const currency = create("currencies", {
    user: user.id,
    name: "Turkish Lira",
    code: "TRY",
    symbol: "₺",
    rate: 1,
  });
  sub = create("subscriptions", {
    currency: currency.id,
    user: user.id,
    name: "Amazon Prime",
    price: 69.9,
    frequency: 1,
    cycle: cycle.id,
    start_date: "2026-01-23",
    next_payment: "2026-10-23",
    auto_renew: true,
    auto_mark_paid: false,
  });
});
afterEach(() => {
  app.connection.close();
  rmSync(directory, { recursive: true, force: true });
});

it("retains an unconfirmed due date before advancing, independently of payment tracking", () => {
  user.set("payment_tracking", false);
  app.save(user);
  advanceDueSubscriptions(app, "2026-10-23");
  expect(payments()).toHaveLength(1);
  expect(payments()[0].publicExport()).toMatchObject({
    due_date: "2026-10-23",
    amount: 69.9,
    paid_at: "",
    auto_paid: false,
  });
  expect(app.findRecordById("subscriptions", sub.id).get("next_payment")).toBe(
    "2026-11-23",
  );
  // Neither retrying nor a later price change can replace the saved amount.
  sub = app.findRecordById("subscriptions", sub.id);
  sub.set("price", 99.9);
  app.save(sub);
  advanceDueSubscriptions(app, "2026-10-23");
  expect(payments()).toHaveLength(1);
  expect(payments()[0].get("amount")).toBe(69.9);
  app.delete(payments()[0]);
  advanceDueSubscriptions(app, "2026-10-24");
  expect(payments()).toEqual([]);
});

it.each([true, false])(
  "only marks opted-in payments paid when tracking is enabled (%s)",
  (tracking) => {
    user.set("payment_tracking", tracking);
    app.save(user);
    sub.set("auto_mark_paid", true);
    app.save(sub);
    advanceDueSubscriptions(app, "2026-10-23");
    expect(!!payments()[0].get("paid_at")).toBe(tracking);
    expect(payments()[0].get("auto_paid")).toBe(tracking);
  },
);

it("catches up each missed month, preserves month ends, and stops at the final finite payment", () => {
  sub.set("next_payment", "2026-01-31");
  sub.set("billing_anchor_day", 31);
  sub.set("payment_limit", 3);
  app.save(sub);
  advanceDueSubscriptions(app, "2026-05-01");
  expect(payments().map((record) => record.get("due_date"))).toEqual([
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
  ]);
  expect(
    app.findRecordById("subscriptions", sub.id).publicExport(),
  ).toMatchObject({
    next_payment: "2026-03-31",
    payments_completed: 3,
    inactive: true,
  });
  advanceDueSubscriptions(app, "2026-05-02");
  expect(payments()).toHaveLength(3);
});

it("rolls back every catch-up record and the schedule when any payment cannot be saved", () => {
  app.connection.exec(
    "CREATE TRIGGER fail_payment BEFORE INSERT ON payment_records WHEN NEW.due_date = '2026-11-23' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  );
  expect(() => advanceSubscription(app, sub.id, "2026-12-23")).toThrow();
  expect(payments()).toEqual([]);
  expect(app.findRecordById("subscriptions", sub.id).get("next_payment")).toBe(
    "2026-10-23",
  );
  app.connection.exec("DROP TRIGGER fail_payment");
  advanceSubscription(app, sub.id, "2026-12-23");
  expect(payments()).toHaveLength(3);
});

it("preserves an existing paid timestamp and zero amount without duplicates", () => {
  create("payment_records", {
    subscription_id: sub.id,
    user: user.id,
    due_date: "2026-10-23T00:00:00.000Z",
    paid_at: "2026-10-23T08:00:00Z",
    amount: 0,
  });
  advanceDueSubscriptions(app, "2026-10-23");
  expect(payments()).toHaveLength(1);
  expect(payments()[0].get("amount")).toBe(0);
  expect(payments()[0].get("paid_at")).toBe("2026-10-23T08:00:00Z");
});

it("saves a non-renewing due date without advancing and does not recreate cleared history later", () => {
  sub.set("auto_renew", false);
  app.save(sub);
  advanceDueSubscriptions(app, "2026-10-23");
  expect(payments()).toHaveLength(1);
  expect(app.findRecordById("subscriptions", sub.id).get("next_payment")).toBe(
    "2026-10-23",
  );
  app.delete(payments()[0]);
  advanceDueSubscriptions(app, "2026-10-24");
  expect(payments()).toEqual([]);
});

it("recovers reviewed history as pending, keeps existing records, and lets paid backfill confirm it later", () => {
  const input = {
    confirmed: true,
    mark_as_paid: false,
    utc_offset_minutes: 0,
    payments: [
      { due_date: "2026-09-23", amount: 49.9, paid_utc_offset_minutes: 0 },
    ],
  };
  const now = new Date("2026-10-24T12:00:00Z");
  app.runInTransaction((tx) =>
    saveBackfill(tx, sub, prepareBackfill(tx, sub, input, now)),
  );
  expect(payments()[0].get("paid_at")).toBe("");
  input.payments[0].amount = 99.9;
  app.runInTransaction((tx) =>
    saveBackfill(tx, sub, prepareBackfill(tx, sub, input, now)),
  );
  expect(payments()[0].get("amount")).toBe(49.9);
  input.mark_as_paid = true;
  app.runInTransaction((tx) =>
    saveBackfill(tx, sub, prepareBackfill(tx, sub, input, now)),
  );
  expect(payments()).toHaveLength(1);
  expect(payments()[0].get("paid_at")).toBeTruthy();
});
