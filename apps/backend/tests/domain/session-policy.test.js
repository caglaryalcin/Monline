const { DatabaseSync } = require("node:sqlite");
const { createAuth, hash } = require("../../src/auth.cjs");

const DAY = 86400000;
let db, auth, repository;
const user = {
  id: "user-1",
  publicExport: () => ({ id: "user-1" }),
  getBool: () => false,
};
beforeEach(() => {
  vi.useFakeTimers();
  db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE monline_sessions (hash TEXT PRIMARY KEY,user_id TEXT,expires INTEGER,purpose TEXT,remember INTEGER DEFAULT 0)",
  );
  repository = { connection: db, findRecordById: () => user };
  auth = createAuth(repository);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  db.close();
});

it("issues remembered logins for exactly 30 days without extending them on refresh", () => {
  const start = Date.now();
  const token = repository.issueSession(user, true);
  expect(auth.sessionDetails(token)).toMatchObject({
    remember: 1,
    expires: start + 30 * DAY,
  });
  vi.setSystemTime(start + 10 * DAY);
  const res = { cookie: vi.fn() };
  auth.setSessionCookie({ secure: true }, res, token);
  expect(res.cookie).toHaveBeenCalledWith(
    "monline_session",
    token,
    expect.objectContaining({ maxAge: 20 * DAY, httpOnly: true, secure: true }),
  );
  expect(auth.sessionDetails(token).expires).toBe(start + 30 * DAY);
  vi.setSystemTime(start + 30 * DAY);
  expect(auth.resolve(token)).toBeNull();
});

it("uses a browser-session cookie for unchecked logins and preserves that on refresh", () => {
  const token = repository.issueSession(user);
  const res = { cookie: vi.fn() };
  auth.setSessionCookie({ secure: false }, res, token);
  const options = res.cookie.mock.calls[0][2];
  expect(options).toMatchObject({ httpOnly: true, sameSite: "lax" });
  expect(options).not.toHaveProperty("maxAge");
  expect(options).not.toHaveProperty("expires");
  expect(auth.sessionDetails(token).remember).toBe(0);
});

it("keeps trusted-device persistence independent of session persistence", () => {
  const res = { cookie: vi.fn() };
  auth.rememberDevice({ secure: true }, res, user.id);
  const token = res.cookie.mock.calls[0][1];
  expect(auth.resolve(token, "device")).toBe(user.id);
  expect(auth.resolve(token)).toBeNull();
  expect(
    db
      .prepare("SELECT remember FROM monline_sessions WHERE hash=?")
      .get(hash(token)).remember,
  ).toBe(0);
  expect(auth.sessionDetails(repository.issueSession(user)).remember).toBe(0);
});
