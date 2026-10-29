const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const { DataRecord } = require("./storage.cjs");
const { BadRequestError, ForbiddenError } = require("./errors.cjs");
const { isValidEmail } = require("./email.cjs");
const { validatePassword } = require("./auth.cjs");

function registerAdminUsersApi(app, repository, auth) {
  const db = repository.connection;
  const requireAdmin = (req) => {
    auth.requireUser(req);
    if (!auth.isAdmin(req.user))
      throw new ForbiddenError("admin_users_forbidden");
  };
  const targetUser = (id) => {
    const user = repository.findRecordById("users", id);
    if (auth.isAdmin(user))
      throw new ForbiddenError("admin_users_admin_protected");
    return user;
  };
  const output = (user) => ({
    id: user.id,
    name: user.getString("name"),
    email: user.getString("email"),
    created: user.getString("created"),
    verified: user.getBool("verified"),
    disabled: user.getBool("disabled"),
    is_admin: auth.isAdmin(user),
    totp_enabled: user.getBool("totp_enabled"),
    oidc_linked: !!user.getString("oidc_subject"),
    subscription_count: repository.countRecords(
      "subscriptions",
      "user = {:id}",
      { id: user.id },
    ),
    session_count: db
      .prepare(
        "SELECT count(*) AS total FROM monline_sessions WHERE user_id=? AND purpose='session' AND expires>?",
      )
      .get(user.id, Date.now()).total,
  });
  const revokeSessions = (user) => {
    user.set("totp_login_challenge_hash", "");
    user.set("totp_login_challenge_expires", "");
    repository.save(user);
    db.prepare("DELETE FROM monline_sessions WHERE user_id=?").run(user.id);
  };
  app.use(
    "/api/admin/users",
    (req, res, next) => {
      try {
        requireAdmin(req);
        next();
      } catch (error) {
        next(error);
      }
    },
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 60,
      skip: (req) => req.method === "GET",
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );

  app.get("/api/admin/users", (req, res) => {
    const search =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 254) : "";
    const requestedPage = Number(req.query.page);
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, 1000000)
        : 1;
    const requestedSize = Number(req.query.perPage);
    const perPage = Number.isSafeInteger(requestedSize)
      ? Math.min(25, Math.max(1, requestedSize))
      : 25;
    const filter = search ? "name ~ {:query} || email ~ {:query}" : "";
    const params = { query: search };
    const total = repository.countRecords("users", filter, params);
    res.json({
      items: repository
        .findRecordsByFilter(
          "users",
          filter,
          "created,id",
          perPage,
          (page - 1) * perPage,
          params,
        )
        .map(output),
      page,
      perPage,
      totalItems: total,
      totalPages: Math.ceil(total / perPage),
      totalAccounts: repository.countRecords("users"),
      disabledAccounts: repository.countRecords("users", "disabled = true"),
    });
  });
  app.get("/api/admin/users/options", (req, res) =>
    res.json(
      repository.findRecordsByFilter("users", "", "name,id").map((user) => ({
        id: user.id,
        name: user.getString("name"),
        email: user.getString("email"),
        disabled: user.getBool("disabled"),
      })),
    ),
  );
  async function saveUser(req, res, create) {
    const body = req.body;
    const allowed = new Set([
      "name",
      "email",
      "password",
      "verified",
      "disabled",
    ]);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !allowed.has(key))
    )
      throw new BadRequestError("admin_users_invalid_fields");
    if (!create) targetUser(req.params.id);
    for (const flag of ["verified", "disabled"])
      if (Object.hasOwn(body, flag) && typeof body[flag] !== "boolean")
        throw new BadRequestError("admin_users_invalid_fields");
    const nextName = Object.hasOwn(body, "name")
      ? body.name
      : create
        ? ""
        : undefined;
    if (
      nextName !== undefined &&
      (typeof nextName !== "string" ||
        !nextName.trim() ||
        nextName.trim().length > 255)
    )
      throw new BadRequestError("admin_users_invalid_name");
    const nextEmail = Object.hasOwn(body, "email")
      ? body.email
      : create
        ? ""
        : undefined;
    if (
      nextEmail !== undefined &&
      (typeof nextEmail !== "string" || !isValidEmail(nextEmail.trim()))
    )
      throw new BadRequestError("admin_users_invalid_email");
    let passwordHash;
    if (create || (Object.hasOwn(body, "password") && body.password !== "")) {
      if (typeof body.password !== "string")
        throw new BadRequestError("admin_users_password_policy");
      try {
        validatePassword(body.password);
      } catch {
        throw new BadRequestError("admin_users_password_policy");
      }
      passwordHash = await bcrypt.hash(body.password, 12);
    }
    // Password hashing yields to the event loop; recheck authority and reload
    // the target before committing to avoid overwriting concurrent changes.
    requireAdmin(req);
    const user = create
      ? new DataRecord(repository.findCollectionByNameOrId("users"))
      : targetUser(req.params.id);
    const oldEmail = user.getString("email");
    const oldDisabled = user.getBool("disabled");
    const oldVerified = user.getBool("verified");
    if (nextName !== undefined) user.set("name", nextName.trim());
    if (nextEmail !== undefined) {
      const email = nextEmail.trim().toLowerCase();
      if (
        db
          .prepare(
            "SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id != ?",
          )
          .get(email, user.id)
      )
        throw new BadRequestError("admin_users_email_exists");
      user.set("email", email);
      if (!create && oldEmail !== email) user.set("verified", false);
    }
    for (const flag of ["verified", "disabled"])
      if (Object.hasOwn(body, flag)) user.set(flag, body[flag]);
    if (passwordHash) user.set("password", passwordHash);
    if (create) {
      user.set("language", req.user.getString("language") || "en");
      user.set("color_theme", "monline");
      user.set("sort_order", "name");
      user.set("sort_direction", "asc");
      for (const flag of [
        "show_logo_on_card",
        "show_price_on_card",
        "show_cycle_on_card",
        "show_payment_method_on_card",
        "show_category_on_card",
        "show_payer_on_card",
        "show_next_payment_on_card",
        "monthly_price",
      ])
        user.set(flag, true);
    }
    repository.runInTransaction(() => {
      repository.save(user);
      if (
        !create &&
        (passwordHash ||
          oldEmail !== user.getString("email") ||
          oldDisabled !== user.getBool("disabled") ||
          oldVerified !== user.getBool("verified"))
      )
        revokeSessions(user);
    });
    res.status(create ? 201 : 200).json(output(user));
  }
  app.post("/api/admin/users", (req, res) => saveUser(req, res, true));
  app.patch("/api/admin/users/:id", (req, res) => saveUser(req, res, false));
  app.post("/api/admin/users/:id/revoke-sessions", (req, res) => {
    const user = targetUser(req.params.id);
    repository.runInTransaction(() => revokeSessions(user));
    res.status(204).end();
  });
  app.delete("/api/admin/users/:id", (req, res) => {
    repository.delete(targetUser(req.params.id));
    res.status(204).end();
  });
}

module.exports = { registerAdminUsersApi };
