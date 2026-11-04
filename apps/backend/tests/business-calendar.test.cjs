const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const root = path.resolve(process.env.MONLINE_TEST_ROOT || ".");
const load = (file) => require(path.join(root, "apps/backend/src", file));
const { Repository, DataRecord } = load("storage.cjs");
const { lastWeekdayOfMonth, weekdayBillingOnOrAfter } = load("domain/lib/pure/last-weekday.mjs");
const { holidayCountries, holidayRegions, normalizeBusinessCalendar } = load("domain/lib/pure/business-calendar.mjs");
const { advanceDate } = load("domain/lib/date-helpers.js");
const { backfillDates } = load("domain/lib/pure/backfill-schedule.js");
const templates = load("notification-templates.cjs");

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-holidays-"));
  const app = new Repository(directory);
  t.after(() => {
    app.connection.close();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith("monline-holidays-"));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const create = (name, values) => {
    const record = new DataRecord(app.findCollectionByNameOrId(name));
    for (const [key, value] of Object.entries(values)) record.set(key, value);
    return app.save(record);
  };
  const user = create("users", { email: "calendar@example.test", password: "fixture-hash", name: "Login name", language: "tr", country: "DE", payment_tracking: true });
  const currency = create("currencies", { user: user.id, name: "Euro", code: "EUR", symbol: "€", rate: 1 });
  const cycle = create("cycles", { name: "Last-Weekday" });
  const express = require(require.resolve("express", { paths: [path.join(root, "apps/backend")] }));
  load("runtime.cjs").configure(express(), app, {});
  const hook = path.join(root, "apps/backend/src/domain/subscription_start.js");
  delete require.cache[require.resolve(hook)];
  require(hook);
  const sub = (values = {}) => create("subscriptions", { user: user.id, name: "Plan", price: 100, currency: currency.id, cycle: cycle.id, frequency: 1, next_payment: "2028-10-31", start_date: "2028-09-29", auto_renew: true, ...values });
  const payment = (subscription, values = {}) => create("payment_records", { user: user.id, subscription_id: subscription.id, due_date: "2028-10-31", amount: 87, ...values });
  const region = (value) => { user.set("region", value); return app.save(user); };
  return { app, create, user, currency, cycle, sub, payment, region };
}

for (const [date, calendar, expected] of [
  ["2025-10-01", {}, "2025-10-31"],
  ["2025-10-01", { country: "DE" }, "2025-10-31"],
  ["2025-10-01", { country: "DE", region: "BB" }, "2025-10-30"],
  ["2024-08-01", { country: "TR" }, "2024-08-29"],
  ["2025-03-01", { country: "TR" }, "2025-03-28"],
  ["2021-12-01", { country: "US" }, "2021-12-30"],
  ["2021-05-01", { country: "US" }, "2021-05-28"],
]) test(`last business day: ${date} ${JSON.stringify(calendar)}`, () => assert.equal(lastWeekdayOfMonth(date, calendar), expected));

test("location metadata and validation keep regions scoped to their country", () => {
  assert(holidayCountries("tr").some((entry) => entry.code === "TR"));
  assert(holidayCountries("pt_BR").some((entry) => entry.code === "DE"));
  assert(holidayRegions("DE").some((entry) => entry.code === "BB"));
  assert.deepEqual(holidayRegions("TR"), []);
  assert.deepEqual(normalizeBusinessCalendar({ country: " de ", region: "BB" }), { country: "DE", region: "BB" });
  for (const value of [{ country: "ZZ" }, { country: "DE", region: "CA" }, { region: "BB" }])
    assert.throws(() => normalizeBusinessCalendar(value), /holiday_calendar_invalid/);
});

test("recurrence, backfill and trial resumption share the regional calendar", () => {
  const calendar = { country: "DE", region: "BB" };
  assert.equal(advanceDate(new Date("2025-09-30T12:00:00Z"), "Last-Weekday", 1, 30, calendar).toISOString().slice(0, 10), "2025-10-30");
  assert.equal(weekdayBillingOnOrAfter("2025-10-31", calendar), "2025-11-28");
  assert.deepEqual(backfillDates({ start: "2025-09-01", until: "2025-11-30", cycle: "Last-Weekday", frequency: 1, calendar }), ["2025-09-30", "2025-10-30", "2025-11-28"]);
  const trial = { trial_duration: 1, trial_unit: "month", trial_start_date: "2025-09-30", billing_calendar: calendar };
  assert.equal(load("domain/lib/pure/subscription-trial.mjs").nextTrialPaymentDate(trial, "2025-09-30", 30, "Last-Weekday"), "2025-10-30");
});

test("saving preferences updates pending dates and preserves past paid records", (t) => {
  const f = fixture(t), sub = f.sub(), pending = f.payment(sub);
  const past = f.payment(sub, { due_date: "2025-10-31", paid_at: "2025-10-31T12:00:00Z", amount: 73 });
  const before = f.app.findRecordById("payment_records", past.id).publicExport();
  f.region("BB");
  assert.equal(f.app.findRecordById("subscriptions", sub.id).getString("next_payment"), "2028-10-30");
  assert.equal(f.app.findRecordById("payment_records", pending.id).getString("due_date").slice(0, 10), "2028-10-30");
  assert.deepEqual(f.app.findRecordById("payment_records", past.id).publicExport(), before);
  assert.deepEqual(f.app.findRecordById("subscriptions", sub.id).publicExport().billing_calendar, { country: "DE", region: "BB" });
});

