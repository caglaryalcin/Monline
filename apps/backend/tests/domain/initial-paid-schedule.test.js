const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const {
  prepareInitialPayment,
  saveBackfill,
} = require("../../src/domain/lib/subscription-backfill.js");
const {
  exportAccount,
  importAccount,
} = require("../../src/domain/lib/account-backup.js");

let app, directory, user, currency, cycle;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-paid-schedule-"));
  app = new Repository(directory);
  user = create("users", {
    email: "schedule@example.test",
    password: "test-hash",
  });
  currency = create("currencies", {
    user: user.id,
    code: "EUR",
    name: "Euro",
    symbol: "€",
    rate: 1,
  });
  cycle = create("cycles", { name: "Monthly" });
});
afterEach(() => {
  app.connection.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
function create(name, data) {
  const record = new DataRecord(app.findCollectionByNameOrId(name));
  for (const [k, v] of Object.entries(data)) record.set(k, v);
  return app.save(record);
}
function prepare(
  values = {},
  date = "2026-05-01",
  now = "2026-11-02T12:00:00Z",
) {
  const sub = new DataRecord(app.findCollectionByNameOrId("subscriptions"));
  for (const [k, v] of Object.entries({
    user: user.id,
    name: "Phone",
    price: 30,
    currency: currency.id,
    cycle: cycle.id,
    frequency: 1,
    next_payment: date,
    auto_renew: true,
    auto_mark_paid: true,
    ...values,
  }))
    sub.set(k, v);
  const payments = prepareInitialPayment(
    app,
    sub,
    { date, utc_offset_minutes: 0, paid_utc_offset_minutes: 0 },
    new Date(now),
  );
  return { sub, payments };
}
it("fills May through November as seven paid charges, advancing to December", () => {
  const { sub, payments } = prepare();
  expect(payments.map((p) => p.due_date)).toEqual([
    "2026-05-01",
    "2026-06-01",
    "2026-07-01",
    "2026-08-01",
    "2026-09-01",
    "2026-10-01",
    "2026-11-01",
  ]);
  expect(
    payments.every((p) => p.amount === 30 && p.paid_at.startsWith(p.due_date)),
  ).toBe(true);
  expect(sub.getString("next_payment")).toBe("2026-12-01");
  app.save(sub);
  expect(saveBackfill(app, sub, payments)).toBe(7);
  expect(saveBackfill(app, sub, payments)).toBe(0);
});
it.each([{ auto_mark_paid: false }, { auto_renew: false }, { inactive: true }])(
  "preserves single-charge behavior when automatic catch-up is disabled: %s",
  (flags) => {
    const { sub, payments } = prepare(flags);
    expect(payments).toHaveLength(1);
    expect(sub.getString("next_payment")).toBe("2026-06-01");
  },
);
it("preserves month end, respects the payment limit, and completes the schedule", () => {
  const { sub, payments } = prepare({ payment_limit: 3 }, "2026-01-31");
  expect(payments.map((p) => p.due_date)).toEqual([
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
  ]);
  expect(sub.getFloat("payments_completed")).toBe(3);
  expect(sub.getBool("inactive")).toBe(true);
  expect(sub.getBool("auto_renew")).toBe(false);
});
it("respects quarterly billing and end dates", () => {
  const { sub, payments } = prepare({ frequency: 3, end_date: "2026-09-30" });
  expect(payments.map((p) => p.due_date)).toEqual(["2026-05-01", "2026-08-01"]);
  expect(sub.getBool("inactive")).toBe(true);
});
it("keeps free trial amounts at zero until the paid period", () => {
  const { payments } = prepare({
    trial_months: 3,
    trial_start_date: "2026-05-01",
  });
  expect(payments.map((p) => p.amount)).toEqual([0, 0, 0, 30, 30, 30, 30]);
});
it("restores account relations for another user and accepts backups predating payment accounts", () => {
  const account = create("payment_accounts", { user: user.id, name: "Joint" });
  const { sub, payments } = prepare({ payment_account: account.id });
  app.save(sub);
  saveBackfill(app, sub, payments);
  const backup = exportAccount(app, user.id),
    other = create("users", {
      email: "other@example.test",
      password: "test-hash",
    });
  importAccount(app, other.id, structuredClone(backup), false);
  const restored = app.findRecordsByFilter(
    "subscriptions",
    "user = {:id}",
    "",
    1,
    0,
    { id: other.id },
  )[0];
  const accountId = restored.getString("payment_account");
  expect(accountId).not.toBe(account.id);
  expect(
    app.findRecordById("payment_accounts", accountId).getString("name"),
  ).toBe("Joint");
  expect(
    app
      .findRecordsByFilter("payment_records", "user = {:id}", "", 1, 0, {
        id: other.id,
      })[0]
      .getString("payment_account"),
  ).toBe(accountId);
  delete backup.data.payment_accounts;
  for (const name of ["subscriptions", "payment_records"])
    for (const row of backup.data[name]) delete row.payment_account;
  expect(() => importAccount(app, other.id, backup, false)).not.toThrow();
});
