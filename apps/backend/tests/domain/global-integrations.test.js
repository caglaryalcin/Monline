const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const config = require("../../src/server-config.cjs");
const {
  registerServerConfigApi,
} = require("../../src/admin-server-config.cjs");
const { registerDataApi } = require("../../src/data-api.cjs");
const { registerOidc } = require("../../src/oidc.cjs");
const { UnauthorizedError } = require("../../src/errors.cjs");
const runtime = require("../../src/runtime.cjs");

const admin = "aaaaaaaaaaaaaaa",
  first = "bbbbbbbbbbbbbbb",
  second = "ccccccccccccccc";
let repository, directory, server, base, send;
function record(collection, values) {
  const item = new DataRecord(repository.findCollectionByNameOrId(collection));
  if (collection === "users") item.set("password", "fixture-password-hash");
  if (collection === "currencies") {
    item.set("name", values.code);
    item.set("symbol", values.code);
  }
  for (const [key, value] of Object.entries(values)) item.set(key, value);
  repository.save(item);
  return item;
}
async function request(endpoint, user = admin, method = "GET", body) {
  const response = await fetch(base + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "X-Test-User": user } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  };
}
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-global-"));
  repository = new Repository(directory);
  [admin, first, second].forEach((id, index) =>
    repository.connection
      .prepare("INSERT INTO users (id,email,created) VALUES (?,?,?)")
      .run(
        id,
        `account${index}@example.test`,
        `2026-01-0${index + 1} 00:00:00Z`,
      ),
  );
  const auth = {
    requireUser(req) {
      if (!req.user) throw new UnauthorizedError();
    },
    isAdmin: (user) => user?.id === admin,
  };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = req.get("X-Test-User")
      ? repository.findRecordById("users", req.get("X-Test-User"))
      : null;
    next();
  });
  runtime.configure(app, repository, auth);
  for (const name of [
    "routes_fixer.js",
    "routes_admin.js",
    "routes_api_keys.js",
  ]) {
    delete require.cache[require.resolve("../../src/domain/" + name)];
    require("../../src/domain/" + name);
  }
  registerServerConfigApi(app, repository, auth);
  registerDataApi(app, repository, auth);
  registerOidc(app, repository, auth);
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ error: error.message }),
  );
  send = vi.spyOn(runtime.httpClient, "send").mockResolvedValue({
    statusCode: 200,
    json: { success: true, rates: { EUR: 1, USD: 1.2, TRY: 50 } },
  });
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (server) await new Promise((resolve) => server.close(resolve));
  repository?.connection.close();
  const resolved = path.resolve(directory),
    prefix = path.resolve(os.tmpdir()) + path.sep + "monline-global-";
  if (!resolved.startsWith(prefix))
    throw new Error("Unexpected fixture directory");
  fs.rmSync(resolved, { recursive: true, force: true });
});

it("migrates the administrator's configuration once and serves it to existing and future accounts", async () => {
  record("notifications_config", {
    user: admin,
    telegram_bot_token: "admin-token",
    telegram_chat_id: "shared-chat",
    reminders: [{ days: 7, hour: 10 }],
  });
  record("notifications_config", {
    user: first,
    telegram_bot_token: "obsolete-personal-token",
    telegram_chat_id: "old-chat",
    telegram_enabled: true,
  });
  expect(config.channels(repository).telegram_bot_token).toBe("admin-token");
  expect(
    (
      await request("/api/admin/channels", admin, "PATCH", {
        telegram_bot_token: "new-token",
      })
    ).status,
  ).toBe(200);
  const late = record("users", {
    email: "later@example.test",
    created: "2026-02-01 00:00:00Z",
  });
  for (const user of [admin, first, second, late.id]) {
    const prefs = repository.findRecordsByFilter(
      "notifications_config",
      "user = {:user}",
      "",
      1,
      0,
      { user },
    )[0];
    const effective = config.effectiveNotificationConfig(
      repository,
      user,
      prefs,
    );
    expect(effective.getString("telegram_bot_token")).toBe("new-token");
    expect(effective.getString("telegram_chat_id")).toBe("shared-chat");
    expect(effective.getString("email_to")).toBe(
      repository.findRecordById("users", user).getString("email"),
    );
    expect(effective.getBool("telegram_enabled")).toBe(user === first);
    expect(effective.get("reminders")).toEqual([{ days: 7, hour: 10 }]);
  }
});

