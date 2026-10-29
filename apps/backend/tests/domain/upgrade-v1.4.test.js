const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const tar = require("tar");
const bcrypt = require("bcryptjs");
const { Repository } = require("../../src/storage.cjs");
const { createAuth } = require("../../src/auth.cjs");
const config = require("../../src/server-config.cjs");
const { registerBackupApi } = require("../../src/backups.cjs");
const { registerDataApi } = require("../../src/data-api.cjs");
const {
  registerServerConfigApi,
} = require("../../src/admin-server-config.cjs");
const { registerOidc } = require("../../src/oidc.cjs");
const runtime = require("../../src/runtime.cjs");

const id = (number) => String(number).padStart(15, "0");
const token = "legacy-session-from-before-the-upgrade";
const password = "Upgrade-fixture-password-2026";
let directory, repository, server, before;

function legacyDatabase() {
  const source = path.join(directory, "legacy");
  fs.mkdirSync(source);
  const db = new DatabaseSync(path.join(source, "monline.db"));
  db.exec(
    fs.readFileSync(
      path.join(__dirname, "../fixtures/v1.3.0-schema.sql"),
      "utf8",
    ),
  );
  const insert = (table, values) => {
    const keys = Object.keys(values);
    db.prepare(
      `INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    ).run(...keys.map((key) => values[key]));
  };
  insert("cycles", { id: id(50), name: "Monthly" });
  for (let index = 0; index < 3; index++) {
    const user = id(index + 1);
    insert("users", {
      id: user,
      name: ["Alice", "Bob", "Carol"][index],
      email: `account${index}@example.test`,
      password: bcrypt.hashSync(password, 4),
      created: `2026-01-0${index + 1}`,
      main_currency: id(100 + index),
      language: "en",
    });
    insert("currencies", {
      id: id(100 + index),
      user,
      code: ["TRY", "EUR", "USD"][index],
      symbol: ["₺", "€", "$"][index],
      name: "Main currency",
      rate: 1,
      is_main: 1,
    });
    insert("categories", {
      id: id(200 + index),
      user,
      name: "Video",
      translation_key: "video",
    });
    insert("payment_methods", {
      id: id(300 + index),
      user,
      name: "Visa",
      is_main: 1,
    });
    // Keep one renamed payer and one account with no People record at all.
    if (index < 2)
      insert("household", {
        id: id(400 + index),
        user,
        name: index === 0 ? "Me" : "My custom payer",
        is_main: 1,
      });
    insert("subscriptions", {
      id: id(500 + index),
      user,
      name: `Subscription ${index}`,
      price: 100 + index,
      currency: id(100 + index),
      category: id(200 + index),
      cycle: id(50),
      payment_method: id(300 + index),
      payer: index < 2 ? id(400 + index) : "",
      frequency: 1,
      next_payment: "2099-11-10",
      start_date: "2026-10-10",
      billing_anchor_day: 10,
      calendar_history_recovery_passes: 2,
      auto_renew: 1,
      notes: "Private existing note",
    });
    insert("payment_records", {
      id: id(600 + index),
      user,
      subscription_id: id(500 + index),
      due_date: "2026-10-10",
      paid_at: "2026-10-10T12:00:00Z",
      amount: 100 + index,
      payer: index < 2 ? id(400 + index) : "",
    });
    insert("bank_statements", {
      id: id(700 + index),
      user,
      bank: "enpara",
      file_name: "statement.pdf",
      file_hash: String(index).repeat(64),
      period: "2026-10",
      page_count: 1,
      transactions: JSON.stringify([
        {
          id: "row1",
          date: "2026-10-10",
          merchant: `Subscription ${index}`,
          amount: 100 + index,
          currency: ["TRY", "EUR", "USD"][index],
          kind: "charge",
          page: 1,
          installment: "",
        },
      ]),
      created: "2026-10-10",
    });
    insert("notifications_config", {
      id: id(800 + index),
      user,
      email_enabled: index !== 1 ? 1 : 0,
      telegram_enabled: index === 1 ? 1 : 0,
      email_to: `legacy-target${index}@example.test`,
      telegram_bot_token: `legacy-bot-${index}`,
      telegram_chat_id: `legacy-chat-${index}`,
      reminders: JSON.stringify([{ days: 5, hour: 9 }]),
    });
    insert("fixer_settings", {
      id: id(900 + index),
      user,
      api_key: `legacy-exchange-${index}`,
      provider: "apilayer",
      enabled: 1,
    });
    insert("api_keys", {
      id: id(1000 + index),
      user,
      name: "Existing integration",
      key_hash: `existing-key-hash-${index}`,
      permissions: JSON.stringify(["subscriptions:read"]),
    });
  }
  insert("admin_settings", {
    id: id(1100),
    server_url: "https://monline.example.test",
    open_registrations: 1,
    oidc_enabled: 1,
    oidc_provider_name: "Existing SSO",
    oidc_client_id: "existing-client",
    oidc_client_secret: "existing-secret",
    oidc_issuer_url: "https://login.example.test",
    oidc_redirect_url: "https://monline.example.test/api/auth/oidc/callback",
  });
  insert("monline_meta", {
    key: "settings",
    value: JSON.stringify({
      smtp: {
        enabled: true,
        host: "smtp.example.test",
        port: 587,
        username: "smtp-user",
        password: "smtp-password",
        tls: true,
      },
      meta: { senderAddress: "sender@example.test", senderName: "Monline" },
    }),
  });
  insert("monline_sessions", {
    hash: crypto.createHash("sha256").update(token).digest("hex"),
    user_id: id(2),
    expires: Date.now() + 86_400_000,
    purpose: "session",
    remember: 1,
  });
  before = Object.fromEntries(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map(({ name }) => [
        name,
        db
          .prepare(`SELECT * FROM "${name}" ORDER BY 1`)
          .all()
          .map((row) => ({ ...row })),
      ]),
  );
  db.close();
  return source;
}
function assertUpgraded(target) {
  expect(
    target.connection.prepare("PRAGMA integrity_check").get().integrity_check,
  ).toBe("ok");
  expect(target.connection.prepare("PRAGMA foreign_key_check").all()).toEqual(
    [],
  );
  for (const name of [
    "users",
    "currencies",
    "categories",
    "payment_methods",
    "subscriptions",
    "payment_records",
    "bank_statements",
    "notifications_config",
    "fixer_settings",
    "api_keys",
    "admin_settings",
  ]) {
    const fields = Object.keys(before[name][0]);
    const rows = target.connection
      .prepare(
        `SELECT ${fields.map((field) => `"${field}"`).join(",")} FROM "${name}" ORDER BY 1`,
      )
      .all()
      .map((row) => ({ ...row }));
    expect(rows, `${name} existing data`).toEqual(before[name]);
  }
  const self = target.findRecordsByFilter(
    "household",
    "user = {:user} && account = {:user}",
    "",
    0,
    0,
    { user: id(1) },
  );
  expect(self.map((person) => person.id)).toEqual([id(400)]);
  expect(self[0].getString("name")).toBe("Alice");
  expect(target.findRecordById("household", id(401)).getString("name")).toBe(
    "My custom payer",
  );
  for (let index = 0; index < 3; index++) {
    const owner = id(index + 1);
    const people = target.findRecordsByFilter(
      "household",
      "user = {:owner}",
      "",
      0,
      0,
      { owner },
    );
    const own = people.filter(
      (person) => person.getString("account") === owner,
    );
    expect(own).toHaveLength(1);
    expect(
      require("../../src/people-invitations.cjs").isPersonConfirmed(
        target,
        own[0],
      ),
    ).toBe(true);
    expect(people.filter((person) => person.getBool("is_main"))).toHaveLength(
      1,
    );
    expect(
      target.findRecordById("subscriptions", id(500 + index)).get("sharing"),
    ).toBeNull();
  }
  expect(target.countRecords("sharing_groups")).toBe(0);
  expect(config.channels(target)).toMatchObject({
    telegram_bot_token: "legacy-bot-0",
    telegram_chat_id: "legacy-chat-0",
    reminders: [{ days: 5, hour: 9 }],
  });
  expect(config.exchange(target)).toEqual({
    api_key: "legacy-exchange-0",
    provider: "apilayer",
    enabled: true,
  });
  expect(target.settings().smtp.password).toBe("smtp-password");
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-v130-upgrade-"));
});
afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = undefined;
  repository?.connection.close();
  repository = undefined;
  const resolved = path.resolve(directory);
  if (
    !resolved.startsWith(
      path.resolve(os.tmpdir()) + path.sep + "monline-v130-upgrade-",
    )
  )
    throw new Error("Unexpected upgrade fixture directory");
  fs.rmSync(resolved, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
});

it("upgrades the released v1.3.0 schema without losing account data and is idempotent across restarts", async () => {
  const source = legacyDatabase();
  repository = new Repository(source);
  assertUpgraded(repository);
  const auth = createAuth(repository);
  expect(auth.resolve(token)).toBe(id(2));
  expect(auth.isAdmin(repository.findRecordById("users", id(1)))).toBe(true);
  expect(auth.isAdmin(repository.findRecordById("users", id(2)))).toBe(false);
  expect(
    await auth.passwordValid(
      password,
      repository.findRecordById("users", id(1)).getString("password"),
    ),
  ).toBe(true);
  const people = repository.connection
    .prepare("SELECT * FROM household ORDER BY id")
    .all();
  repository.connection.close();
  repository = new Repository(source);
  assertUpgraded(repository);
  expect(
    repository.connection.prepare("SELECT * FROM household ORDER BY id").all(),
  ).toEqual(people);
  expect(createAuth(repository).resolve(token)).toBe(id(2));
});

it("restores a genuine v1.3.0 full backup into v1.4.0 and migrates settings and attachments", async () => {
  const source = legacyDatabase();
  const snapshot = path.join(directory, "snapshot");
  const files = path.join(snapshot, "storage", "subscriptions", id(500));
  fs.mkdirSync(files, { recursive: true });
  fs.writeFileSync(path.join(files, "preserved.txt"), "Original attachment");
  fs.copyFileSync(
    path.join(source, "monline.db"),
    path.join(snapshot, "monline.db"),
  );
  fs.writeFileSync(
    path.join(snapshot, "manifest.json"),
    JSON.stringify({ format: "monline-instance-backup", version: 1 }),
  );
  const archive = path.join(directory, "v1.3.0.tar.gz");
  await tar.create({ cwd: snapshot, file: archive, gzip: true }, [
    "manifest.json",
    "monline.db",
    "storage",
  ]);
  repository = new Repository(path.join(directory, "new-install"));
  const app = express();
  app.use(express.json());
  registerBackupApi(app, repository, { isAdmin: () => false });
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ message: error.message }),
  );
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const body = new FormData();
  body.set("file", new Blob([fs.readFileSync(archive)]), "v1.3.0.tar.gz");
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/auth/setup/restore`,
    { method: "POST", body },
  );
  expect(response.status, JSON.stringify(await response.json())).toBe(200);
  assertUpgraded(repository);
  expect(
    repository.connection.prepare("SELECT * FROM monline_sessions").all(),
  ).toEqual([]);
  expect(
    fs.readFileSync(
      path.join(
        repository.directory,
        "storage",
        "subscriptions",
        id(500),
        "preserved.txt",
      ),
      "utf8",
    ),
  ).toBe("Original attachment");
});

