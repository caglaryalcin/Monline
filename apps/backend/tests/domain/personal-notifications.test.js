const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const { createAuth } = require("../../src/auth.cjs");
const { registerDataApi } = require("../../src/data-api.cjs");
const personal = require("../../src/personal-notifications.cjs");

it("shares administrator connections while isolating account switches, reminders and CSS through authenticated APIs", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-personal-api-"));
  const repository = new Repository(directory);
  let server;
  try {
    const user = (email) => {
      const record = new DataRecord(repository.findCollectionByNameOrId("users"));
      record.set("email", email); record.set("name", email); record.set("verified", true);
      record.setPassword("personal-regression-password");
      return repository.save(record);
    };
    const a = user("first@example.test"), b = user("second@example.test");
    require("../../src/server-config.cjs").save(repository, "server_notification_channels", {
      telegram_bot_token: "old-admin-token", telegram_chat_id: "old-admin-chat", reminders: [{ days: 3, hour: 8 }],
    });
    personal.recordFor(repository, a.id);
    expect(personal.output(repository, a.id).telegram_bot_token).toBeUndefined();
    expect(personal.output(repository, b.id).telegram_bot_token).toBeUndefined();
    const auth = createAuth(repository), app = express(), runtime = require("../../src/runtime.cjs");
    app.use(express.json()); app.use(auth.middleware); auth.register(app);
    runtime.configure(app, repository, auth);
    registerDataApi(app, repository, auth);
    require("../../src/personal-notifications-api.cjs").registerPersonalNotificationsApi(app, repository, auth);
    require("../../src/admin-server-config.cjs").registerServerConfigApi(app, repository, auth);
    require("../../src/domain/routes_notifications.js");
    require("../../src/domain/routes_admin.js");
    app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
    server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    const base = "http://127.0.0.1:" + server.address().port;
    const request = async (url, token, method = "GET", body, expected = 200) => {
      const response = await fetch(base + url, { method, headers: { "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = response.status === 204 ? null : await response.json();
      expect(response.status, JSON.stringify(data)).toBe(expected);
      return data;
    };
    const login = async (identity) => (await request("/api/auth/login", null, "POST", {
      identity, password: "personal-regression-password" })).token;
    let ta = await login("first@example.test");
    const tb = await login("second@example.test");
    await request("/api/admin/channels", ta, "PATCH", {
      telegram_bot_token: "shared-token", telegram_chat_id: "shared-chat",
      localized_templates: { en: { telegram: { payment: { title: "Shared title" } } } },
    });
    await request("/api/admin/smtp", ta, "POST", {
      enabled: true, host: "shared.smtp.example.test", port: 587, username: "shared",
      password: "shared-smtp-secret", tls: true, senderAddress: "sender@example.test",
    });
    await request("/api/notifications/channels", ta, "PATCH", {
      telegram_enabled: true, email_enabled: true, reminders: [{ days: 2, hour: 9 }],
    });
    await request("/api/notifications/channels", tb, "PATCH", {
      telegram_enabled: false, email_enabled: true, reminders: [{ days: 5, hour: 14 }],
    });
    const first = await request("/api/notifications/channels", ta);
    const second = await request("/api/notifications/channels", tb);
    expect(first.reminders).toEqual([{ days: 2, hour: 9 }]);
    expect(second.reminders).toEqual([{ days: 5, hour: 14 }]);
    expect(first.available_channels.telegram).toBe(true);
    expect(second.available_channels.telegram).toBe(true);
    expect(first.telegram_enabled).toBe(true);
    expect(second.telegram_enabled).toBe(false);
    for (const data of [first, second, await request("/api/notifications/preferences", tb)]) {
      expect(JSON.stringify(data)).not.toContain("shared-token");
      expect(JSON.stringify(data)).not.toContain("smtp-secret");
      expect(data).not.toHaveProperty("delivery_settings");
      expect(data).not.toHaveProperty("localized_templates");
    }
    await request("/api/admin/smtp", tb, "POST", { host: "evil.test" }, 403);
    await request("/api/admin/channels", tb, "PATCH", { telegram_bot_token: "evil" }, 403);
    await request("/api/admin/channels", tb, "GET", undefined, 403);
    await request("/api/notifications/test", tb, "POST", { provider: "telegram" }, 403);
    for (const body of [
      { telegram_bot_token: "intruder" }, { user: a.id },
      { localized_templates: {} }, { reminders: [{ days: -1, hour: 8 }] },
      { reminders: [{ days: 1, hour: 24 }] }, { reminders: [] },
    ]) await request("/api/notifications/channels", tb, "PATCH", body, 400);
    await request("/api/data/notifications_config/" + first.id, tb, "PATCH", { telegram_enabled: false }, 404);
    await request("/api/admin/channels", ta, "PATCH", { reminders: [{ days: 9, hour: 8 }] }, 400);
    const effective = require("../../src/server-config.cjs").effectiveNotificationConfig;
    expect(effective(repository, b.id).getString("telegram_bot_token")).toBe("shared-token");
    expect(effective(repository, b.id).getBool("telegram_enabled")).toBe(false);
    expect(effective(repository, b.id).get("reminders")).toEqual(second.reminders);
    const sent = [];
    vi.spyOn(repository, "newMailClient").mockImplementation((smtp) => ({
      send: async message => sent.push({ smtp, message }),
    }));
    await require("../../src/domain/lib/notifications.js").dispatchToAllProviders(
      repository, effective(repository, b.id), "Account reminder", "Private message", []);
    expect(sent.at(-1).smtp.host).toBe("shared.smtp.example.test");
    expect(sent.at(-1).message.to[0].address).toBe("second@example.test");
    const sharedConfig = require("../../src/server-config.cjs");
    const credentials = Object.fromEntries(sharedConfig.credentialFields.map(key => [key, "saved-" + key]));
    await request("/api/admin/channels", ta, "PATCH", credentials);
    await request("/api/admin/channels", tb, "PATCH", { enabled_channels: { telegram: false } }, 403);
    await request("/api/notifications/channels", tb, "PATCH", { enabled_channels: { telegram: false } }, 400);
    for (const enabled_channels of [{ unknown: true }, { email: false }, { telegram: "false" }, []])
      await request("/api/admin/channels", ta, "PATCH", { enabled_channels }, 400);
    for (const id of Object.keys(sharedConfig.channelFields).filter(id => id !== "email")) {
      await request("/api/notifications/channels", ta, "PATCH", { [id + "_enabled"]: true });
      const disabled = await request("/api/admin/channels", ta, "PATCH", { enabled_channels: { [id]: false } });
      expect(disabled.enabled_channels[id]).toBe(false);
      expect(disabled.available_channels[id]).toBe(false);
      expect(personal.output(repository, a.id)[id + "_enabled"]).toBe(true);
      expect(effective(repository, a.id).getBool(id + "_enabled")).toBe(false);
      expect(personal.output(repository, a.id).reminders).toEqual(first.reminders);
      expect(personal.output(repository, b.id).reminders).toEqual(second.reminders);
      const reopened = new Repository(directory);
      try {
        expect(sharedConfig.enabledChannels(reopened)[id]).toBe(false);
        for (const key of sharedConfig.channelFields[id])
          expect(sharedConfig.channels(reopened)[key]).toBe(credentials[key]);
      } finally { reopened.connection.close(); }
      await request("/api/admin/channels", ta, "PATCH", { enabled_channels: { [id]: true } });
      expect(effective(repository, a.id).getBool(id + "_enabled")).toBe(true);
      expect(effective(repository, b.id).getBool(id + "_enabled")).toBe(false);
    }
    const css = ".personal-css-probe { color: rgb(18, 52, 86); }";
    await request("/api/data/users/" + a.id, ta, "PATCH", { custom_css: css });
    expect((await request("/api/auth/refresh", ta, "POST")).record.custom_css).toBe(css);
    await request("/api/auth/logout", ta, "POST", undefined, 204);
    ta = await login("first@example.test");
    expect((await request("/api/auth/refresh", ta, "POST")).record.custom_css).toBe(css);
    expect((await request("/api/auth/refresh", tb, "POST")).record.custom_css).toBe("");
    const backups = require("../../src/domain/lib/account-backup.js");
    const backup = backups.exportAccount(repository, a.id);
    expect(backup.data.notifications_config[0]).not.toHaveProperty("delivery_settings");
    expect(JSON.stringify(backup.data.notifications_config)).not.toContain("shared-token");
    expect(JSON.stringify(backup.data.notifications_config)).not.toContain("second-token");
    const restored = user("restored@example.test");
    backups.importAccount(repository, restored.id, backup, true, { recoverHistory: false });
    expect(personal.output(repository, restored.id)).toMatchObject({
      email_enabled: true, telegram_enabled: true,
      reminders: [{ days: 2, hour: 9 }],
    });
    expect((await request("/api/notifications/channels", ta)).reminders).toEqual(first.reminders);
    expect((await request("/api/notifications/channels", tb)).reminders).toEqual(second.reminders);
    const reopened = new Repository(directory);
    try {
      expect(personal.output(reopened, a.id).reminders).toEqual(first.reminders);
      expect(personal.output(reopened, b.id).reminders).toEqual(second.reminders);
    } finally { reopened.connection.close(); }
  } finally {
    vi.restoreAllMocks();
    if (server) await new Promise((resolve) => server.close(resolve));
    repository.connection.close();
    const resolved = path.resolve(directory);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("monline-personal-api-"))
      throw new Error("Unexpected fixture directory");
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
