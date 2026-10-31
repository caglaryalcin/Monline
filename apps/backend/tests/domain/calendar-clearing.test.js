const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const { projectedOccurrence, calendarNextPayment, moveCalendarPayment } = require("../../src/domain/lib/calendar-move.js");
const { recoverCalendarHistory } = require("../../src/domain/lib/calendar-history-recovery.js");
const { exportAccount, importAccount } = require("../../src/domain/lib/account-backup.js");

let app, directory, owner, currency, cycle;
function create(name, values) {
  const record = new DataRecord(app.findCollectionByNameOrId(name));
  for (const [key, value] of Object.entries(values)) record.set(key, value);
  return app.save(record);
}
function subscription(values = {}) {
  return create("subscriptions", {
    user: owner.id, name: "Service", price: 20, currency: currency.id,
    cycle: cycle.id, frequency: 1, start_date: "2026-01-06",
    next_payment: "2026-11-06", auto_renew: true, inactive: false, ...values,
  });
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-calendar-clear-"));
  app = new Repository(directory);
  owner = create("users", { email: "owner@example.test", password: "fixture-hash" });
  currency = create("currencies", { user: owner.id, name: "Dollar", code: "USD", symbol: "$", rate: 1 });
  cycle = create("cycles", { name: "Monthly" });
});
afterEach(() => {
  app.connection.close();
  vi.useRealTimers();
  const target = path.resolve(directory);
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("monline-calendar-clear-"))
    throw Error("Unexpected fixture directory");
  fs.rmSync(target, { recursive: true, force: true });
});

it("migrates permanent hiding once without recreating deleted payment history", () => {
  const sub = subscription();
  app.connection.prepare("UPDATE subscriptions SET calendar_projection_hidden=1, calendar_history_recovery_passes=0 WHERE id=?").run(sub.id);
  app.connection.close();
  app = new Repository(directory);
  const migrated = app.findRecordById("subscriptions", sub.id);
  expect(migrated.getBool("calendar_projection_hidden")).toBe(false);
  expect(migrated.getString("calendar_projection_from")).toBe("2026-11-01");
  expect(migrated.getFloat("calendar_history_recovery_passes")).toBe(2);
  expect(projectedOccurrence(app, migrated, "2026-11-06")).toBe(true);
  expect(recoverCalendarHistory(app, "2026-11-20").created).toBe(0);
  expect(app.countRecords("payment_records")).toBe(0);
  app.connection.close();
  vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  app = new Repository(directory);
  expect(app.findRecordById("subscriptions", sub.id).getString("calendar_projection_from")).toBe("2026-11-01");
});

it("skips erased dates while keeping the next iCalendar occurrence and later renewals", () => {
  const sub = subscription({ next_payment: "2026-10-06", calendar_projection_from: "2026-11-01" });
  expect(projectedOccurrence(app, sub, "2026-10-06")).toBe(false);
  expect(projectedOccurrence(app, sub, "2026-11-06")).toBe(true);
  expect(projectedOccurrence(app, sub, "2026-12-06")).toBe(true);
  expect(calendarNextPayment(app, sub)).toBe("2026-11-06");
  expect(app.findRecordById("subscriptions", sub.id).getString("next_payment")).toBe("2026-10-06");
  expect(app.countRecords("payment_records")).toBe(0);
});

it("keeps month-end anchors when the next visible date follows the history boundary", () => {
  const sub = subscription({ next_payment: "2026-10-31", billing_anchor_day: 31, calendar_projection_from: "2026-11-01" });
  expect(calendarNextPayment(app, sub)).toBe("2026-11-30");
  expect(projectedOccurrence(app, sub, "2026-12-31")).toBe(true);
});

it("allows moving a future payment after clearing without moving erased history", () => {
  const sub = subscription({ calendar_projection_from: "2026-11-01" });
  expect(() => moveCalendarPayment(app, owner.id, {
    subscription_id: sub.id, from_date: "2026-10-06", to_date: "2026-11-08",
  })).toThrow();
  moveCalendarPayment(app, owner.id, {
    subscription_id: sub.id, from_date: "2026-11-06", to_date: "2026-11-08",
  });
  expect(calendarNextPayment(app, sub)).toBe("2026-11-08");
  expect(app.countRecords("payment_records")).toBe(1);
});

it("never recovers history before a stored cutoff even if the pass counter is missing", () => {
  const sub = subscription({ next_payment: "2026-11-06", calendar_projection_from: "2026-11-01" });
  recoverCalendarHistory(app, "2026-11-20");
  expect(app.findRecordsByFilter("payment_records", "subscription_id = {:id}", "due_date", 0, 0, { id: sub.id })
    .map(record => record.getString("due_date").slice(0, 10))).toEqual(["2026-11-06"]);
});

it("preserves the clearing cutoff in account backup round trips", () => {
  subscription({ calendar_projection_from: "2026-11-01", calendar_history_recovery_passes: 2 });
  const backup = exportAccount(app, owner.id);
  expect(backup.data.subscriptions[0].calendar_projection_from).toBe("2026-11-01");
  const other = create("users", { email: "other@example.test", password: "fixture-hash" });
  importAccount(app, other.id, backup, false);
  const restored = app.findRecordsByFilter("subscriptions", "user = {:id}", "", 1, 0, { id: other.id })[0];
  expect(restored.getString("calendar_projection_from")).toBe("2026-11-01");
  expect(projectedOccurrence(app, restored, "2026-11-06")).toBe(true);
  expect(app.countRecords("payment_records")).toBe(0);
});

it("normalizes legacy account backups without recreating their cleared history", () => {
  subscription();
  const backup = exportAccount(app, owner.id);
  backup.data.subscriptions[0].calendar_projection_hidden = true;
  backup.data.subscriptions[0].calendar_history_recovery_passes = 0;
  delete backup.data.subscriptions[0].calendar_projection_from;
  const other = create("users", { email: "legacy@example.test", password: "fixture-hash" });
  importAccount(app, other.id, backup, false);
  const restored = app.findRecordsByFilter("subscriptions", "user = {:id}", "", 1, 0, { id: other.id })[0];
  expect(restored.getBool("calendar_projection_hidden")).toBe(false);
  expect(restored.getString("calendar_projection_from")).toBe("2026-11-01");
  expect(app.countRecords("payment_records")).toBe(0);
});
