const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

let child,
  directory,
  base,
  owner,
  other,
  currency,
  cycle,
  subscription,
  category;
const password = "Monline-test-password-2026";
async function request(endpoint, { token, body, method = "GET" } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const response = await fetch(base + endpoint, {
    method,
    headers,
    signal: AbortSignal.timeout(10000),
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    headers: response.headers,
    data: response.status === 204 ? null : await response.json(),
  };
}
async function startServer(port) {
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
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Test server did not start");
    try {
      const response = await fetch(base + "/api/health");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Test server startup timed out");
}
beforeAll(async () => {
  directory = mkdtempSync(path.join(os.tmpdir(), "monline-api-"));
  const port = await new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.on("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const value = listener.address().port;
      listener.close(() => resolve(value));
    });
  });
  base = `http://127.0.0.1:${port}`;
  await startServer(port);
});
afterAll(async () => {
  if (child && child.exitCode === null)
    await new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill();
    });
  const prefix = path.resolve(os.tmpdir()) + path.sep + "monline-api-";
  if (directory && path.resolve(directory).startsWith(prefix))
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
});
it("bootstraps an administrator with the Monline accent and private credentials", async () => {
  const signup = await request("/api/auth/setup", {
    method: "POST",
    body: {
      email: "owner@example.test",
      name: "Owner",
      username: "Owner",
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
  expect(signup.status).toBe(201);
  expect(signup.data.record.color_theme).toBe("monline");
  expect(signup.data.record.password).toBeUndefined();
  const setupCookie = signup.headers.get("set-cookie").split(";")[0];
  const restoredSetup = await fetch(base + "/api/auth/refresh", {
    method: "POST",
    headers: { Cookie: setupCookie, Origin: base },
  });
  expect(restoredSetup.status).toBe(200);
  expect(await restoredSetup.json()).toMatchObject({
    token: signup.data.token,
    remember: false,
    record: { id: signup.data.record.id },
  });
  expect(restoredSetup.headers.get("set-cookie")).not.toContain("Max-Age=");
  const seededCategories = await request("/api/data/categories", {
    token: signup.data.token,
  });
  category = seededCategories.data.items[0];
  expect(
    seededCategories.data.items.map((category) => category.name).sort(),
  ).toEqual(
    [
      "AI",
      "Shopping",
      "Cloud Storage",
      "Communication",
      "Education",
      "Gaming",
      "Health",
      "Music",
      "News",
      "Other",
      "Video",
    ].sort(),
  );
  expect(
    seededCategories.data.items.every((category) => category.translation_key),
  ).toBe(true);
  const seededMethods = await request("/api/data/payment_methods", {
    token: signup.data.token,
  });
  const methodNames = seededMethods.data.items.map((method) => method.name);
  expect(methodNames).toHaveLength(31);
  expect(methodNames).toEqual(
    expect.arrayContaining([
      "Denizbank",
      "Enpara",
      "Garanti",
      "Akbank",
      "Yapı Kredi",
      "İş Bankası",
    ]),
  );
  for (const removed of [
    "Neteller",
    "Other",
    "Square",
    "Zelle",
    "Afterpay",
    "Cash App",
  ])
    expect(methodNames).not.toContain(removed);
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { identity: "owner@example.test", password },
  });
  expect(login.status).toBe(200);
  owner = login.data;
  expect(login.headers.get("set-cookie")).toContain("HttpOnly");
  expect(login.data.record.totp_secret).toBeUndefined();
  expect(
    (await request("/api/auth/is-admin", { token: owner.token })).data.isAdmin,
  ).toBe(true);
});
it("tests unsaved ntfy credentials over HTTP without persisting them and saves them only on request", async () => {
  const received = [];
  const listener = require("node:http").createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({
      url: req.url,
      headers: req.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"id":"local-test"}');
  });
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  try {
    const endpoint = "/api/data/notifications_config";
    const config = {
      ntfy_url: `http://127.0.0.1:${listener.address().port}/`,
      ntfy_topic: "test-topic",
      ntfy_username: "demo",
      ntfy_password: "draft-password",
      ntfy_auth_token: "",
    };
    const before = (await request(endpoint, { token: owner.token })).data.items;
    expect(
      (
        await request("/api/notifications/test", {
          token: owner.token,
          method: "POST",
          body: { provider: "ntfy", config },
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(endpoint, { token: owner.token })).data.items,
    ).toEqual(before);
    expect(received[0]).toMatchObject({
      url: "/test-topic",
      headers: {
        authorization:
          "Basic " + Buffer.from("demo:draft-password").toString("base64"),
      },
    });
    const saved = await request(endpoint, {
      token: owner.token,
      method: "POST",
      body: { ...config, ntfy_enabled: false, ntfy_password: "saved-password" },
    });
    expect(saved.status).toBe(201);
    expect(saved.data.ntfy_username).toBe("demo");
    expect(saved.data.ntfy_password).toBe("saved-password");
    expect(
      (
        await request("/api/notifications/test", {
          token: owner.token,
          method: "POST",
          body: { provider: "ntfy", config },
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(endpoint + "/" + saved.data.id, { token: owner.token }))
        .data.ntfy_password,
    ).toBe("saved-password");
    expect(
      (
        await request("/api/notifications/test", {
          token: owner.token,
          method: "POST",
          body: { provider: "ntfy" },
        })
      ).status,
    ).toBe(200);
    expect(received[2].headers.authorization).toBe(
      "Basic " + Buffer.from("demo:saved-password").toString("base64"),
    );
    expect(received).toHaveLength(3);
  } finally {
    listener.closeAllConnections();
    await new Promise((resolve) => listener.close(resolve));
  }
});

it("honors login persistence and preserves the preference when refreshing", async () => {
  for (const remember of [false, true]) {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { identity: "owner@example.test", password, remember },
    });
    expect(login.status).toBe(200);
    expect(login.data.remember).toBe(remember);
    expect(login.headers.get("set-cookie").includes("Max-Age=")).toBe(remember);
    if (remember) {
      const maxAge = Number(
        login.headers.get("set-cookie").match(/Max-Age=(\d+)/)[1],
      );
      expect(maxAge).toBeGreaterThanOrEqual(2591998);
      expect(maxAge).toBeLessThanOrEqual(2592000);
    }
    const refreshed = await request("/api/auth/refresh", {
      method: "POST",
      token: login.data.token,
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.data.remember).toBe(remember);
    expect(refreshed.headers.get("set-cookie").includes("Max-Age=")).toBe(
      remember,
    );
    await request("/api/auth/logout", {
      method: "POST",
      token: login.data.token,
    });
    expect(
      (
        await request("/api/auth/refresh", {
          method: "POST",
          token: login.data.token,
        })
      ).status,
    ).toBe(401);
  }
});
it("restores cookie sessions only through a same-origin refresh request", async () => {
  for (const remember of [false, true]) {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { identity: "owner@example.test", password, remember },
    });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const restored = await fetch(base + "/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: cookie, Origin: base },
    });
    expect(restored.status).toBe(200);
    expect(await restored.json()).toMatchObject({
      token: login.data.token,
      remember,
      record: { id: owner.record.id },
    });
    expect(restored.headers.get("set-cookie").includes("Max-Age=")).toBe(
      remember,
    );
    for (const origin of [undefined, "https://untrusted.example"]) {
      const blocked = await fetch(base + "/api/auth/refresh", {
        method: "POST",
        headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) },
      });
      expect(blocked.status).toBe(403);
    }
    const bearerRequired = await fetch(base + "/api/auth/is-admin", {
      headers: { Cookie: cookie },
    });
    expect(bearerRequired.status).toBe(403);
    await request("/api/auth/logout", {
      method: "POST",
      token: login.data.token,
    });
    const expired = await fetch(base + "/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: cookie, Origin: base },
    });
    expect(expired.status).toBe(401);
  }
});
it("enforces registration policy and account ownership", async () => {
  const body = {
    email: "other@example.test",
    name: "Other",
    password,
    passwordConfirm: password,
  };
  expect(
    (await request("/api/data/users", { method: "POST", body })).status,
  ).toBe(403);
  expect(
    (
      await request("/api/data/users", {
        method: "POST",
        token: owner.token,
        body,
      })
    ).status,
  ).toBe(201);
  other = (
    await request("/api/auth/login", {
      method: "POST",
      body: { identity: body.email, password },
    })
  ).data;
  currency = (
    await request("/api/data/currencies", { token: owner.token })
  ).data.items.find((row) => row.code === "EUR");
  cycle = (
    await request("/api/data/cycles", { token: owner.token })
  ).data.items.find((row) => row.name === "Monthly");
  expect(
    (
      await request(`/api/data/currencies/${currency.id}`, {
        token: other.token,
      })
    ).status,
  ).toBe(404);
  const filter = encodeURIComponent(`user = "${owner.record.id}" || id != ""`);
  const rows = (
    await request("/api/data/currencies?filter=" + filter, {
      token: other.token,
    })
  ).data.items;
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row) => row.user === other.record.id)).toBe(true);
});
it("blocks regular logins and signups during login lockdown while allowing the administrator to sign in", async () => {
  expect(
    (
      await request("/api/admin/settings", {
        token: owner.token,
        method: "PATCH",
        body: { disable_login: true },
      })
    ).status,
  ).toBe(200);
  try {
    expect(
      (
        await request("/api/auth/login", {
          method: "POST",
          body: { identity: "other@example.test", password },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/api/auth/login", {
          method: "POST",
          body: { identity: "owner@example.test", password },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request("/api/data/users", {
          method: "POST",
          body: {
            email: "blocked@example.test",
            name: "Blocked",
            password,
            passwordConfirm: password,
          },
        })
      ).status,
    ).toBe(403);
  } finally {
    await request("/api/admin/settings", {
      token: owner.token,
      method: "PATCH",
      body: { disable_login: false },
    });
  }
  expect(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { identity: "other@example.test", password },
      })
    ).status,
  ).toBe(200);
});
it("keeps a single default person per account and chooses a replacement after deletion", async () => {
  const list = async (token) =>
    (await request("/api/data/household", { token })).data.items;
  expect(
    (await list(owner.token)).filter((member) => member.is_main),
  ).toHaveLength(1);
  const otherMain = (await list(other.token)).find(
    (member) => member.is_main,
  ).id;
  const created = await request("/api/data/household", {
    token: owner.token,
    method: "POST",
    body: { name: "Main person", is_main: true },
  });
  expect(created.status).toBe(201);
  expect(
    (await list(owner.token))
      .filter((member) => member.is_main)
      .map((member) => member.id),
  ).toEqual([created.data.id]);
  expect(
    (
      await request(`/api/data/household/${otherMain}`, {
        token: owner.token,
        method: "PATCH",
        body: { is_main: true },
      })
    ).status,
  ).toBe(404);
  expect((await list(other.token)).find((member) => member.is_main).id).toBe(
    otherMain,
  );
  expect(
    (
      await request(`/api/data/household/${created.data.id}`, {
        token: owner.token,
        method: "DELETE",
      })
    ).status,
  ).toBe(204);
  expect(
    (await list(owner.token)).filter((member) => member.is_main),
  ).toHaveLength(1);
});
it("sets exactly one main payment method per account and selects a replacement on deletion", async () => {
  const list = async (token) =>
    (await request("/api/data/payment_methods", { token })).data.items;
  const original = await list(owner.token);
  const othersMain = (await list(other.token)).find(
    (method) => method.is_main,
  ).id;
  expect(original.filter((method) => method.is_main)).toHaveLength(1);
  const selected = original.find((method) => !method.is_main);
  expect(
    (
      await request(`/api/data/payment_methods/${selected.id}`, {
        token: owner.token,
        method: "PATCH",
        body: { is_main: true },
      })
    ).status,
  ).toBe(200);
  const changed = await list(owner.token);
  expect(
    changed.filter((method) => method.is_main).map((method) => method.id),
  ).toEqual([selected.id]);
  expect((await list(other.token)).find((method) => method.is_main).id).toBe(
    othersMain,
  );
  expect(
    (
      await request(`/api/data/payment_methods/${othersMain}`, {
        token: owner.token,
        method: "PATCH",
        body: { is_main: true },
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(`/api/data/payment_methods/${selected.id}`, {
        token: owner.token,
        method: "DELETE",
      })
    ).status,
  ).toBe(204);
  expect(
    (await list(owner.token)).filter((method) => method.is_main),
  ).toHaveLength(1);
});
it("saves a subscription, expands relations and protects its uploaded logo", async () => {
  const body = new FormData();
  for (const [key, value] of Object.entries({
    name: "Test service",
    price: "12.50",
    frequency: "1",
    currency: currency.id,
    category: category.id,
    cycle: cycle.id,
    next_payment: new Date().toISOString().slice(0, 10),
  }))
    body.set(key, value);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=",
    "base64",
  );
  body.set("logo", new Blob([png], { type: "image/png" }), "logo.png");
  const saved = await request("/api/data/subscriptions", {
    method: "POST",
    token: owner.token,
    body,
  });
  expect(saved.status).toBe(201);
  subscription = saved.data;
  expect(subscription.start_date).toBe(
    require("../../src/domain/lib/pure/subscription-start.js").automaticStartDate(
      subscription.next_payment,
      "Monthly",
      1,
    ),
  );
  const expanded = await request(
    `/api/data/subscriptions/${subscription.id}?expand=currency,cycle`,
    { token: owner.token },
  );
  expect(expanded.data.expand.currency.code).toBe("EUR");
  expect(expanded.data.expand.cycle.name).toBe("Monthly");
  const file = `/api/files/subscriptions/${subscription.id}/${encodeURIComponent(subscription.logo)}`;
  expect(
    (
      await fetch(base + file, {
        headers: { Authorization: `Bearer ${other.token}` },
      })
    ).status,
  ).toBe(404);
  const image = await fetch(base + file, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  expect(image.status).toBe(200);
  expect(Buffer.from(await image.arrayBuffer())).toEqual(png);
});
it("requires an owned category for all subscription writes and prevents deleting used categories", async () => {
  const values = {
    name: "Category validation",
    price: 10,
    frequency: 1,
    currency: currency.id,
    cycle: cycle.id,
    next_payment: new Date().toISOString().slice(0, 10),
  };
  const foreign = (
    await request("/api/data/categories", { token: other.token })
  ).data.items[0].id;
  for (const selection of [undefined, "", " ", "missing-category", foreign]) {
    for (const multipart of [false, true]) {
      let body = {
        ...values,
        ...(selection === undefined ? {} : { category: selection }),
      };
      if (multipart) {
        const form = new FormData();
        for (const [key, value] of Object.entries(body))
          form.set(key, String(value));
        body = form;
      }
      const rejected = await request("/api/data/subscriptions", {
        token: owner.token,
        method: "POST",
        body,
      });
      expect(rejected.status).toBe(400);
    }
  }
  const id = subscription.id;
  for (const multipart of [false, true]) {
    const body = multipart ? new FormData() : { category: "" };
    if (multipart) body.set("category", "");
    expect(
      (
        await request(`/api/data/subscriptions/${id}`, {
          token: owner.token,
          method: "PATCH",
          body,
        })
      ).status,
    ).toBe(400);
  }
  const key = await request("/api/api-keys", {
    token: owner.token,
    method: "POST",
    body: {
      name: "Category checks",
      permissions: ["subscriptions:write", "categories:write"],
    },
  });
  expect(key.status).toBe(200);
  const external = { ...values, currency_id: currency.id, cycle_id: cycle.id };
  expect(
    (
      await request("/api/external/subscriptions", {
        token: key.data.key,
        method: "POST",
        body: external,
      })
    ).status,
  ).toBe(400);
  const batch = await request("/api/external/subscriptions/batch", {
    token: key.data.key,
    method: "POST",
    body: { items: [external, { ...external, category_id: category.id }] },
  });
  expect(batch.status).toBe(200);
  expect(batch.data.errors).toHaveLength(1);
  expect(batch.data.created).toHaveLength(1);
  expect(
    (
      await request(`/api/external/subscriptions/${id}`, {
        token: key.data.key,
        method: "PUT",
        body: { category_id: "" },
      })
    ).status,
  ).toBe(400);
  for (const endpoint of [
    `/api/data/categories/${category.id}`,
    `/api/external/categories/${category.id}`,
  ]) {
    const blocked = await request(endpoint, {
      token: endpoint.includes("external") ? key.data.key : owner.token,
      method: "DELETE",
    });
    expect(blocked.status).toBe(400);
  }
  const imported = await request("/api/subscriptions/import", {
    token: owner.token,
    method: "POST",
    body: {
      subscriptions: [
        {
          name: "Uncategorized import",
          price: 2,
          currency: "EUR",
          cycle: "Monthly",
        },
      ],
    },
  });
  expect(imported.status).toBe(200);
  expect(imported.data.imported).toBe(0);
  expect(imported.data.skipped).toBe(1);

  // Simulate an old uncategorized record without weakening production validation.
  const db = new (require("node:sqlite").DatabaseSync)(
    path.join(directory, "monline.db"),
  );
  try {
    db.prepare("UPDATE subscriptions SET category='' WHERE id=?").run(id);
  } finally {
    db.close();
  }
  expect(
    (
      await request(`/api/data/subscriptions/${id}`, {
        token: owner.token,
        method: "PATCH",
        body: { notes: "Needs category" },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("/api/subscription/clone", {
        token: owner.token,
        method: "POST",
        body: { id },
      })
    ).status,
  ).toBe(400);
  const legacyBackup = (
    await request("/api/account/export", { token: owner.token })
  ).data;
  for (const file of legacyBackup.files) {
    const response = await fetch(
      `${base}/api/files/${file.collection}/${file.recordId}/${encodeURIComponent(file.name)}`,
      { headers: { Authorization: `Bearer ${owner.token}` } },
    );
    expect(response.ok).toBe(true);
    file.base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
  }
  expect(
    (
      await request("/api/data/users", {
        token: owner.token,
        method: "POST",
        body: {
          email: "legacy-backup@example.test",
          name: "Legacy restore",
          password,
          passwordConfirm: password,
        },
      })
    ).status,
  ).toBe(201);
  const restoreUser = (
    await request("/api/auth/login", {
      method: "POST",
      body: { identity: "legacy-backup@example.test", password },
    })
  ).data;
  const restoreResponse = await request("/api/account/import", {
    token: restoreUser.token,
    method: "POST",
    body: { backup: legacyBackup },
  });
  expect(restoreResponse, JSON.stringify(restoreResponse.data)).toMatchObject({
    status: 200,
  });
  const legacy = (
    await request("/api/data/subscriptions", { token: restoreUser.token })
  ).data.items.find((row) => row.name === subscription.name);
  expect(legacy.category).toBe("");
  expect(
    (
      await request(`/api/data/subscriptions/${legacy.id}`, {
        token: restoreUser.token,
        method: "PATCH",
        body: { notes: "Choose category first" },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(`/api/data/users/${restoreUser.record.id}`, {
        token: restoreUser.token,
        method: "DELETE",
      })
    ).status,
  ).toBe(204);
  expect(
    (
      await request(`/api/data/subscriptions/${id}`, {
        token: owner.token,
        method: "PATCH",
        body: { category: category.id },
      })
    ).status,
  ).toBe(200);
  await request(`/api/data/subscriptions/${batch.data.created[0].id}`, {
    token: owner.token,
    method: "DELETE",
  });
  await request(`/api/api-keys/${key.data.id}`, {
    token: owner.token,
    method: "DELETE",
  });
});
it("preserves payments and file references in account backups", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const payment = await request("/api/payments/history", {
    token: owner.token,
    method: "POST",
    body: {
      subscription_id: subscription.id,
      due_date: today,
      paid_date: today,
      amount: 12.5,
      utc_offset_minutes: 0,
      paid_utc_offset_minutes: 0,
    },
  });
  expect(payment.status).toBe(201);
  const renamed = await request(`/api/data/subscriptions/${subscription.id}`, {
    token: owner.token,
    method: "PATCH",
    body: { name: "FACEIT" },
  });
  expect(renamed.data.name).toBe("Faceit");
  const updated = await request(`/api/data/subscriptions/${subscription.id}`, {
    token: owner.token,
    method: "PATCH",
    body: { name: "ChatGPT", price: 5 },
  });
  expect(updated.status).toBe(200);
  expect(updated.data.name).toBe("Chatgpt");
  expect(updated.data.price).toBe(5);
  const backup = await request("/api/account/export", { token: owner.token });
  expect(backup.data.format).toBe("monline-account-backup");
  expect(backup.data.data.payment_records).toHaveLength(1);
  expect(backup.data.data.payment_records[0].amount).toBe(12.5);
  expect(
    backup.data.files.some((file) => file.recordId === subscription.id),
  ).toBe(true);
  expect(backup.data.profile.password).toBeUndefined();
  const clearLogo = new FormData();
  clearLogo.set("logo-", "logo");
  expect(
    (
      await request(`/api/data/subscriptions/${subscription.id}`, {
        token: owner.token,
        method: "PATCH",
        body: clearLogo,
      })
    ).data.logo,
  ).toBe("");
  expect(
    (
      await request(`/api/data/subscriptions/${subscription.id}`, {
        token: owner.token,
        method: "DELETE",
      })
    ).status,
  ).toBe(204);
  expect(
    (await request("/api/data/subscriptions", { token: owner.token })).data
      .totalItems,
  ).toBe(0);
});
it("retains the statement import marker and its initial date when changing a plan", async () => {
  const date = new Date().toISOString().slice(0, 10);
  const statement = await request("/api/statements", {
    token: owner.token,
    method: "POST",
    body: {
      bank: "enpara",
      file_name: "statement.pdf",
      file_hash: "a".repeat(64),
      period: date.slice(0, 7),
      page_count: 1,
      transactions: [
        {
          id: "row-1",
          kind: "charge",
          date,
          amount: 8000,
          currency: "EUR",
          merchant: "OPENAI *CHATGPT SUBSCR",
          page: 1,
          installment: "",
          subscription_service: "Chatgpt",
          subscription_match: "catalog",
        },
      ],
    },
  });
  expect(statement.status).toBe(201);
  const result = await request(`/api/statements/${statement.data.id}/import`, {
    token: owner.token,
    method: "POST",
    body: {
      utc_offset_minutes: 0,
      groups: [
        {
          transaction_ids: ["row-1"],
          category: category.id,
          new_subscription: {
            name: "Chatgpt",
            cycle: cycle.id,
            frequency: 1,
            active: false,
          },
        },
      ],
    },
  });
  expect(result.status).toBe(200);
  expect(result.data.subscriptions_created).toBe(1);
  const sub = (await request("/api/data/subscriptions", { token: owner.token }))
    .data.items[0];
  expect(sub.statement_imported).toBe(true);
  expect(sub.start_date).toBe(date);
  const updated = await request(`/api/data/subscriptions/${sub.id}`, {
    token: owner.token,
    method: "PATCH",
    body: { price: 5000 },
  });
  expect(updated.data.start_date).toBe(date);
  const exported = (
    await request("/api/account/export", { token: owner.token })
  ).data;
  expect(exported.data.subscriptions[0].statement_imported).toBe(true);
  expect(
    exported.data.payment_records.find(
      (payment) => payment.subscription_id === sub.id,
    ).amount,
  ).toBe(8000);
});
it("imports statement payments older than one year with original dates and amounts, deduplicates them and rejects future dates", async () => {
  const year = new Date().getUTCFullYear();
  const date = `${year - 2}-07-03`;
  const future = `${year + 1}-07-03`;
  const statement = await request("/api/statements", {
    token: owner.token,
    method: "POST",
    body: {
      bank: "enpara",
      file_name: "older-statement.pdf",
      file_hash: require("node:crypto")
        .createHash("sha256")
        .update("older-statement-test")
        .digest("hex"),
      period: date.slice(0, 7),
      page_count: 1,
      transactions: [date, future].map((day, index) => ({
        id: `old-row-${index}`,
        date: day,
        amount: 489.6,
        currency: "EUR",
        kind: "charge",
        page: 1,
        installment: "",
        merchant: "OPENAI *CHATGPT SUBSCR",
        subscription_service: "Older statement subscription",
        subscription_match: "manual",
      })),
    },
  });
  expect(statement.status).toBe(201);
  const endpoint = `/api/statements/${statement.data.id}/import`;
  const group = {
    transaction_ids: ["old-row-0"],
    category: category.id,
    new_subscription: {
      name: "Older statement subscription",
      cycle: cycle.id,
      frequency: 1,
      active: false,
    },
  };
  const body = { utc_offset_minutes: 0, groups: [group] };
  const imported = await request(endpoint, {
    token: owner.token,
    method: "POST",
    body,
  });
  expect(imported.status).toBe(200);
  expect(imported.data).toMatchObject({
    subscriptions_created: 1,
    payments_imported: 1,
    payments_skipped: 0,
  });
  const repeated = await request(endpoint, {
    token: owner.token,
    method: "POST",
    body,
  });
  expect(repeated.status).toBe(200);
  expect(repeated.data).toMatchObject({
    subscriptions_created: 0,
    payments_imported: 0,
    payments_skipped: 1,
  });
  const rejected = await request(endpoint, {
    token: owner.token,
    method: "POST",
    body: { ...body, groups: [{ ...group, transaction_ids: ["old-row-1"] }] },
  });
  expect(rejected.status).toBe(400);
  expect(rejected.data.error).toBe("historical_invalid_date");
  const sub = (
    await request("/api/data/subscriptions", { token: owner.token })
  ).data.items.find((s) => s.name === group.new_subscription.name);
  const payments = (
    await request("/api/data/payment_records", { token: owner.token })
  ).data.items.filter((p) => p.subscription_id === sub.id);
  expect(payments).toHaveLength(1);
  expect(payments[0]).toMatchObject({
    due_date: date,
    paid_at: `${date}T00:00:00.000Z`,
    amount: 489.6,
    auto_paid: false,
  });
});

it("assigns the account's main payer on statement import, preserves assigned payers and fills legacy blanks", async () => {
  const createPerson = async (name, is_main) => {
    const response = await request("/api/data/household", {
      token: owner.token,
      method: "POST",
      body: { name, is_main },
    });
    expect(response.status).toBe(201);
    return response.data.id;
  };
  const mainPayer = await createPerson("Default statement payer", true);
  const anotherPayer = await createPerson("Another statement payer", false);
  const date = new Date().toISOString().slice(0, 10);
  const name = "Statement payer test";
  const statement = await request("/api/statements", {
    token: owner.token,
    method: "POST",
    body: {
      bank: "enpara",
      file_name: "payer.pdf",
      file_hash: require("node:crypto")
        .createHash("sha256")
        .update("statement-payer-test")
        .digest("hex"),
      period: date.slice(0, 7),
      page_count: 1,
      transactions: [
        {
          id: "payer-row",
          date,
          amount: 15,
          currency: "EUR",
          kind: "charge",
          page: 1,
          installment: "",
          merchant: name,
          subscription_service: name,
          subscription_match: "manual",
        },
      ],
    },
  });
  expect(statement.status).toBe(201);
  const endpoint = `/api/statements/${statement.data.id}/import`;
  const body = {
    utc_offset_minutes: 0,
    groups: [
      {
        transaction_ids: ["payer-row"],
        category: category.id,
        new_subscription: {
          name,
          cycle: cycle.id,
          frequency: 1,
          active: false,
        },
      },
    ],
  };
  const first = await request(endpoint, {
    token: owner.token,
    method: "POST",
    body,
  });
  expect(first.status).toBe(200);
  const imported = (
    await request("/api/data/subscriptions", { token: owner.token })
  ).data.items.find((sub) => sub.name === name);
  expect(imported.payer).toBe(mainPayer);
  expect(
    (
      await request(`/api/data/household/${anotherPayer}`, {
        token: owner.token,
        method: "PATCH",
        body: { is_main: true },
      })
    ).status,
  ).toBe(200);
  const repeated = await request(endpoint, {
    token: owner.token,
    method: "POST",
    body,
  });
  expect(repeated.status).toBe(200);
  expect(repeated.data).toMatchObject({
    payments_imported: 0,
    payments_skipped: 1,
  });
  expect(
    (
      await request(`/api/data/subscriptions/${imported.id}`, {
        token: owner.token,
      })
    ).data.payer,
  ).toBe(mainPayer);
  expect(
    (
      await request(`/api/data/subscriptions/${imported.id}`, {
        token: owner.token,
        method: "PATCH",
        body: { payer: "" },
      })
    ).status,
  ).toBe(200);
  expect(
    (await request(endpoint, { token: owner.token, method: "POST", body }))
      .status,
  ).toBe(200);
  expect(
    (
      await request(`/api/data/subscriptions/${imported.id}`, {
        token: owner.token,
      })
    ).data.payer,
  ).toBe(anotherPayer);
});

it.each([false, true])(
  "imports reviewed statement history independently of active status (%s)",
  async (active) => {
    const now = new Date();
    const dateAt = (offset) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
        .toISOString()
        .slice(0, 10);
    const name = `Statement history ${active}`;
    const statement = await request("/api/statements", {
      token: owner.token,
      method: "POST",
      body: {
        bank: "enpara",
        file_name: "history.pdf",
        file_hash: (active ? "d" : "b").repeat(64),
        period: dateAt(-3).slice(0, 7),
        page_count: 1,
        transactions: [
          {
            id: "history-row",
            date: dateAt(-3),
            amount: 15,
            currency: "EUR",
            kind: "charge",
            page: 1,
            installment: "",
            merchant: `NETFLIX.COM ${active}`,
            subscription_service: name,
            subscription_match: "manual",
          },
        ],
      },
    });
    expect(statement.status).toBe(201);
    const body = {
      utc_offset_minutes: 0,
      groups: [
        {
          transaction_ids: ["history-row"],
          category: category.id,
          new_subscription: { name, cycle: cycle.id, frequency: 1, active },
          historical_payments: {
            confirmed: true,
            utc_offset_minutes: 0,
            payments: [
              { due_date: dateAt(-2), amount: 17, paid_utc_offset_minutes: 0 },
              { due_date: dateAt(-1), amount: 22, paid_utc_offset_minutes: 0 },
            ],
          },
        },
      ],
    };
    const endpoint = `/api/statements/${statement.data.id}/import`;
    const result = await request(endpoint, {
      token: owner.token,
      method: "POST",
      body,
    });
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({
      subscriptions_created: 1,
      payments_imported: 3,
      payments_skipped: 0,
    });
    const imported = (
      await request("/api/data/subscriptions", { token: owner.token })
    ).data.items.find((sub) => sub.name === name);
    expect(imported.inactive).toBe(!active);
    expect(imported.auto_renew).toBe(active);
    expect(imported.start_date).toBe(dateAt(-3));
    expect(imported.next_payment).toBe(dateAt(1));
    body.groups[0].historical_payments.payments[0].amount = 999;
    const repeated = await request(endpoint, {
      token: owner.token,
      method: "POST",
      body,
    });
    expect(repeated.status).toBe(200);
    expect(repeated.data).toMatchObject({
      subscriptions_created: 0,
      payments_imported: 0,
      payments_skipped: 3,
    });
    const payments = (
      await request("/api/data/payment_records", { token: owner.token })
    ).data.items
      .filter((record) => record.subscription_id === imported.id)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    expect(payments.map((payment) => payment.amount)).toEqual([15, 17, 22]);
    expect(
      payments.every(
        (payment) => payment.paid_at && payment.auto_paid === false,
      ),
    ).toBe(true);
  },
);

it.each(["before", "future", "unconfirmed", "statement-date"])(
  "rolls back the whole statement import for invalid history (%s)",
  async (reason) => {
    const now = new Date();
    const dateAt = (offset) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
        .toISOString()
        .slice(0, 10);
    const name = `Invalid statement history ${reason}`;
    const hash = String(
      ["before", "future", "unconfirmed", "statement-date"].indexOf(reason) + 5,
    ).repeat(64);
    const statement = await request("/api/statements", {
      token: owner.token,
      method: "POST",
      body: {
        bank: "enpara",
        file_name: "invalid-history.pdf",
        file_hash: hash,
        period: dateAt(-3).slice(0, 7),
        page_count: 1,
        transactions: [
          {
            id: "invalid-row",
            date: dateAt(-3),
            amount: 10,
            currency: "EUR",
            kind: "charge",
            page: 1,
            installment: "",
            merchant: "NETFLIX.COM",
            subscription_service: name,
            subscription_match: "manual",
          },
        ],
      },
    });
    expect(statement.status).toBe(201);
    const result = await request(
      `/api/statements/${statement.data.id}/import`,
      {
        token: owner.token,
        method: "POST",
        body: {
          utc_offset_minutes: 0,
          groups: [
            {
              transaction_ids: ["invalid-row"],
              category: category.id,
              new_subscription: {
                name,
                cycle: cycle.id,
                frequency: 1,
                active: false,
              },
              historical_payments: {
                confirmed: reason !== "unconfirmed",
                utc_offset_minutes: 0,
                payments: [
                  {
                    due_date: dateAt(
                      reason === "before"
                        ? -4
                        : reason === "future"
                          ? 1
                          : reason === "statement-date"
                            ? -3
                            : -2,
                    ),
                    amount: 10,
                    paid_utc_offset_minutes: 0,
                  },
                ],
              },
            },
          ],
        },
      },
    );
    expect(result.status).toBe(400);
    expect(
      (
        await request("/api/data/subscriptions", { token: owner.token })
      ).data.items.some((sub) => sub.name === name),
    ).toBe(false);
  },
);

it.each([false, true])(
  "creates a subscription and confirmed history together, skips paid dates and protects ownership (multipart: %s)",
  async (multipart) => {
    const now = new Date();
    const dateAt = (monthOffset) =>
      new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1),
      )
        .toISOString()
        .slice(0, 10);
    const history = {
      confirmed: true,
      utc_offset_minutes: 0,
      payments: [-3, -2, -1].map((month, index) => ({
        due_date: dateAt(month),
        amount: [39.9, 49.9, 69.9][index],
        paid_utc_offset_minutes: 0,
      })),
    };
    const data = {
      name: "History backfill test",
      price: 69.9,
      cycle: cycle.id,
      currency: currency.id,
      category: category.id,
      frequency: 1,
      start_date: dateAt(-3),
      next_payment: dateAt(1),
      historical_payments: history,
    };
    let body = data;
    if (multipart) {
      body = new FormData();
      for (const [key, value] of Object.entries(data))
        body.set(
          key,
          key === "historical_payments" ? JSON.stringify(value) : String(value),
        );
      body.set(
        "logo",
        new Blob(
          [
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=",
              "base64",
            ),
          ],
          { type: "image/png" },
        ),
        "logo.png",
      );
    }
    const created = await request("/api/data/subscriptions", {
      token: owner.token,
      method: "POST",
      body,
    });
    expect(created.status).toBe(201);
    const id = created.data.id;
    const records = async () =>
      (
        await request("/api/data/payment_records", { token: owner.token })
      ).data.items
        .filter((payment) => payment.subscription_id === id)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
    try {
      expect(
        (await records()).map((record) => ({
          date: record.due_date,
          amount: record.amount,
          paid: !!record.paid_at,
          auto: record.auto_paid,
        })),
      ).toEqual(
        history.payments.map((payment) => ({
          date: payment.due_date,
          amount: payment.amount,
          paid: true,
          auto: false,
        })),
      );
      expect(
        (
          await request(`/api/data/subscriptions/${id}`, {
            token: owner.token,
            method: "PATCH",
            body: {
              historical_payments: {
                ...history,
                payments: history.payments.map((payment) => ({
                  ...payment,
                  amount: 999,
                })),
              },
            },
          })
        ).status,
      ).toBe(200);
      expect((await records()).map((record) => record.amount)).toEqual([
        39.9, 49.9, 69.9,
      ]);
      const pending = await request("/api/data/payment_records", {
        token: owner.token,
        method: "POST",
        body: {
          subscription_id: id,
          due_date: dateAt(0),
          paid_at: "",
          amount: 0,
        },
      });
      expect(pending.status).toBe(201);
      expect(
        (
          await request(`/api/data/subscriptions/${id}`, {
            token: owner.token,
            method: "PATCH",
            body: {
              historical_payments: {
                ...history,
                payments: [
                  {
                    due_date: dateAt(0),
                    amount: 79.9,
                    paid_utc_offset_minutes: 0,
                  },
                ],
              },
            },
          })
        ).status,
      ).toBe(200);
      expect((await records()).at(-1)).toMatchObject({
        id: pending.data.id,
        amount: 79.9,
      });
      expect((await records()).at(-1).paid_at).toBeTruthy();
      expect(
        (
          await request(`/api/data/subscriptions/${id}`, {
            token: other.token,
            method: "PATCH",
            body: { historical_payments: history },
          })
        ).status,
      ).toBe(404);
      const rejected = await request(`/api/data/subscriptions/${id}`, {
        token: owner.token,
        method: "PATCH",
        body: {
          price: 200,
          historical_payments: {
            ...history,
            payments: [
              ...history.payments,
              { due_date: dateAt(1), amount: 10, paid_utc_offset_minutes: 0 },
            ],
          },
        },
      });
      expect(rejected.status).toBe(400);
      expect(
        (await request(`/api/data/subscriptions/${id}`, { token: owner.token }))
          .data.price,
      ).toBe(69.9);
      expect(await records()).toHaveLength(4);
    } finally {
      await request(`/api/data/subscriptions/${id}`, {
        token: owner.token,
        method: "DELETE",
      });
    }
  },
);
it("rolls back the subscription and all past payments if a later payment cannot be saved", async () => {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(path.join(directory, "monline.db"));
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1),
  )
    .toISOString()
    .slice(0, 10);
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  )
    .toISOString()
    .slice(0, 10);
  const counts = () => [
    db.prepare("SELECT count(*) AS n FROM subscriptions").get().n,
    db.prepare("SELECT count(*) AS n FROM payment_records").get().n,
  ];
  const before = counts();
  db.exec(
    "CREATE TRIGGER reject_backfill_test BEFORE INSERT ON payment_records WHEN NEW.amount = 12345.67 BEGIN SELECT RAISE(ABORT, 'test payment failure'); END",
  );
  try {
    const result = await request("/api/data/subscriptions", {
      token: owner.token,
      method: "POST",
      body: {
        name: "Atomic backfill test",
        price: 10,
        frequency: 1,
        currency: currency.id,
        category: category.id,
        cycle: cycle.id,
        start_date: start,
        next_payment: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
        )
          .toISOString()
          .slice(0, 10),
        historical_payments: {
          confirmed: true,
          utc_offset_minutes: 0,
          payments: [
            { due_date: start, amount: 10, paid_utc_offset_minutes: 0 },
            { due_date: next, amount: 12345.67, paid_utc_offset_minutes: 0 },
          ],
        },
      },
    });
    expect(result.status).toBe(500);
    expect(counts()).toEqual(before);
  } finally {
    db.exec("DROP TRIGGER reject_backfill_test");
    db.close();
  }
});
it.each([false, true])(
  "saves a single paid initial charge atomically, clamps month end and preserves zero (multipart: %s)",
  async (multipart) => {
    const data = {
      name: "Paid initial charge",
      price: multipart ? 0 : 123.45,
      frequency: 1,
      currency: currency.id,
      category: category.id,
      cycle: cycle.id,
      next_payment: "2026-01-31",
      auto_renew: true,
      initial_payment: {
        date: "2026-01-31",
        utc_offset_minutes: -180,
        paid_utc_offset_minutes: -180,
      },
    };
    let body = data;
    if (multipart) {
      body = new FormData();
      for (const [key, value] of Object.entries(data))
        body.set(
          key,
          key === "initial_payment" ? JSON.stringify(value) : String(value),
        );
    }
    const result = await request("/api/data/subscriptions", {
      token: owner.token,
      method: "POST",
      body,
    });
    expect(result.status).toBe(201);
    const id = result.data.id;
    try {
      expect(result.data).toMatchObject({
        start_date: "2026-01-31",
        next_payment: "2026-02-28",
      });
      const payments = (
        await request("/api/data/payment_records", { token: owner.token })
      ).data.items.filter((payment) => payment.subscription_id === id);
      expect(payments).toHaveLength(1);
      expect(payments[0]).toMatchObject({
        due_date: "2026-01-31",
        amount: data.price,
        paid_at: "2026-01-30T21:00:00.000Z",
        auto_paid: false,
      });
      const edit = await request(`/api/data/subscriptions/${id}`, {
        token: owner.token,
        method: "PATCH",
        body: { initial_payment: data.initial_payment },
      });
      expect(edit.status).toBe(400);
      const foreign = await request(`/api/data/subscriptions/${id}`, {
        token: other.token,
        method: "PATCH",
        body: { initial_payment: data.initial_payment },
      });
      expect([403, 404]).toContain(foreign.status);
    } finally {
      await request(`/api/data/subscriptions/${id}`, {
        token: owner.token,
        method: "DELETE",
      });
    }
  },
);

