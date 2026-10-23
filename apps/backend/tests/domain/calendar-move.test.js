const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const runtime = require("../../src/runtime.cjs");
const {
  moveCalendarPayment,
} = require("../../src/domain/lib/calendar-move.js");
const {
  advanceDueSubscriptions,
} = require("../../src/domain/lib/subscription-schedule.js");
const {
  recoverCalendarHistory,
} = require("../../src/domain/lib/calendar-history-recovery.js");
const {
  exportAccount,
  importAccount,
} = require("../../src/domain/lib/account-backup.js");
let directory, app, owner, other, currency, cycle, sub, server, base;
function create(collection, fields) {
  const record = new DataRecord(app.findCollectionByNameOrId(collection));
  for (const [key, value] of Object.entries(fields)) record.set(key, value);
  app.save(record);
  return record;
}
const move = (input, userId = owner.id) =>
  moveCalendarPayment(app, userId, input);
const records = () => app.findRecordsByFilter("payment_records");
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-move-"));
  app = new Repository(directory);
  owner = create("users", {
    email: "move@example.test",
    password: "test-hash",
  });
  other = create("users", {
    email: "other@example.test",
    password: "test-hash",
  });
  currency = create("currencies", {
    user: owner.id,
    code: "TRY",
    name: "TRY",
    symbol: "₺",
    rate: 1,
  });
  cycle = create("cycles", { name: "Monthly" });
  sub = create("subscriptions", {
    user: owner.id,
    name: "Sample subscription",
    price: 125,
    currency: currency.id,
    cycle: cycle.id,
    frequency: 1,
    start_date: "2026-11-30",
    next_payment: "2026-11-30",
    billing_anchor_day: 30,
    auto_renew: true,
  });
  const http = express();
  http.use(express.json());
  http.use((req, res, next) => {
    req.user = req.get("X-Test-User")
      ? app.findRecordById("users", req.get("X-Test-User"))
      : null;
    next();
  });
  runtime.configure(http, app, {});
  delete require.cache[
    require.resolve("../../src/domain/routes_calendar_move.js")
  ];
  require("../../src/domain/routes_calendar_move.js");
  delete require.cache[require.resolve("../../src/domain/routes_calendar.js")];
  require("../../src/domain/routes_calendar.js");
  http.use((error, req, res, next) =>
    res.status(error.status || 500).json({ message: error.message }),
  );
  server = await new Promise((resolve) => {
    const listener = http.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  app.connection.close();
  if (
    path.resolve(directory).startsWith(path.join(os.tmpdir(), "monline-move-"))
  )
    fs.rmSync(directory, { recursive: true, force: true });
});
it("moves one forecast, preserves the renewal anchor and prevents cron/recovery from recreating its old date", () => {
  const before = sub.publicExport();
  const result = move({
    subscription_id: sub.id,
    from_date: "2026-11-30",
    to_date: "2026-12-02",
  });
  expect(result.payment).toMatchObject({
    scheduled_date: "2026-11-30",
    due_date: "2026-12-02",
    amount: 125,
    paid_at: "",
    auto_paid: false,
  });
  expect(app.findRecordById("subscriptions", sub.id).publicExport()).toEqual(
    before,
  );
  advanceDueSubscriptions(app, "2026-11-30");
  recoverCalendarHistory(app, "2026-11-30", owner.id);
  expect(records()).toHaveLength(1);
  expect(records()[0].getString("due_date")).toBe("2026-12-02");
  expect(
    app.findRecordById("subscriptions", sub.id).getString("next_payment"),
  ).toBe("2026-12-30");
});
it("keeps confirmed amounts, receipt metadata and actual payment dates while moving legacy duplicates together", () => {
  const fields = {
    user: owner.id,
    subscription_id: sub.id,
    due_date: "2026-11-30",
    amount: 110,
    paid_at: "2026-11-29T10:00:00Z",
    auto_paid: true,
    notes: "Original note",
    statement_sources: ["source"],
  };
  const first = create("payment_records", fields);
  create("payment_records", { ...fields, amount: 15, paid_at: "" });
  const result = move({
    payment_id: first.id,
    from_date: "2026-11-30",
    to_date: "2026-12-03",
  });
  expect(result.updated).toBe(2);
  expect(result.payment).toMatchObject({
    amount: 110,
    paid_at: fields.paid_at,
    auto_paid: true,
    notes: fields.notes,
    statement_sources: ["source"],
  });
  expect(
    records().every((record) => record.getString("due_date") === "2026-12-03"),
  ).toBe(true);
});
it("moves a standalone payment without touching other independent payments on its day", () => {
  const fields = {
    user: owner.id,
    name: "Standalone",
    currency: currency.id,
    due_date: "2026-11-20",
    amount: 25,
  };
  const first = create("payment_records", fields),
    second = create("payment_records", fields);
  move({
    payment_id: first.id,
    from_date: fields.due_date,
    to_date: "2026-11-21",
  });
  expect(
    app.findRecordById("payment_records", second.id).getString("due_date"),
  ).toBe(fields.due_date);
});
it("rejects stale moves, foreign payments and foreign subscriptions", () => {
  const result = move({
    subscription_id: sub.id,
    from_date: "2026-11-30",
    to_date: "2026-12-02",
  });
  expect(() =>
    move({
      payment_id: result.payment.id,
      from_date: "2026-11-30",
      to_date: "2026-12-03",
    }),
  ).toThrow("calendar_move_changed");
  expect(() =>
    move(
      {
        payment_id: result.payment.id,
        from_date: "2026-12-02",
        to_date: "2026-12-03",
      },
      other.id,
    ),
  ).toThrow("Record not found");
  expect(() =>
    move(
      {
        subscription_id: sub.id,
        from_date: "2026-11-30",
        to_date: "2026-12-03",
      },
      other.id,
    ),
  ).toThrow("Record not found");
  expect(records()).toHaveLength(1);
});
it("rejects collisions with a saved payment or a future occurrence atomically", () => {
  expect(() =>
    move({
      subscription_id: sub.id,
      from_date: "2026-11-30",
      to_date: "2026-12-30",
    }),
  ).toThrow("calendar_move_conflict");
  expect(records()).toHaveLength(0);
  create("payment_records", {
    user: owner.id,
    subscription_id: sub.id,
    due_date: "2026-12-02",
    amount: 10,
  });
  expect(() =>
    move({
      subscription_id: sub.id,
      from_date: "2026-11-30",
      to_date: "2026-12-02",
    }),
  ).toThrow("calendar_move_conflict");
  expect(records()).toHaveLength(1);
});
it.each([
  {},
  { from_date: "2026-02-30", to_date: "2026-12-02" },
  { from_date: "2026-11-30", to_date: "2026-11-30" },
])("rejects invalid move input %j", (input) => {
  expect(() => move({ subscription_id: sub.id, ...input })).toThrow(
    "calendar_move_invalid",
  );
  expect(records()).toHaveLength(0);
});
it("rejects a nonexistent schedule occurrence rather than creating an arbitrary payment", () => {
  expect(() =>
    move({
      subscription_id: sub.id,
      from_date: "2026-11-29",
      to_date: "2026-12-02",
    }),
  ).toThrow("calendar_move_changed");
  expect(() =>
    move({
      subscription_id: sub.id,
      from_date: "2026-12-01",
      to_date: "2026-12-02",
    }),
  ).toThrow("calendar_move_changed");
});
it("keeps the original schedule date across repeat moves and can return the payment to its original day", () => {
  const result = move({
    subscription_id: sub.id,
    from_date: "2026-11-30",
    to_date: "2026-12-02",
  });
  move({
    payment_id: result.payment.id,
    from_date: "2026-12-02",
    to_date: "2026-12-03",
  });
  expect(records()[0].getString("scheduled_date")).toBe("2026-11-30");
  move({
    payment_id: result.payment.id,
    from_date: "2026-12-03",
    to_date: "2026-11-30",
  });
  expect(records()[0].getString("due_date")).toBe("2026-11-30");
});
it("preserves moved dates through account backups without creating any ledger entries", () => {
  move({
    subscription_id: sub.id,
    from_date: "2026-11-30",
    to_date: "2026-12-02",
  });
  const backup = exportAccount(app, owner.id);
  expect(backup.data.payment_records[0].scheduled_date).toBe("2026-11-30");
  importAccount(app, other.id, backup, false, { recoverHistory: false });
  const restored = records().find(
    (record) => record.getString("user") === other.id,
  );
  expect(restored.publicExport()).toMatchObject({
    scheduled_date: "2026-11-30",
    due_date: "2026-12-02",
  });

});
it("rolls back every moved record if one update fails", () => {
  const fields = {
    user: owner.id,
    subscription_id: sub.id,
    due_date: "2026-11-30",
    amount: 10,
  };
  create("payment_records", fields);
  const failing = create("payment_records", fields);
  app.connection.exec(
    `CREATE TRIGGER reject_move BEFORE UPDATE ON payment_records WHEN NEW.id='${failing.id}' BEGIN SELECT RAISE(ABORT, 'test move failure'); END`,
  );
  expect(() =>
    move({
      payment_id: failing.id,
      from_date: "2026-11-30",
      to_date: "2026-12-02",
    }),
  ).toThrow("test move failure");
  expect(
    records().every((record) => record.getString("due_date") === "2026-11-30"),
  ).toBe(true);
});
it("requires authentication and accepts an owned move through the HTTP endpoint", async () => {
  const body = JSON.stringify({
    subscription_id: sub.id,
    from_date: "2026-11-30",
    to_date: "2026-12-02",
  });
  const request = (user) =>
    fetch(base + "/api/calendar/move-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(user ? { "X-Test-User": user } : {}),
      },
      body,
    });
  expect((await request()).status).toBe(401);
  expect((await request(other.id)).status).toBe(404);
  expect((await request(owner.id)).status).toBe(200);
});
it("uses the moved next occurrence in monthly calendar exports and the iCalendar feed", async () => {
  move({
    subscription_id: sub.id,
    from_date: "2026-11-30",
    to_date: "2026-12-02",
  });
  const headers = { "X-Test-User": owner.id };
  const month = await fetch(base + "/api/calendar/data?month=12&year=2026", {
    headers,
  });
  expect((await month.json()).events).toEqual([
    expect.objectContaining({ id: sub.id, date: "2026-12-02" }),
  ]);
  const sourceMonth = await fetch(
    base + "/api/calendar/data?month=11&year=2026",
    { headers },
  );
  expect((await sourceMonth.json()).events).toEqual([]);
  const ical = await (
    await fetch(base + "/api/calendar/ical", { headers })
  ).text();
  expect(ical).toContain("DTSTART;VALUE=DATE:20261202");
  expect(ical).not.toContain("DTSTART;VALUE=DATE:20261130");
});
it("adds the scheduled-date column to older databases while keeping their records intact", () => {
  const payment = create("payment_records", {
    user: owner.id,
    subscription_id: sub.id,
    due_date: "2026-11-30",
    amount: 25,
  });
  app.connection.exec("ALTER TABLE payment_records DROP COLUMN scheduled_date");
  app.connection.close();
  app = new Repository(directory);
  expect(
    app.findRecordById("payment_records", payment.id).publicExport(),
  ).toMatchObject({ due_date: "2026-11-30", scheduled_date: "", amount: 25 });
});