it("shares channel availability while isolating each user's switches and keeping secrets admin-only", async () => {
  expect((await request("/api/admin/channels", null)).status).toBe(401);
  for (const endpoint of [
    "/api/admin/channels",
    "/api/admin/exchange",
    "/api/admin/settings",
    "/api/admin/smtp",
    "/api/api-keys",
  ])
    expect((await request(endpoint, first)).status).toBe(403);
  expect(
    (
      await request("/api/admin/channels", first, "PATCH", {
        telegram_bot_token: "bad",
      })
    ).status,
  ).toBe(403);
  await request("/api/admin/channels", admin, "PATCH", {
    telegram_bot_token: "shared-token",
    telegram_chat_id: "shared-chat",
  });
  await request("/api/admin/smtp", admin, "POST", {
    enabled: true,
    host: "smtp.example.test",
    senderAddress: "sender@example.test",
  });
  for (const user of [first, second]) {
    const preferences = await request("/api/notifications/preferences", user);
    expect(preferences.data).toMatchObject({
      user,
      email_enabled: false,
      telegram_enabled: false,
      available_channels: { email: true, telegram: true },
    });
    expect(JSON.stringify(preferences.data)).not.toContain("shared-token");
  }
  const saved = await request("/api/data/notifications_config", first, "POST", {
    user: second,
    email_enabled: true,
  });
  expect(saved.status).toBe(201);
  expect(saved.data.user).toBe(first);
  expect(
    (await request("/api/data/notifications_config/" + saved.data.id, second))
      .status,
  ).toBe(404);
  expect(
    (
      await request(
        "/api/data/notifications_config/" + saved.data.id,
        admin,
        "PATCH",
        { email_enabled: false },
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await request(
        "/api/data/notifications_config/" + saved.data.id,
        first,
        "PATCH",
        { email_to: "other@example.test" },
      )
    ).status,
  ).toBe(403);
  const secondConfig = await request(
    "/api/data/notifications_config",
    second,
    "POST",
    { telegram_enabled: true },
  );
  expect(secondConfig.status).toBe(201);
  expect(
    (await request("/api/notifications/preferences", first)).data,
  ).toMatchObject({ email_enabled: true, telegram_enabled: false });
  expect(
    (await request("/api/notifications/preferences", second)).data,
  ).toMatchObject({ email_enabled: false, telegram_enabled: true });
  expect(send).not.toHaveBeenCalled();
});

it("uses one exchange key for every user's own currencies and a single fetch for the global update", async () => {
  record("currencies", {
    id: "eeeeeeeeeeeeeee",
    user: first,
    code: "EUR",
    is_main: true,
    rate: 1,
  });
  record("currencies", {
    id: "fffffffffffffff",
    user: first,
    code: "TRY",
    rate: 7,
  });
  record("currencies", {
    id: "ggggggggggggggg",
    user: second,
    code: "USD",
    is_main: true,
    rate: 1,
  });
  record("currencies", {
    id: "hhhhhhhhhhhhhhh",
    user: second,
    code: "TRY",
    rate: 8,
  });
  expect(
    (
      await request("/api/admin/exchange", admin, "PATCH", {
        api_key: "shared-key",
        provider: "fixer",
        enabled: true,
      })
    ).data.api_key,
  ).toBeUndefined();
  expect((await request("/api/exchange/status", first)).data).toEqual({
    enabled: true,
    api_key_configured: true,
  });
  expect(
    (await request("/api/fixer/update", first, "POST", { userId: second }))
      .status,
  ).toBe(200);
  expect(
    repository.findRecordById("currencies", "fffffffffffffff").getFloat("rate"),
  ).toBe(50);
  expect(
    repository.findRecordById("currencies", "hhhhhhhhhhhhhhh").getFloat("rate"),
  ).toBe(8);
  expect(
    (
      await request("/api/fixer/update", first, "POST", {
        currencyId: "hhhhhhhhhhhhhhh",
      })
    ).status,
  ).toBe(404);
  expect((await request("/api/fixer/update", second, "POST", {})).data).toEqual(
    { updated: 2, base: "USD" },
  );
  expect(
    repository.findRecordById("currencies", "hhhhhhhhhhhhhhh").getFloat("rate"),
  ).toBeCloseTo(50 / 1.2);
  send.mockClear();
  expect(
    (await request("/api/admin/exchange/update", admin, "POST", {})).data
      .updated,
  ).toBe(4);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.lastCall[0].url).toContain("access_key=shared-key");
  expect(
    (await request("/api/admin/exchange/update", first, "POST", {})).status,
  ).toBe(403);
});