it("keeps each upgraded user's data private, preserves toggles and hides global credentials", async () => {
  repository = new Repository(legacyDatabase());
  assertUpgraded(repository);
  const auth = createAuth(repository);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const account = req.get("X-Test-User");
    req.user = account ? repository.findRecordById("users", account) : null;
    next();
  });
  runtime.configure(app, repository, auth);
  registerDataApi(app, repository, auth);
  registerServerConfigApi(app, repository, auth);
  registerOidc(app, repository, auth);
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ message: error.message }),
  );
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const get = async (endpoint, user) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}${endpoint}`,
      { headers: { "X-Test-User": user } },
    );
    return { status: response.status, data: await response.json() };
  };
  for (let index = 0; index < 3; index++) {
    const user = id(index + 1);
    for (const collection of [
      "subscriptions",
      "payment_records",
      "bank_statements",
    ]) {
      const response = await get(`/api/data/${collection}`, user);
      expect(response.status).toBe(200);
      expect(response.data.items).toHaveLength(1);
      expect(response.data.items[0].user).toBe(user);
    }
    const notification = await get(
      `/api/data/notifications_config/${id(800 + index)}`,
      user,
    );
    expect(notification.status).toBe(200);
    expect(notification.data.email_enabled).toBe(index !== 1);
    expect(notification.data.telegram_enabled).toBe(index === 1);
    if (index > 0) {
      expect(JSON.stringify(notification.data)).not.toContain("legacy-bot");
      expect((await get("/api/admin/channels", user)).status).toBe(403);
      expect(
        (await get(`/api/data/subscriptions/${id(500)}`, user)).status,
      ).toBe(404);
    }
  }
  expect(
    (await get("/api/admin/channels", id(1))).data.telegram_bot_token,
  ).toBe("legacy-bot-0");
  expect((await get("/api/auth/oidc/config", id(2))).data).toEqual({
    enabled: true,
    provider_name: "Existing SSO",
  });
});

it("accepts legacy personal backup settings without replacing global integrations or restoring sharing grants", () => {
  repository = new Repository(legacyDatabase());
  const app = express();
  runtime.configure(app, repository, createAuth(repository));
  const {
    exportAccount,
    importAccount,
  } = require("../../src/domain/lib/account-backup.js");
  const backup = exportAccount(repository, id(2));
  // v1.3.0 included these optional delivery fields and fixer settings in JSON exports.
  Object.assign(backup.data.notifications_config[0], {
    email_to: "old-target@example.test",
    telegram_chat_id: "old-personal-chat",
    gotify_url: "https://old.example.test",
    reminders: [{ days: 9, hour: 1 }],
  });
  backup.data.fixer_settings = [
    { id: id(901), provider: "fixer", base_currency: "EUR", enabled: true },
  ];
  backup.data.household = backup.data.household.filter(
    (person) => person.id === id(401),
  );
  const globalChannels = JSON.stringify(config.channels(repository));
  const globalExchange = JSON.stringify(config.exchange(repository));
  repository.connection
    .prepare(
      "INSERT INTO users (id,email,name,created,password) VALUES (?,?,?,?,?)",
    )
    .run(
      id(4),
      "import@example.test",
      "Import account",
      "2027-01-01",
      bcrypt.hashSync(password, 4),
    );
  repository.repairSelfHousehold();
  const result = importAccount(repository, id(4), backup, true, {
    recoverHistory: false,
  });
  expect(result.imported).toBeGreaterThan(0);
  expect(JSON.stringify(config.channels(repository))).toBe(globalChannels);
  expect(JSON.stringify(config.exchange(repository))).toBe(globalExchange);
  const [subscription] = repository.findRecordsByFilter(
    "subscriptions",
    "user = {:owner}",
    "",
    0,
    0,
    { owner: id(4) },
  );
  expect(subscription.getString("name")).toBe("Subscription 1");
  expect(subscription.get("sharing")).toBeNull();
  const [notification] = repository.findRecordsByFilter(
    "notifications_config",
    "user = {:owner}",
    "",
    0,
    0,
    { owner: id(4) },
  );
  expect(notification.getBool("telegram_enabled")).toBe(true);
  expect(notification.getString("telegram_chat_id")).toBe("");
  expect(repository.countRecords("sharing_groups")).toBe(0);
  const person = repository.findRecordById(
    "household",
    subscription.getString("payer"),
  );
  expect(person.getString("user")).toBe(id(4));
  expect(person.get("account_approval")).toBeNull();
});
