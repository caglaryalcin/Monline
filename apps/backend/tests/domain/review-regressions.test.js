const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { DatabaseSync } = require("node:sqlite");

let child, directory, base, owner, other, category, cycle, currency, key;
const password = "Monline-regression-password-2026";
async function request(
  endpoint,
  { token = owner?.token, method = "GET", body } = {},
) {
  const response = await fetch(base + endpoint, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  };
}
async function subscription(overrides = {}) {
  const saved = await request("/api/data/subscriptions", {
    method: "POST",
    body: {
      name: "Regression service",
      price: 10,
      currency: currency.id,
      cycle: cycle.id,
      category: category.id,
      frequency: 1,
      next_payment: "2026-01-31",
      ...overrides,
    },
  });
  expect(saved.status, JSON.stringify(saved.data)).toBe(201);
  return saved.data;
}
beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-review-"));
  const port = await new Promise((resolve) => {
    const listener = net.createServer();
    listener.listen(0, "127.0.0.1", () => {
      const port = listener.address().port;
      listener.close(() => resolve(port));
    });
  });
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["src/server.cjs"], {
    cwd: path.resolve(__dirname, "../.."),
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      NODE_ENV: "test",
      MONLINE_PORT: String(port),
      MONLINE_HOST: "127.0.0.1",
      MONLINE_DATA_DIR: directory,
      MONLINE_LEGACY_DATA_DIR: path.join(directory, "absent"),
      TZ: "UTC",
    },
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Regression server failed");
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!ready) throw new Error("Regression server startup timed out");
  const setup = await request("/api/auth/setup", {
    method: "POST",
    body: {
      email: "review@example.test",
      name: "Review",
      username: "Review",
      password,
      passwordConfirm: password,
      language: "en",
      currency: "EUR",
      budget: 0,
      darkThemeMode: 2,
      openRegistrations: false,
      serverUrl: base,
      smtp: { enabled: false },
    },
  });
  expect(setup.status).toBe(201);
  owner = setup.data;
  expect(
    (
      await request("/api/data/users", {
        method: "POST",
        body: {
          email: "other-review@example.test",
          name: "Other",
          password,
          passwordConfirm: password,
        },
      })
    ).status,
  ).toBe(201);
  other = (
    await request("/api/auth/login", {
      method: "POST",
      body: { identity: "other-review@example.test", password },
    })
  ).data;
  category = (await request("/api/data/categories")).data.items[0];
  currency = (await request("/api/data/currencies")).data.items[0];
  cycle = (await request("/api/data/cycles")).data.items.find(
    (c) => c.name === "Monthly",
  );
  const created = await request("/api/api-keys", {
    method: "POST",
    body: { name: "Review", permissions: ["subscriptions:write"] },
  });
  expect(created.status).toBe(200);
  key = created.data.key;
});
afterAll(async () => {
  if (child && child.exitCode === null)
    await new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill();
    });
  if (
    directory &&
    path
      .resolve(directory)
      .startsWith(path.resolve(os.tmpdir()) + path.sep + "monline-review-")
  )
    fs.rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
});

it("records external payments in the real schema, reuses pending payments, and deduplicates retries", async () => {
  const sub = await subscription();
  const pending = await request("/api/data/payment_records", {
    method: "POST",
    body: { subscription_id: sub.id, due_date: sub.next_payment, amount: 10 },
  });
  expect(pending.status).toBe(201);
  const call = (body) =>
    request(`/api/external/subscriptions/${sub.id}/mark-paid`, {
      token: key,
      method: "POST",
      body,
    });
  const paid = await call({ amount: 0, paid_at: "2025-01-01" });
  expect(paid).toMatchObject({
    status: 200,
    data: { success: true, payment_id: pending.data.id },
  });
  expect((await call({ amount: 99 })).data.payment_id).toBe(pending.data.id);
  const rows = (await request("/api/data/payment_records")).data.items.filter(
    (p) => p.subscription_id === sub.id,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    amount: 0,
    due_date: sub.next_payment,
    paid_at: "2025-01-01T00:00:00.000Z",
    auto_paid: false,
  });
  const fallback = await call({ payment_date: "2025-12-31" });
  expect(fallback.status).toBe(200);
  expect(
    (await request(`/api/data/payment_records/${fallback.data.payment_id}`))
      .data.amount,
  ).toBe(10);
});