it("rejects future, impossible and mixed initial payments without creating a subscription", async () => {
  const before = (
    await request("/api/data/subscriptions", { token: owner.token })
  ).data.totalItems;
  for (const initial of [
    { date: "9999-01-01", utc_offset_minutes: 0, paid_utc_offset_minutes: 0 },
    { date: "2026-02-30", utc_offset_minutes: 0, paid_utc_offset_minutes: 0 },
    {
      date: "2026-01-31",
      utc_offset_minutes: 9999,
      paid_utc_offset_minutes: 0,
    },
    null,
  ]) {
    const result = await request("/api/data/subscriptions", {
      token: owner.token,
      method: "POST",
      body: {
        name: "Invalid initial charge",
        price: 15,
        frequency: 1,
        currency: currency.id,
        category: category.id,
        cycle: cycle.id,
        next_payment: "2026-01-31",
        initial_payment: initial,
      },
    });
    expect(result.status).toBe(400);
  }
  const mixed = await request("/api/data/subscriptions", {
    token: owner.token,
    method: "POST",
    body: {
      name: "Mixed initial charge",
      price: 15,
      frequency: 1,
      currency: currency.id,
      category: category.id,
      cycle: cycle.id,
      next_payment: "2026-01-31",
      initial_payment: {},
      historical_payments: {},
    },
  });
  expect(mixed.status).toBe(400);
  expect(
    (await request("/api/data/subscriptions", { token: owner.token })).data
      .totalItems,
  ).toBe(before);
});

