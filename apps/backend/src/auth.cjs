const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  HttpError,
} = require("./errors.cjs");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const cookieValue = (req, name) =>
  String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name + "="))
    ?.slice(name.length + 1) || "";
const tokens = () => crypto.randomBytes(32).toString("base64url");
const DAY = 24 * 60 * 60 * 1000;

function createAuth(repository) {
  const db = repository.connection;
  const secureCookie = (req) => ({
    httpOnly: true,
    secure: req.secure,
    sameSite: "lax",
    path: "/",
  });
  const settings = () =>
    repository.findRecordsByFilter("admin_settings", "", "", 1)[0];
  const isAdmin = (user) =>
    !!user &&
    repository.findRecordsByFilter("users", "", "created,id", 1)[0]?.id ===
      user.id;
  const issue = (
    userId,
    purpose = "session",
    lifetime = 14 * DAY,
    remember = false,
  ) => {
    const token = tokens();
    db.prepare(
      "INSERT INTO monline_sessions (hash,user_id,expires,purpose,remember) VALUES (?,?,?,?,?)",
    ).run(
      hash(token),
      userId,
      Date.now() + lifetime,
      purpose,
      remember === true ? 1 : 0,
    );
    return token;
  };
  repository.issueSession = (user, remember = false) =>
    issue(user.id, "session", (remember ? 30 : 14) * DAY, remember);
  const resolve = (token, purpose = "session") => {
    if (!token || token.length > 200) return null;
    return (
      db
        .prepare(
          "SELECT user_id FROM monline_sessions WHERE hash=? AND expires>? AND purpose=?",
        )
        .get(hash(token), Date.now(), purpose)?.user_id || null
    );
  };
  const sessionDetails = (token) =>
    db
      .prepare(
        "SELECT expires,remember FROM monline_sessions WHERE hash=? AND purpose='session' AND expires>?",
      )
      .get(hash(token), Date.now());
  const setSessionCookie = (req, res, token) => {
    const session = sessionDetails(token);
    return res.cookie("monline_session", token, {
      ...secureCookie(req),
      ...(session?.remember
        ? { maxAge: Math.max(0, session.expires - Date.now()) }
        : {}),
    });
  };
  const rememberDevice = (req, res, userId) =>
    res.cookie("monline_device", issue(userId, "device", 30 * DAY), {
      ...secureCookie(req),
      maxAge: 30 * DAY,
    });
  const sessionResponse = (req, res, user, remember = false) => {
    const token = repository.issueSession(user, remember);
    setSessionCookie(req, res, token);
    return res.json({
      token,
      record: user.publicExport(),
      remember: sessionDetails(token)?.remember === 1,
    });
  };
  const passwordValid = (password, stored) =>
    bcrypt.compare(String(password), stored || "");
  const requireUser = (req) => {
    if (!req.user) throw new UnauthorizedError();
    return req.user;
  };
  const rate = new Map(),
    challenges = new Map();
  function limitTotp(challenge) {
    const key = hash(String(challenge || "")),
      now = Date.now();
    const entry = challenges.get(key);
    const bucket =
      entry && entry.until > now
        ? entry
        : { count: 0, until: now + 5 * 60 * 1000 };
    bucket.count++;
    challenges.set(key, bucket);
    if (bucket.count > 5)
      throw new HttpError(
        429,
        "Too many verification attempts. Sign in again.",
      );
  }
  function limit(req, max = 30) {
    const key = req.ip + ":" + req.path,
      now = Date.now();
    const entry = rate.get(key);
    const bucket =
      entry && entry.until > now
        ? entry
        : { count: 0, until: now + 15 * 60 * 1000 };
    bucket.count++;
    rate.set(key, bucket);
    if (bucket.count > max)
      throw new HttpError(429, "Too many attempts. Please try again later.");
  }
  const timer = setInterval(() => {
    for (const [key, entry] of rate)
      if (entry.until < Date.now()) rate.delete(key);
    for (const [key, entry] of challenges)
      if (entry.until < Date.now()) challenges.delete(key);
    db.prepare("DELETE FROM monline_sessions WHERE expires<?").run(Date.now());
  }, 60 * 1000);
  timer.unref();
  function middleware(req, res, next) {
    try {
      const bearer = req.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
      req.sessionToken =
        bearer ||
        (req.path.startsWith("/api/files/")
          ? cookieValue(req, "monline_session")
          : "");
      const userId = resolve(req.sessionToken);
      if (userId) {
        try {
          req.user = repository.findRecordById("users", userId);
        } catch {}
      }
      if (req.path.startsWith("/api/auth/"))
        limit(
          req,
          ["/api/auth/setup", "/api/auth/setup/restore"].includes(req.path)
            ? 10
            : req.path.includes("totp") || req.path.endsWith("/login")
              ? 30
              : 100,
        );
      if (req.path === "/api/data/users" && req.method === "POST")
        limit(req, 20);
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.get("Origin");
        if (origin) {
          const allowed =
            new URL(origin).host === req.get("host") ||
            (process.env.NODE_ENV !== "production" &&
              ["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
          if (!allowed)
            throw new ForbiddenError("Request origin is not allowed");
        } else if (!bearer && cookieValue(req, "monline_session"))
          throw new ForbiddenError("Origin is required");
      }
      next();
    } catch (error) {
      next(error);
    }
  }
  function register(app) {
    app.post("/api/auth/login", async (req, res) => {
      const body = req.body || {},
        identity = String(body.identity || "").trim();
      const match = db
        .prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE")
        .get(identity);
      const user = match ? repository.findRecordById("users", match.id) : null;
      const valid = await passwordValid(
        body.password || "",
        user?.getString("password") ||
          "$2b$12$KIXxvFKQXSxIzNGLbyYnquVwpe85J1HhYQWLWcGavf13pASRov6zK",
      );
      if (!user || !valid)
        throw new UnauthorizedError("Invalid email or password");
      if (settings()?.getBool("disable_login") && !isAdmin(user))
        throw new ForbiddenError("Logins are currently disabled");
      if (
        settings()?.getBool("require_email_validation") &&
        !user.getBool("verified")
      )
        throw new ForbiddenError("Please verify your email before signing in");
      if (
        user.getBool("totp_enabled") &&
        resolve(cookieValue(req, "monline_device"), "device") !== user.id
      ) {
        const issued =
          require("./domain/lib/totp-challenge.js").createTotpLoginChallenge(
            user,
            body.remember === true,
          );
        return res.json({
          challenge: issued.challenge,
          expires_at: issued.expiresAt,
          user_id: user.id,
        });
      }
      return sessionResponse(req, res, user, body.remember === true);
    });
    app.post("/api/auth/refresh", (req, res) => {
      const user = requireUser(req);
      setSessionCookie(req, res, req.sessionToken);
      res.json({
        token: req.sessionToken,
        record: user.publicExport(),
        remember: sessionDetails(req.sessionToken)?.remember === 1,
      });
    });
    app.post("/api/auth/logout", (req, res) => {
      if (req.sessionToken)
        db.prepare("DELETE FROM monline_sessions WHERE hash=?").run(
          hash(req.sessionToken),
        );
      res.clearCookie("monline_session", secureCookie(req));
      res.status(204).end();
    });
    app.post("/api/auth/file-token", (req, res) =>
      res.json({ token: issue(requireUser(req).id, "file", 5 * 60 * 1000) }),
    );
    app.post("/api/auth/password-reset", async (req, res) => {
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const user = repository.findRecordsByFilter(
        "users",
        "email = {:email}",
        "",
        1,
        0,
        { email },
      )[0];
      if (user) {
        const smtp = repository.settings();
        if (!smtp.smtp.enabled)
          throw new BadRequestError(
            "Password reset requires SMTP configuration",
          );
        const base = publicUrl(req),
          token = issue(user.id, "reset", 30 * 60 * 1000);
        await repository.newMailClient().send({
          from: {
            address: smtp.meta.senderAddress,
            name: smtp.meta.senderName,
          },
          to: [{ address: email }],
          subject: "Monline — Reset password",
          text: `Reset your password within 30 minutes: ${base}/api/auth/reset?token=${encodeURIComponent(token)}`,
        });
      }
      res.status(204).end();
    });
    app.get("/api/auth/reset", (req, res) => {
      if (!resolve(String(req.query.token || ""), "reset"))
        throw new BadRequestError("Invalid or expired reset link");
      const token = String(req.query.token);
      res.set(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      );
      res
        .type("html")
        .send(
          `<html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Monline</title><style>body{background:#191d1b;color:#eee;font:16px system-ui;display:grid;place-items:center;min-height:95vh}form{display:grid;gap:16px;max-width:320px}input,button{padding:12px;border-radius:10px;border:1px solid #555}button{background:#d8ff69}</style><form method="post"><h1>Monline</h1><label>New password</label><input name="password" type="password" minlength="8" maxlength="72" required autocomplete="new-password"><input type="hidden" name="token" value="${token}"><button>Save password</button></form></html>`,
        );
    });
    app.post("/api/auth/reset", async (req, res) => {
      const userId = resolve(String(req.body?.token || ""), "reset");
      if (!userId) throw new BadRequestError("Invalid or expired reset link");
      const password = String(req.body.password || "");
      validatePassword(password);
      const user = repository.findRecordById("users", userId);
      user.set("password", await bcrypt.hash(password, 12));
      user.set("verified", true);
      repository.runInTransaction(() => {
        repository.save(user);
        db.prepare("DELETE FROM monline_sessions WHERE user_id=?").run(userId);
      });
      res
        .type("html")
        .send('<p>Password updated. <a href="/">Sign in to Monline</a></p>');
    });
    app.get("/api/auth/verify-email", (req, res) => {
      const token = String(req.query.token || ""),
        userId = resolve(token, "verify");
      if (!userId)
        throw new BadRequestError("Invalid or expired verification link");
      repository.runInTransaction(() => {
        const user = repository.findRecordById("users", userId);
        user.set("verified", true);
        repository.save(user);
        db.prepare("DELETE FROM monline_sessions WHERE hash=?").run(
          hash(token),
        );
      });
      res
        .type("html")
        .send('<p>Email verified. <a href="/">Sign in to Monline</a></p>');
    });
  }
  function publicUrl(req) {
    const configured = settings()?.getString("server_url");
    if (!configured && process.env.NODE_ENV === "production")
      throw new BadRequestError(
        "Configure the public server URL in administrator settings before sending account emails",
      );
    return (configured || `${req.protocol}://${req.get("host")}`).replace(
      /\/$/,
      "",
    );
  }
  async function sendVerification(req, user) {
    const smtp = repository.settings();
    if (!smtp.smtp.enabled)
      throw new BadRequestError(
        "Email verification requires SMTP configuration",
      );
    const token = issue(user.id, "verify", DAY);
    await repository.newMailClient().send({
      from: { address: smtp.meta.senderAddress, name: smtp.meta.senderName },
      to: [{ address: user.getString("email") }],
      subject: "Monline — Verify email",
      text: `${publicUrl(req)}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
    });
  }
  return {
    middleware,
    register,
    resolve,
    issue,
    isAdmin,
    passwordValid,
    requireUser,
    setSessionCookie,
    sessionDetails,
    rememberDevice,
    sessionResponse,
    sendVerification,
    cookieValue,
    limitTotp,
  };
}
function validatePassword(value) {
  if (value.length < 8 || Buffer.byteLength(value) > 72)
    throw new BadRequestError(
      "Password must be at least 8 characters and at most 72 bytes",
      {
        password: {
          code: "validation_length_out_of_range",
          message: "Use 8–72 bytes",
        },
      },
    );
}
module.exports = { createAuth, validatePassword, hash };