it("rejects invalid external payment input and enforces ownership and permission", async () => {
  const sub = await subscription();
  const endpoint = `/api/external/subscriptions/${sub.id}/mark-paid`;
  for (const body of [
    { amount: -1 },
    { amount: "bad" },
    { amount: 1e13 },
    { payment_date: "2026-02-30" },
    { paid_at: "bad" },
    { paid_at: "2026-02-30" },
    { paid_at: "2099-01-01" },
  ])
    expect(
      (await request(endpoint, { token: key, method: "POST", body })).status,
    ).toBe(400);
  expect(
    (await request(endpoint, { token: "invalid", method: "POST", body: {} }))
      .status,
  ).toBe(401);
  const foreignKey = await request("/api/api-keys", {
    token: other.token,
    method: "POST",
    body: { name: "Foreign", permissions: ["subscriptions:write"] },
  });
  expect(
    (
      await request(endpoint, {
        token: foreignKey.data.key,
        method: "POST",
        body: {},
      })
    ).status,
  ).toBe(403);
  const readKey = await request("/api/api-keys", {
    method: "POST",
    body: { name: "Read", permissions: ["subscriptions:read"] },
  });
  expect(
    (
      await request(endpoint, {
        token: readKey.data.key,
        method: "POST",
        body: {},
      })
    ).status,
  ).toBe(401);
  expect(
    (await request("/api/data/payment_records")).data.items.filter(
      (p) => p.subscription_id === sub.id,
    ),
  ).toHaveLength(0);
});

it("round-trips statement-containing account backups and their billing anchor", async () => {
  await subscription();
  const statement = await request("/api/statements", {
    method: "POST",
    body: {
      bank: "enpara",
      file_name: "review.pdf",
      file_hash: "a".repeat(64),
      period: "2026-01",
      page_count: 1,
      transactions: [
        {
          id: "row-1",
          kind: "charge",
          date: "2026-01-31",
          amount: 10,
          currency: "EUR",
          merchant: "Test",
          page: 1,
          installment: "",
          subscription_service: "Test",
          subscription_match: "manual",
        },
      ],
    },
  });
  expect(statement.status, JSON.stringify(statement.data)).toBe(201);
  const backup = (await request("/api/account/export")).data;
  expect(backup.data.bank_statements).toHaveLength(1);
  expect(backup.data.subscriptions[0].billing_anchor_day).toBe(31);
  const restore = () =>
    request("/api/account/import", {
      token: other.token,
      method: "POST",
      body: { backup },
    });
  expect(await restore()).toMatchObject({
    status: 200,
    data: { collections: { bank_statements: { imported: 1 } } },
  });
  expect(await restore()).toMatchObject({ status: 200, data: { imported: 0 } });
  const restored = (
    await request("/api/account/export", { token: other.token })
  ).data;
  expect(restored.data.bank_statements[0].transactions).toEqual(
    backup.data.bank_statements[0].transactions,
  );
  expect(
    restored.data.subscriptions.every((s) => s.billing_anchor_day === 31),
  ).toBe(true);
  backup.data.bank_statements[0].transactions[0].date = "2026-02-30";
  expect(await restore()).toMatchObject({
    status: 400,
    data: { error: "transfer_invalid_backup" },
  });
});

it("preserves the anchor through renewal and resets it on a manual reschedule", async () => {
  const sub = await subscription({ auto_renew: true });
  const db = new DatabaseSync(path.join(directory, "monline.db"));
  try {
    const anchor = () =>
      db
        .prepare("SELECT billing_anchor_day FROM subscriptions WHERE id=?")
        .get(sub.id).billing_anchor_day;
    expect(anchor()).toBe(31);
    db.prepare("UPDATE subscriptions SET next_payment=? WHERE id=?").run(
      "2025-02-28",
      sub.id,
    );
    const renewed = await request("/api/subscription/renew", {
      method: "POST",
      body: { id: sub.id },
    });
    expect(renewed.status, JSON.stringify(renewed.data)).toBe(200);
    const {
      advanceDate,
      formatLocalDate,
    } = require("../../src/domain/lib/date-helpers.js");
    let expected = new Date("2025-02-28T00:00:00Z");
    const today = formatLocalDate(new Date());
    while (expected.toISOString().slice(0, 10) <= today)
      expected = advanceDate(expected, "Monthly", 1, 31);
    expect(renewed.data.next_payment).toBe(expected.toISOString().slice(0, 10));
    expect(anchor()).toBe(31);
    expect(
      (
        await request(`/api/data/subscriptions/${sub.id}`, {
          method: "PATCH",
          body: { next_payment: "2027-01-15", billing_anchor_day: 27 },
        })
      ).status,
    ).toBe(200);
    expect(anchor()).toBe(15);
    expect(
      (
        await request(`/api/data/subscriptions/${sub.id}`, {
          method: "PATCH",
          body: { notes: "Keep anchor", billing_anchor_day: 27 },
        })
      ).status,
    ).toBe(200);
    expect(anchor()).toBe(15);
  } finally {
    db.close();
  }
});

it("keeps the first paid charge's original day when the upcoming date is clamped", async () => {
  const sub = await subscription({
    initial_payment: {
      date: "2026-01-31",
      utc_offset_minutes: 0,
      paid_utc_offset_minutes: 0,
    },
  });
  expect(sub.next_payment).toBe("2026-02-28");
  const backup = (await request("/api/account/export")).data;
  expect(
    backup.data.subscriptions.find((s) => s.id === sub.id).billing_anchor_day,
  ).toBe(31);
});