test("a future paid period keeps its date and does not get charged twice", (t) => {
  const f = fixture(t), sub = f.sub(), paid = f.payment(sub, { paid_at: "2026-11-01T12:00:00Z" });
  const before = paid.publicExport();
  f.region("BB");
  assert.deepEqual(f.app.findRecordById("payment_records", paid.id).publicExport(), before);
  load("domain/lib/subscription-schedule.js").advanceSubscription(f.app, sub.id, "2028-10-31");
  assert.equal(f.app.countRecords("payment_records"), 1);
  assert.equal(f.app.findRecordById("subscriptions", sub.id).getString("next_payment"), "2028-11-30");
});

test("a manually moved payment retains its chosen date", (t) => {
  const f = fixture(t), sub = f.sub();
  const moved = f.payment(sub, { scheduled_date: "2028-10-31", due_date: "2028-11-03" });
  f.region("BB");
  const stored = f.app.findRecordById("payment_records", moved.id);
  assert.equal(stored.getString("due_date").slice(0, 10), "2028-11-03");
  assert.equal(stored.getString("scheduled_date"), "2028-10-30");
  assert.equal(stored.getFloat("amount"), 87);
});

test("overlapping payments roll back the preference and date change together", (t) => {
  const f = fixture(t), sub = f.sub(), pending = f.payment(sub);
  f.payment(sub, { due_date: "2028-10-30" });
  assert.throws(() => f.region("BB"), /holiday_calendar_payment_conflict/);
  assert.equal(f.app.findRecordById("users", f.user.id).getString("region"), "");
  assert.equal(f.app.findRecordById("payment_records", pending.id).getString("due_date").slice(0, 10), "2028-10-31");
});

test("ordinary monthly schedules are unaffected by holiday preferences", (t) => {
  const f = fixture(t), monthly = f.create("cycles", { name: "Monthly" });
  const sub = f.sub({ cycle: monthly.id });
  f.region("BB");
  assert.equal(f.app.findRecordById("subscriptions", sub.id).getString("next_payment"), "2028-10-31");
});

test("account backups preserve country and region", (t) => {
  const f = fixture(t); f.region("BB"); f.sub();
  const backups = load("domain/lib/account-backup.js"), backup = backups.exportAccount(f.app, f.user.id);
  assert.equal(backup.profile.country, "DE"); assert.equal(backup.profile.region, "BB");
  const recipient = f.create("users", { email: "restore@example.test", password: "fixture-hash" });
  backups.importAccount(f.app, recipient.id, backup, true, { recoverHistory: false });
  const restored = f.app.findRecordById("users", recipient.id);
  assert.equal(restored.getString("country"), "DE"); assert.equal(restored.getString("region"), "BB");
});

for (const channel of templates.CHANNELS) test(`confirmed person name is used by ${channel}`, () => {
  const context = { language: "tr", event: "payment", sample: true, user_name: "Login name", payer: "Login name", confirmed_user_name: "Çağlar", days: 3, subscriptions: [] };
  const result = templates.renderNotification({ [channel]: { payment: { message: "{{user_name}} / {{message}}" } } }, channel, context);
  assert(result.message.includes("Çağlar")); assert(!result.message.includes("Login name"));
  const fallback = templates.renderNotification({}, channel, { ...context, confirmed_user_name: "" });
  assert(fallback.message.includes("Siz")); assert(!fallback.message.includes("Login name"));
});

test("default SMTP body has no duplicate Monline brand heading", () => {
  const result = templates.renderNotification({}, "email", { language: "tr", event: "payment", subscriptions: [] });
  assert(result.html.includes("<h1"));
  assert(!/<p[^>]*>Monline<\/p>/.test(result.html));
});

test("Telegram and ntfy use the appropriate bold formatting without sending requests", async () => {
  const runtime = load("runtime.cjs"), original = runtime.httpClient.send;
  const requests = [];
  runtime.httpClient.send = async (request) => { requests.push(request); return { statusCode: 200 }; };
  try {
    await load("domain/lib/notifications.js").sendTelegram("fixture-token", "fixture-chat", "**Kalın**\n`**literal**`\n[Link](https://example.test)");
    const body = JSON.parse(requests[0].body);
    assert.equal(body.parse_mode, "Markdown");
    assert.equal(body.text, "*Kalın*\n`**literal**`\n[Link](https://example.test)");
    const ntfy = load("domain/lib/ntfy.js").ntfyRequest("https://example.test", "fixture-topic", "Başlık", "**Kalın**");
    assert.equal(ntfy.headers.Markdown, "yes"); assert.equal(ntfy.body, "**Kalın**");
  } finally { runtime.httpClient.send = original; }
});