it("saves independent language templates and retains them when the database reopens", async () => {
  const save = async (localized_templates) =>
    request("/api/admin/channels", admin, "PATCH", { localized_templates });
  expect(
    (
      await save({
        tr: {
          email: {
            payment: { title: "Türkçe ödeme" },
            cancellation: { title: "Türkçe iptal" },
          },
        },
      })
    ).status,
  ).toBe(200);
  expect(
    (await save({ en: { email: { payment: { title: "English payment" } } } }))
      .status,
  ).toBe(200);
  expect((await save({ tr: { email: { payment: {} } } })).status).toBe(200);
  const reopened = new Repository(directory);
  try {
    const templates = config.channels(reopened).localized_templates;
    expect(templates.tr.email.payment).toEqual({});
    expect(templates.tr.email.cancellation.title).toBe("Türkçe iptal");
    expect(templates.en.email.payment.title).toBe("English payment");
  } finally {
    reopened.connection.close();
  }
});

it("previews in the administrator's saved language without sending a notification", async () => {
  const user = repository.findRecordById("users", admin);
  user.set("language", "tr");
  user.set("password", "fixture-password-hash");
  repository.save(user);
  const body = {
    provider: "email",
    event: "payment",
    localized_templates: {
      tr: { email: { payment: { title: "Türkçe {{user_name}}" } } },
      en: { email: { payment: { title: "English" } } },
    },
  };
  const result = await request(
    "/api/admin/channels/template-preview",
    admin,
    "POST",
    body,
  );
  expect(result.status).toBe(200);
  expect(result.data.title).toContain("Türkçe");
  expect(result.data.message).toContain("Örnek abonelik");
  expect(send).not.toHaveBeenCalled();
  expect(
    (await request("/api/admin/channels/template-preview", first, "POST", body))
      .status,
  ).toBe(403);
  expect(
    (await request("/api/admin/channels/template-preview", null, "POST", body))
      .status,
  ).toBe(401);
  expect(
    (
      await request("/api/admin/channels", first, "PATCH", {
        localized_templates: body.localized_templates,
      })
    ).status,
  ).toBe(403);
});

it("exposes each recipient's saved language through their effective channel configuration", () => {
  for (const [id, language] of [
    [first, "tr"],
    [second, "de"],
  ]) {
    const user = repository.findRecordById("users", id);
    user.set("language", language);
    user.set("password", "fixture-password-hash");
    repository.save(user);
    expect(
      config.effectiveNotificationConfig(repository, id).getString("language"),
    ).toBe(language);
  }
});

it("applies the shared OIDC configuration to every login and restricts changes to admin", async () => {
  const oidc = {
    oidc_enabled: true,
    oidc_provider_name: "Company",
    oidc_client_id: "client",
    oidc_client_secret: "private-secret",
    oidc_issuer_url: "https://login.example.test",
    oidc_redirect_url: "https://monline.example.test/api/auth/oidc/callback",
  };
  expect(
    (await request("/api/admin/settings", first, "PATCH", oidc)).status,
  ).toBe(403);
  expect(
    (await request("/api/admin/settings", admin, "PATCH", oidc)).status,
  ).toBe(200);
  for (const user of [null, admin, first, second]) {
    const response = await request("/api/auth/oidc/config", user);
    expect(response.data).toEqual({ enabled: true, provider_name: "Company" });
  }
});
