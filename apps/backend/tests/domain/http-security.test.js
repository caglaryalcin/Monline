const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const { gzipSync } = require("node:zlib");
const { DatabaseSync } = require("node:sqlite");
const { Header } = require("tar");
const escapeHtml = require("escape-html");

let child, directory, base, owner;
const password = "Security-test-only-password-2026";
async function request(
  endpoint,
  { method = "GET", body, token = owner?.token } = {},
) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  return fetch(base + endpoint, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
}
beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-security-"));
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
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
      TRUST_PROXY: "0",
      MONLINE_PORT: String(port),
      MONLINE_HOST: "127.0.0.1",
      MONLINE_DATA_DIR: directory,
      MONLINE_LEGACY_DATA_DIR: path.join(directory, "absent"),
    },
  });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Security test server failed");
    try {
      if ((await request("/api/health", { token: null })).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const setup = await request("/api/auth/setup", {
    method: "POST",
    body: {
      email: "security@example.test",
      username: "Security test",
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
  owner = await setup.json();
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
      .startsWith(path.resolve(os.tmpdir()) + path.sep + "monline-security-")
  )
    fs.rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
});

it("rejects oversized profile email input and malformed filters", async () => {
  const invalidEmail = await request(`/api/data/users/${owner.record.id}`, {
    method: "PATCH",
    body: { email: "!@!." + "!.".repeat(50_000) },
  });
  expect(invalidEmail.status).toBe(400);
  for (const filter of ['name = "' + '\\\\"'.repeat(1000), "x".repeat(9000)]) {
    const response = await request(
      "/api/data/subscriptions?filter=" + encodeURIComponent(filter),
    );
    expect(response.status).toBe(400);
  }
});

it("HTML-encodes even an adversarial reset token that passes session validation", async () => {
  const token = "\"><script>alert(1)</script>&'";
  const db = new DatabaseSync(path.join(directory, "monline.db"));
  try {
    db.prepare(
      "INSERT INTO monline_sessions(hash,user_id,expires,purpose,remember) VALUES(?,?,?,?,?)",
    ).run(
      crypto.createHash("sha256").update(token).digest("hex"),
      owner.record.id,
      Date.now() + 60000,
      "reset",
      0,
    );
  } finally {
    db.close();
  }
  const response = await request(
    "/api/auth/reset?token=" + encodeURIComponent(token),
    { token: null },
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-security-policy")).toContain(
    "default-src 'none'",
  );
  const html = await response.text();
  expect(html).toContain(`value="${escapeHtml(token)}"`);
  expect(html).not.toContain("<script>");
});

it("rejects traversal and symlink archive entries without touching existing data", async () => {
  for (const [name, type] of [
    ["../escape", "File"],
    ["storage/link", "SymbolicLink"],
  ]) {
    const header = new Header({
      path: name,
      mode: 0o600,
      size: 0,
      type,
      linkpath: type === "SymbolicLink" ? "../../escape" : "",
    });
    header.encode();
    const archive = gzipSync(Buffer.concat([header.block, Buffer.alloc(1024)]));
    const body = new FormData();
    body.set("file", new Blob([archive]), "../../hostile.tar.gz");
    expect(
      (await request("/api/db/restore", { method: "POST", body })).status,
    ).toBe(400);
    expect(fs.existsSync(path.join(directory, "escape"))).toBe(false);
    expect((await request(`/api/data/users/${owner.record.id}`)).status).toBe(
      200,
    );
  }
  expect(
    fs
      .readdirSync(path.join(directory, "backups"))
      .filter((name) => name.startsWith("work-")),
  ).toEqual([]);
});

it("backs up and restores a valid archive using only server-owned upload paths", async () => {
  const backup = await request("/api/db/backup");
  expect(backup.status).toBe(200);
  const archive = await backup.arrayBuffer();
  const body = new FormData();
  body.set("file", new Blob([archive]), "../../client-controlled.tar.gz");
  const response = await request("/api/db/restore", { method: "POST", body });
  expect(response.status).toBe(200);
  expect((await request(`/api/data/users/${owner.record.id}`)).status).toBe(
    401,
  );
  const login = await request("/api/auth/login", {
    method: "POST",
    token: null,
    body: { identity: "security@example.test", password },
  });
  expect(login.status).toBe(200);
  owner = await login.json();
  expect(owner.record.email).toBe("security@example.test");
  expect(
    fs
      .readdirSync(path.join(directory, "backups"))
      .filter((name) => name.startsWith("work-")),
  ).toEqual([]);
});

it("limits expensive restore attempts and keeps authentication throttling", async () => {
  const statuses = [];
  for (let i = 0; i < 11; i++)
    statuses.push(
      (await request("/api/db/restore", { method: "POST", body: {} })).status,
    );
  expect(statuses).toContain(429);
  let last;
  for (let i = 0; i < 101; i++)
    last = await request("/api/auth/file-token", {
      method: "POST",
      token: null,
      body: {},
    });
  expect(last.status).toBe(429);
});

it("rate-limits file and page traffic while keeping health checks available", async () => {
  let last;
  for (let i = 0; i < 601; i++) {
    last = await request("/security-preview", { token: null });
    await last.arrayBuffer();
  }
  expect(last.status).toBe(429);
  expect(last.headers.get("retry-after")).toBeTruthy();
  expect((await request("/api/health", { token: null })).status).toBe(200);
});