it("rolls back a new subscription if its initial paid charge cannot be saved", async () => {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(path.join(directory, "monline.db"));
  const counts = () => [
    db.prepare("SELECT count(*) AS n FROM subscriptions").get().n,
    db.prepare("SELECT count(*) AS n FROM payment_records").get().n,
  ];
  const before = counts();
  db.exec(
    "CREATE TRIGGER reject_initial_test BEFORE INSERT ON payment_records WHEN NEW.amount = 12345.67 BEGIN SELECT RAISE(ABORT, 'test payment failure'); END",
  );
  try {
    const result = await request("/api/data/subscriptions", {
      token: owner.token,
      method: "POST",
      body: {
        name: "Atomic initial charge",
        price: 12345.67,
        frequency: 1,
        currency: currency.id,
        category: category.id,
        cycle: cycle.id,
        next_payment: "2026-01-31",
        initial_payment: {
          date: "2026-01-31",
          utc_offset_minutes: 0,
          paid_utc_offset_minutes: 0,
        },
      },
    });
    expect(result.status).toBe(500);
    expect(counts()).toEqual(before);
  } finally {
    db.exec("DROP TRIGGER reject_initial_test");
    db.close();
  }
});

it("keeps the monthly calendar data and iCal feed available", async () => {
  const monthly = await request("/api/calendar/data?year=2026&month=10", {
    token: owner.token,
  });
  expect(monthly.status).toBe(200);
  expect(monthly.data).toMatchObject({
    year: 2026,
    month: 10,
    events: expect.any(Array),
  });
  const feed = await fetch(base + "/api/calendar/ical", {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  expect(feed.status).toBe(200);
  expect(feed.headers.get("content-type")).toContain("text/calendar");
  expect(await feed.text()).toContain("BEGIN:VCALENDAR");
});
it.each(["payments"])(
  "confirms calendar clearing, protects other accounts and keeps income (%s)",
  async (scope) => {
    // Reset only this test account's calendar using the individual owned endpoints.
    for (const record of (
      await request("/api/data/payment_records", { token: other.token })
    ).data.items)
      await request(`/api/data/payment_records/${record.id}`, {
        token: other.token,
        method: "DELETE",
      });
    for (const sub of (
      await request("/api/data/subscriptions", { token: other.token })
    ).data.items)
      await request(`/api/data/subscriptions/${sub.id}`, {
        token: other.token,
        method: "DELETE",
      });
    const otherCurrency = (
      await request("/api/data/currencies", { token: other.token })
    ).data.items[0];
    const oneTime = (
      await request("/api/data/cycles", { token: other.token })
    ).data.items.find((item) => item.name === "One-Time");
    const dateAt = (offset) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    const otherCategory = (
      await request("/api/data/categories", { token: other.token })
    ).data.items[0];
    const makeSub = async (credit) => {
      const result = await request("/api/data/subscriptions", {
        token: other.token,
        method: "POST",
        body: {
          name: credit ? "Keep income" : `Clear expense ${Math.random()}`,
          price: 10,
          frequency: 1,
          currency: otherCurrency.id,
          category: otherCategory.id,
          cycle: cycle.id,
          next_payment: dateAt(1),
        },
      });
      expect(result.status).toBe(201);
      if (credit) {
        // Income can still exist in legacy backups, although subscription writes
        // now enforce expenses. Seed that legacy case only in this temporary DB.
        const db = new (require("node:sqlite").DatabaseSync)(
          path.join(directory, "monline.db"),
        );
        try {
          db.prepare(
            "UPDATE subscriptions SET record_type='credit',cycle=? WHERE id=?",
          ).run(oneTime.id, result.data.id);
        } finally {
          db.close();
        }
      }
      return result.data;
    };
    const expense = await makeSub(false);
    await makeSub(false);
    const credit = await makeSub(true);
    const records = [];
    for (const offset of [-1, 0, 1]) {
      const result = await request("/api/data/payment_records", {
        token: other.token,
        method: "POST",
        body: {
          subscription_id: expense.id,
          due_date: dateAt(offset),
          amount: 10,
          paid_at: offset < 0 ? `${dateAt(offset)}T00:00:00Z` : "",
        },
      });
      expect(result.status).toBe(201);
      records.push(result.data);
    }
    // A single historical deletion is also owner-scoped and leaves the subscription.
    expect(
      (
        await request(`/api/data/payment_records/${records[0].id}`, {
          token: owner.token,
          method: "DELETE",
        })
      ).status,
    ).toBe(404);
    const ownerSubs = (
      await request("/api/data/subscriptions", { token: owner.token })
    ).data.items
      .map((item) => item.id)
      .sort();
    const ownerPayments = (
      await request("/api/data/payment_records", { token: owner.token })
    ).data.items
      .map((item) => item.id)
      .sort();
    expect(
      (
        await request("/api/calendar/clear", {
          method: "POST",
          body: { confirmed: true, scope },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("/api/calendar/clear", {
          token: other.token,
          method: "POST",
          body: { scope },
        })
      ).status,
    ).toBe(400);
    expect(
      (await request("/api/data/payment_records", { token: other.token })).data
        .items,
    ).toHaveLength(3);
    const subscriptionsBefore = (
      await request("/api/data/subscriptions", { token: other.token })
    ).data.items;
    const legacyPayment = await request("/api/data/payment_records", {
      token: other.token,
      method: "POST",
      body: {
        subscription_id: credit.id,
        due_date: dateAt(0),
        amount: 5,
        paid_at: dateAt(0) + "T00:00:00Z",
      },
    });
    expect(legacyPayment.status).toBe(201);
    // A failed delete must roll back earlier deletions in the same clear request.
    const db = new (require("node:sqlite").DatabaseSync)(
      path.join(directory, "monline.db"),
    );
    try {
      db.exec(
        `CREATE TRIGGER reject_calendar_clear BEFORE DELETE ON payment_records WHEN OLD.due_date = '${dateAt(1)}' BEGIN SELECT RAISE(ABORT, 'test clear failure'); END`,
      );
      const failed = await request("/api/calendar/clear", {
        token: other.token,
        method: "POST",
        body: { confirmed: true, scope },
      });
      expect(failed.status).toBe(500);
      expect(
        (await request("/api/data/payment_records", { token: other.token }))
          .data.items,
      ).toHaveLength(4);
    } finally {
      db.exec("DROP TRIGGER reject_calendar_clear");
      db.close();
    }
    const cleared = await request("/api/calendar/clear", {
      token: other.token,
      method: "POST",
      body: {
        confirmed: true,
        scope,
        utc_offset_minutes: 0,
        user: owner.record.id,
      },
    });
    expect(cleared.status).toBe(200);
    expect(cleared.data).toEqual({
      subscriptions_deleted: 0,
      payments_deleted: 3,
    });
    const remainingSubs = (
      await request("/api/data/subscriptions", { token: other.token })
    ).data.items;
    expect(remainingSubs).toEqual(subscriptionsBefore);
    expect(remainingSubs.some((item) => item.id === credit.id)).toBe(true);
    expect(
      (await request("/api/data/payment_records", { token: other.token })).data
        .items,
    ).toEqual([legacyPayment.data]);
    expect(
      (
        await request("/api/data/subscriptions", { token: owner.token })
      ).data.items
        .map((item) => item.id)
        .sort(),
    ).toEqual(ownerSubs);
    expect(
      (
        await request("/api/data/payment_records", { token: owner.token })
      ).data.items
        .map((item) => item.id)
        .sort(),
    ).toEqual(ownerPayments);
  },
);

it("imports category and payment method selections, preserves omitted values, and rolls back foreign selections", async () => {
  const create = async (collection, token, name) => {
    const response = await request(`/api/data/${collection}`, {
      token,
      method: "POST",
      body: { name },
    });
    expect(response.status).toBe(201);
    return response.data.id;
  };
  const category = await create(
    "categories",
    owner.token,
    "Statement category",
  );
  const replacement = await create(
    "categories",
    owner.token,
    "Changed statement category",
  );
  const method = await create("payment_methods", owner.token, "Statement card");
  const foreignCategory = await create(
    "categories",
    other.token,
    "Private category",
  );
  const foreignMethod = await create(
    "payment_methods",
    other.token,
    "Private card",
  );
  const date = new Date().toISOString().slice(0, 10);
  const statement = await request("/api/statements", {
    token: owner.token,
    method: "POST",
    body: {
      bank: "enpara",
      file_name: "import-choices.pdf",
      file_hash: require("node:crypto")
        .createHash("sha256")
        .update("import-choices-test")
        .digest("hex"),
      period: date.slice(0, 7),
      page_count: 1,
      transactions: ["choices-1", "choices-2"].map((id) => ({
        id,
        date,
        amount: 15,
        currency: "EUR",
        kind: "charge",
        page: 1,
        installment: "",
        merchant: id,
        subscription_service: id,
        subscription_match: "manual",
      })),
    },
  });
  expect(statement.status).toBe(201);
  const endpoint = `/api/statements/${statement.data.id}/import`;
  const first = {
    transaction_ids: ["choices-1"],
    category,
    payment_method: method,
    new_subscription: {
      name: "Import choices",
      cycle: cycle.id,
      frequency: 1,
      active: false,
    },
  };
  const missingCategory = await request(endpoint, {
    token: owner.token,
    method: "POST",
    body: { utc_offset_minutes: 0, groups: [{ ...first, category: "" }] },
  });
  expect(missingCategory.status).toBe(400);
  expect(missingCategory.data.error).toBe("statement_import_category_required");
  const imported = await request(endpoint, {
    token: owner.token,
    method: "POST",
    body: { utc_offset_minutes: 0, groups: [first] },
  });
  expect(imported.status).toBe(200);
  expect(imported.data).toMatchObject({
    subscriptions_created: 1,
    payments_imported: 1,
  });
  const listSubs = async () =>
    (await request("/api/data/subscriptions", { token: owner.token })).data
      .items;
  const saved = (await listSubs()).find((sub) => sub.name === "Import choices");
  expect(saved).toMatchObject({
    category,
    payment_method: method,
    price: 15,
    inactive: true,
    auto_renew: false,
  });
  const existing = {
    transaction_ids: ["choices-1"],
    subscription_id: saved.id,
  };
  const submit = (groups) =>
    request(endpoint, {
      token: owner.token,
      method: "POST",
      body: { utc_offset_minutes: 0, groups },
    });
  expect((await submit([existing])).status).toBe(200);
  expect((await listSubs()).find((sub) => sub.id === saved.id)).toMatchObject({
    category,
    payment_method: method,
  });
  const readPayments = async () =>
    (await request("/api/data/payment_records", { token: owner.token })).data
      .items;
  const beforePayments = await readPayments();
  for (const invalid of [
    { category: foreignCategory },
    { payment_method: foreignMethod },
    { category: "missing-category" },
    { payment_method: 17 },
  ]) {
    // The first group changes an owned subscription; an invalid second group
    // must roll that change back together with every payment write.
    const rejected = await submit([
      { ...existing, category: replacement, payment_method: "" },
      {
        transaction_ids: ["choices-2"],
        new_subscription: {
          name: "Rejected choices",
          cycle: cycle.id,
          frequency: 1,
          active: false,
        },
        ...invalid,
      },
    ]);
    expect(rejected.status).toBe(400);
    const subscriptions = await listSubs();
    expect(subscriptions.find((sub) => sub.id === saved.id)).toMatchObject({
      category,
      payment_method: method,
    });
    expect(subscriptions.some((sub) => sub.name === "Rejected choices")).toBe(
      false,
    );
    expect(await readPayments()).toEqual(beforePayments);
  }
  const changed = await submit([
    { ...existing, category: replacement, payment_method: "" },
  ]);
  expect(changed.status).toBe(200);
  expect(changed.data).toMatchObject({
    subscriptions_created: 0,
    payments_imported: 0,
    payments_skipped: 1,
  });
  expect((await listSubs()).find((sub) => sub.id === saved.id)).toMatchObject({
    category: replacement,
    payment_method: "",
    price: 15,
    inactive: true,
  });
  expect((await submit([{ ...existing, category: "" }])).status).toBe(400);
  expect((await listSubs()).find((sub) => sub.id === saved.id).category).toBe(
    replacement,
  );
  expect(await readPayments()).toEqual(beforePayments);
});

it("preserves saved categories, payment methods and settings after restarting with the same data directory", async () => {
  const category = await request("/api/data/categories", {
    token: owner.token,
    method: "POST",
    body: { name: "Food", translation_key: "food" },
  });
  expect(category.status).toBe(201);
  const method = await request("/api/data/payment_methods", {
    token: owner.token,
    method: "POST",
    body: { name: "Other" },
  });
  expect(method.status).toBe(201);
  expect(
    (
      await request(`/api/data/users/${owner.record.id}`, {
        token: owner.token,
        method: "PATCH",
        body: { budget: 1234, language: "tr" },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request("/api/admin/settings", {
        token: owner.token,
        method: "PATCH",
        body: { max_users: 123 },
      })
    ).status,
  ).toBe(200);
  const snapshot = async () => {
    const get = async (url) => {
      const response = await request(url, { token: owner.token });
      expect(response.status).toBe(200);
      return response.data;
    };
    const profile = await get(`/api/data/users/${owner.record.id}`);
    return {
      categories: (await get("/api/data/categories?perPage=500")).items,
      methods: (await get("/api/data/payment_methods?perPage=500")).items,
      settings: await get("/api/admin/settings"),
      profile: Object.fromEntries(
        [
          "budget",
          "language",
          "main_currency",
          "color_theme",
          "dark_theme_mode",
          "payment_tracking",
        ].map((field) => [field, profile[field]]),
      ),
    };
  };
  const before = await snapshot();
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill();
  });
  await startServer(new URL(base).port);
  expect(await snapshot()).toEqual(before);
});

it("requires a second factor before issuing a session and consumes challenges once", async () => {
  const setup = (
    await request("/api/auth/totp/setup", {
      token: owner.token,
      method: "POST",
      body: {},
    })
  ).data;
  const code = require("../../src/domain/lib/pure/totp-core.js").generateTOTPAt(
    setup.secret,
    Date.now(),
  );
  const enabled = await request("/api/auth/totp/verify", {
    token: owner.token,
    method: "POST",
    body: { code, secret: setup.secret, backupCodes: setup.backupCodes },
  });
  expect(enabled.status).toBe(200);
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { identity: "owner@example.test", password },
  });
  expect(login.data.token).toBeUndefined();
  expect(login.data.challenge).toBeTruthy();
  const body = { challenge: login.data.challenge, code: setup.backupCodes[0] };
  const completed = await request("/api/auth/totp/login-verify", {
    method: "POST",
    body,
  });
  expect(completed.status).toBe(200);
  expect(completed.data.token).toBeTruthy();
  expect(completed.data.remember).toBe(false);
  expect(completed.headers.get("set-cookie")).not.toContain("Max-Age=");
  expect(completed.data.record.password).toBeUndefined();
  expect(completed.data.record.totp_secret).toBeUndefined();
  expect(
    (await request("/api/auth/totp/login-verify", { method: "POST", body }))
      .status,
  ).toBe(401);
  for (const remember of [true, false]) {
    const challenge = await request("/api/auth/login", {
      method: "POST",
      body: { identity: "owner@example.test", password, remember },
    });
    const verified = await request("/api/auth/totp/login-verify", {
      method: "POST",
      body: {
        challenge: challenge.data.challenge,
        code: setup.backupCodes[remember ? 1 : 2],
        remember: !remember,
      },
    });
    expect(verified.status).toBe(200);
    expect(verified.data.remember).toBe(remember);
    const cookies = verified.headers.getSetCookie();
    const sessionCookie = cookies.find((cookie) =>
      cookie.startsWith("monline_session="),
    );
    expect(sessionCookie.includes("Max-Age=")).toBe(remember);
    expect(cookies.some((cookie) => cookie.startsWith("monline_device="))).toBe(
      !remember,
    );
  }
});
