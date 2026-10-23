const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const { DataRecord, schema, identifier } = require("./storage.cjs");
const { validatePassword } = require("./auth.cjs");
const { isValidEmail } = require("./email.cjs");
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} = require("./errors.cjs");
const writable = new Set([
  "users",
  "categories",
  "currencies",
  "household",
  "payment_methods",
  "subscriptions",
  "notifications_config",
  "fixer_settings",
  "payment_records",
  "yearly_costs",
]);
const readable = new Set([
  "users",
  "cycles",
  "frequencies",
  "exchange_log",
  ...writable,
  "subscription_history",
  "bank_statements",
]);
const userDenied = new Set([
  "id",
  "created",
  "updated",
  "password",
  "tokenKey",
  "verified",
  "api_key",
  "two_factor_enabled",
  "two_factor_secret",
  "totp_secret",
  "totp_backup_codes",
  "totp_enabled",
  "totp_configured",
  "totp_login_challenge_hash",
  "totp_login_challenge_expires",
  "oidc_subject",
]);
function registerDataApi(app, repository, auth) {
  const ownerField = (name) =>
    name === "users" ? "id" : name === "notification_log" ? "user_id" : "user";
  const owned = (record, user) => {
    if (
      ["cycles", "frequencies", "exchange_log"].includes(
        record.collection().name,
      )
    )
      return true;
    return record.getString(ownerField(record.collection().name)) === user.id;
  };
  function collectionFor(req) {
    auth.requireUser(req);
    if (!readable.has(req.params.collection)) throw new NotFoundError();
    return repository.findCollectionByNameOrId(req.params.collection);
  }
  function output(record, req) {
    repository.emit("enrich", record);
    const data = record.publicExport();
    const expand = String(req.query.expand || "")
      .split(",")
      .filter(Boolean);
    for (const name of expand) {
      const field = record
        .collection()
        .fields.find((f) => f.name === name && f.type === "relation");
      if (!field || !record.getString(name)) continue;
      try {
        const related = repository.findRecordById(
          field.collectionId,
          record.getString(name),
        );
        if (!owned(related, req.user)) continue;
        repository.emit("enrich", related);
        data.expand ||= {};
        data.expand[name] = related.publicExport();
      } catch {}
    }
    if (req.query.fields) {
      const keys = new Set(String(req.query.fields).split(","));
      for (const name of Object.keys(data))
        if (!keys.has(name)) delete data[name];
    }
    return data;
  }
  function findOwned(req, collection) {
    const record = repository.findRecordById(collection.name, req.params.id);
    if (!owned(record, req.user)) throw new NotFoundError();
    return record;
  }
  app.get("/api/data/:collection", (req, res) => {
    const collection = collectionFor(req);
    const filtered = String(req.query.filter || "");
    const scope = ["cycles", "frequencies", "exchange_log"].includes(
      collection.name,
    )
      ? "1=1"
      : `${ownerField(collection.name)} = {:monlineOwner}`;
    const filter = filtered ? `(${scope}) && (${filtered})` : scope,
      params = { monlineOwner: req.user.id };
    const total = repository.countRecords(collection.name, filter, params);
    const perPage = Math.min(
      500,
      Math.max(1, parseInt(req.query.perPage) || 100),
    );
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const rows = repository.findRecordsByFilter(
      collection.name,
      filter,
      String(req.query.sort || "id"),
      perPage,
      (page - 1) * perPage,
      params,
    );
    res.json({
      page,
      perPage,
      totalItems: total,
      totalPages: Math.ceil(total / perPage),
      items: rows.map((record) => output(record, req)),
    });
  });
  app.get("/api/data/:collection/:id", (req, res) =>
    res.json(output(findOwned(req, collectionFor(req)), req)),
  );
  async function write(req, res, create) {
    const name = req.params.collection;
    if (!writable.has(name)) throw new ForbiddenError();
    if (name !== "users" || !create) collectionFor(req);
    const collection = repository.findCollectionByNameOrId(name);
    const record = create
      ? new DataRecord(collection)
      : findOwned(req, collection);
    const previousPassword = record.getString("password");
    const body = req.body || {};
    if (name === "users" && create && !repository.countRecords("users"))
      throw new BadRequestError(
        "Complete first-time setup before registering an account",
      );
    let emailChanged = false;
    for (const field of collection.fields) {
      if (field.type === "file" && body[field.name + "-"])
        record.set(field.name, "");
      if (
        [
          "id",
          "created",
          "updated",
          "user",
          "calendar_history_recovery_passes",
        ].includes(field.name) ||
        (name === "users" && userDenied.has(field.name))
      )
        continue;
      if (!Object.hasOwn(body, field.name)) continue;
      let value = body[field.name];
      if (field.type === "file" && value !== "") continue;
      if (field.type === "bool")
        value =
          value === true || value === "true" || value === 1 || value === "1";
      if (field.type === "number") {
        if (value === "" && ["price", "amount"].includes(field.name))
          throw new BadRequestError("Amount is required", {
            [field.name]: { message: "Required" },
          });
        value = Number(value);
        if (!Number.isFinite(value))
          throw new BadRequestError("Invalid number");
      }
      record.set(field.name, value);
    }
    if (name !== "users") record.set("user", req.user.id);
    if (name === "subscriptions") record.set("record_type", "expense");
    for (const file of req.files || []) {
      if (
        !collection.fields.some(
          (field) => field.name === file.fieldname && field.type === "file",
        )
      )
        continue;
      const type =
        require("./domain/lib/pure/image-source.js").imageContentType(
          file.buffer,
        );
      if (file.fieldname !== "proof" && !type)
        throw new BadRequestError("Please upload an image");
      record.set(file.fieldname, {
        bytes: file.buffer,
        name: file.originalname,
      });
    }
    if (name === "users") {
      if (create) {
        if (
          repository
            .findRecordsByFilter("admin_settings", "", "", 1)[0]
            ?.getBool("require_email_validation") &&
          !repository.settings().smtp.enabled
        )
          throw new BadRequestError(
            "Email verification requires SMTP configuration",
          );
        if (!body.password || body.password !== body.passwordConfirm)
          throw new BadRequestError("Passwords do not match");
        validatePassword(String(body.password));
        record.set("password", await bcrypt.hash(body.password, 12));
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
          record.set(flag, true);
        record.set("color_theme", "monline");
        record.set("language", body.language || "en");
        record.set("sort_order", "name");
        record.set("sort_direction", "asc");
      } else if (body.password) {
        if (body.password !== body.passwordConfirm)
          throw new BadRequestError("Passwords do not match");
        if (
          !(await auth.passwordValid(
            body.oldPassword || "",
            record.getString("password"),
          ))
        )
          throw new BadRequestError("Current password is incorrect");
        validatePassword(body.password);
        record.set("password", await bcrypt.hash(body.password, 12));
      }
      const email = String(body.email ?? record.getString("email"))
        .trim()
        .toLowerCase();
      if (!isValidEmail(email))
        throw new BadRequestError("Invalid email", {
          email: { message: "Invalid email" },
        });
      if (!create && email !== record.getString("email")) {
        if (
          !(await auth.passwordValid(body.oldPassword || "", previousPassword))
        )
          throw new BadRequestError(
            "Current password is required to change email",
          );
        record.set("verified", false);
        emailChanged = true;
      }
      record.set("email", email);
    }
    const backfillHelper = require("./domain/lib/subscription-backfill.js");
    const hasInitialPayment =
      name === "subscriptions" && Object.hasOwn(body, "initial_payment");
    if (
      hasInitialPayment &&
      (!create || Object.hasOwn(body, "historical_payments"))
    )
      throw new BadRequestError("backfill_invalid_selection");
    const backfill = hasInitialPayment
      ? backfillHelper.prepareInitialPayment(
          repository,
          record,
          body.initial_payment,
        )
      : name === "subscriptions" && Object.hasOwn(body, "historical_payments")
        ? backfillHelper.prepareBackfill(
            repository,
            record,
            body.historical_payments,
          )
        : null;
    repository.runInTransaction(() => {
      repository.emit(
        create ? "createRequest" : "updateRequest",
        record,
        () => repository.save(record),
        req.user,
      );
      if (backfill) backfillHelper.saveBackfill(repository, record, backfill);
      if (name === "users" && !create && body.password) {
        repository.connection
          .prepare("DELETE FROM monline_sessions WHERE user_id=? AND hash<>?")
          .run(record.id, require("./auth.cjs").hash(req.sessionToken || ""));
      }
    });
    if (
      name === "users" &&
      (create || emailChanged) &&
      repository
        .findRecordsByFilter("admin_settings", "", "", 1)[0]
        ?.getBool("require_email_validation")
    )
      await auth.sendVerification(req, record);
    res.status(create ? 201 : 200).json(
      output(record, {
        ...req,
        query: {},
        user: name === "users" ? record : req.user,
      }),
    );
  }
  app.post("/api/data/:collection", (req, res) => write(req, res, true));
  app.patch("/api/data/:collection/:id", (req, res) => write(req, res, false));
  app.delete("/api/data/:collection/:id", (req, res) => {
    const collection = collectionFor(req);
    if (!writable.has(collection.name) && collection.name !== "bank_statements")
      throw new ForbiddenError();
    const record = findOwned(req, collection);
    if (collection.name === "categories")
      require("./domain/lib/subscription-category.js").requireUnusedCategory(
        repository,
        record,
      );
    repository.delete(record);
    res.status(204).end();
  });
  app.get("/api/files/:collection/:id/:name", (req, res) => {
    let user = req.user;
    if (!user) {
      const id = auth.resolve(String(req.query.token || ""), "file");
      if (id) user = repository.findRecordById("users", id);
    }
    if (!user) throw new ForbiddenError();
    const collection = repository.findCollectionByNameOrId(
      req.params.collection,
    );
    const record = repository.findRecordById(collection.name, req.params.id);
    if (
      !owned(record, user) &&
      !(collection.name === "users" && auth.isAdmin(user))
    )
      throw new NotFoundError();
    const file = req.params.name;
    if (
      file !== path.basename(file) ||
      /[\\\x00]/.test(file) ||
      !collection.fields.some(
        (field) =>
          field.type === "file" && record.getString(field.name) === file,
      )
    )
      throw new NotFoundError();
    const target = path.join(
      repository.directory,
      "storage",
      collection.name,
      record.id,
      file,
    );
    if (!fs.existsSync(target)) throw new NotFoundError();
    res.set({
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.sendFile(target);
  });
}
module.exports = { registerDataApi };
