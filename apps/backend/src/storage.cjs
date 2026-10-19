const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const schema = require("./schema.json");
const { compileFilter, compileSort } = require("./filter.cjs");
const { BadRequestError, NotFoundError } = require("./errors.cjs");
const bcrypt = require("bcryptjs");
const { normalizeSubscriptionName } = require("./subscription-names.cjs");

const identifier = (value) => '"' + String(value).replace(/"/g, '""') + '"';
const newId = () =>
  Array.from(
    { length: 15 },
    () => "abcdefghijklmnopqrstuvwxyz0123456789"[crypto.randomInt(36)],
  ).join("");
const stamp = () => new Date().toISOString().replace("T", " ");
const secretFields = new Set([
  "password",
  "tokenKey",
  "api_key",
  "two_factor_secret",
  "totp_secret",
  "totp_backup_codes",
  "totp_login_challenge_hash",
  "totp_login_challenge_expires",
  "oidc_subject",
]);

class DataRecord {
  constructor(collection, values = null) {
    this._collection = collection;
    this._values = values ? { ...values } : {};
    this._original = values ? { ...values } : null;
    this._hidden = new Set();
  }
  get id() {
    return this._values.id || "";
  }
  set id(value) {
    this._values.id = value;
  }
  collection() {
    return this._collection;
  }
  get(name) {
    const value = this._values[name];
    const field = this._collection.fields.find((f) => f.name === name);
    if (field?.type === "json" && typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    if (field?.type === "bool") return value === true || value === 1;
    if (value !== undefined) return value;
    if (["number"].includes(field?.type)) return 0;
    if (field?.type === "bool") return false;
    if (field?.type === "json") return null;
    return "";
  }
  getString(name) {
    const value = this.get(name);
    return typeof value === "string"
      ? value
      : value == null
        ? ""
        : String(value);
  }
  getBool(name) {
    const value = this.get(name);
    return value === true || value === 1 || value === "true";
  }
  getFloat(name) {
    return Number(this.get(name)) || 0;
  }
  set(name, value) {
    this._values[name] = value;
  }
  hide(name) {
    this._hidden.add(name);
  }
  original() {
    return new DataRecord(this._collection, this._original || {});
  }
  setPassword(password) {
    this.set("password", bcrypt.hashSync(password, 12));
  }
  newAuthToken(remember = false) {
    return this._collection.repository.issueSession(this, remember);
  }
  publicExport() {
    const result = {
      id: this.id,
      collectionId: this._collection.name,
      collectionName: this._collection.name,
    };
    for (const field of this._collection.fields) {
      if (
        field.hidden ||
        secretFields.has(field.name) ||
        this._hidden.has(field.name)
      )
        continue;
      result[field.name] = this.get(field.name);
    }
    return result;
  }
  toJSON() {
    return this.publicExport();
  }
}

class Repository {
  constructor(directory) {
    this.directory = path.resolve(directory);
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    this.connection = new DatabaseSync(path.join(this.directory, "monline.db"));
    this.connection.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;",
    );
    this.collections = new Map();
    this.hooks = new Map();
    this.cache = new Map();
    this.depth = 0;
    for (const entry of schema) {
      this.connection.exec(
        entry.sql.replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS "),
      );
      if (
        entry.name === "payment_records" &&
        !this.connection
          .prepare('PRAGMA table_info("payment_records")')
          .all()
          .some((column) => column.name === "statement_sources")
      ) {
        this.connection.exec(
          "ALTER TABLE payment_records ADD COLUMN statement_sources TEXT DEFAULT 'null'",
        );
      }
      const collection = {
        ...entry,
        id: entry.name,
        repository: this,
        names: new Set(entry.fields.map((f) => f.name)),
      };
      this.collections.set(entry.name, collection);
      this.collections.set(entry.legacyId, collection);
    }
    if (
      !this.connection
        .prepare('PRAGMA table_info("subscriptions")')
        .all()
        .some((column) => column.name === "statement_imported")
    )
      this.connection.exec(
        "ALTER TABLE subscriptions ADD COLUMN statement_imported INTEGER NOT NULL DEFAULT 0",
      );
    if (
      !this.connection
        .prepare('PRAGMA table_info("payment_methods")')
        .all()
        .some((column) => column.name === "is_main")
    )
      this.connection.exec(
        "ALTER TABLE payment_methods ADD COLUMN is_main INTEGER NOT NULL DEFAULT 0",
      );
    this.repairStatementImportMarkers();
    this.repairMainPaymentMethods();
    if (
      !this.connection
        .prepare('PRAGMA table_info("household")')
        .all()
        .some((column) => column.name === "is_main")
    )
      this.connection.exec(
        "ALTER TABLE household ADD COLUMN is_main INTEGER NOT NULL DEFAULT 0",
      );
    this.repairMainHousehold();
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS monline_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS monline_sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL, purpose TEXT NOT NULL DEFAULT 'session', remember INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS sessions_user ON monline_sessions(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS payment_due ON payment_records(user,subscription_id,due_date);
      CREATE INDEX IF NOT EXISTS bank_hash ON bank_statements(user,file_hash);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON monline_sessions(expires);
    `);
    if (
      !this.connection
        .prepare("PRAGMA table_info(monline_sessions)")
        .all()
        .some((column) => column.name === "remember")
    )
      this.connection.exec(
        "ALTER TABLE monline_sessions ADD COLUMN remember INTEGER NOT NULL DEFAULT 0",
      );
    for (const entry of schema) {
      const field = entry.name === "notification_log" ? "user_id" : "user";
      if (entry.fields.some((f) => f.name === field))
        this.connection.exec(
          `CREATE INDEX IF NOT EXISTS ${identifier(entry.name + "_owner")} ON ${identifier(entry.name)}(${identifier(field)})`,
        );
    }
  }
  repairStatementImportMarkers() {
    // Recover the marker for older statement payments and restored backups.
    this.connection.exec(`UPDATE subscriptions SET statement_imported=1
      WHERE statement_imported=0 AND EXISTS (
        SELECT 1 FROM payment_records p WHERE p.subscription_id=subscriptions.id
        AND p.user=subscriptions.user AND instr(p.statement_sources, '[monline-statement:')>0
      )`);
  }
  repairMainPaymentMethods() {
    const seen = new Set();
    const methods = this.connection
      .prepare(
        'SELECT id,user FROM payment_methods ORDER BY user,is_main DESC,"order",name,id',
      )
      .all();
    const update = this.connection.prepare(
      "UPDATE payment_methods SET is_main=CASE WHEN id=? THEN 1 ELSE 0 END WHERE user=?",
    );
    for (const method of methods) {
      if (seen.has(method.user)) continue;
      seen.add(method.user);
      update.run(method.id, method.user);
    }
  }
  dataDir() {
    return this.directory;
  }
  repairMainHousehold() {
    const seen = new Set();
    const members = this.connection
      .prepare(
        "SELECT id,user FROM household ORDER BY user,is_main DESC,name,id",
      )
      .all();
    const update = this.connection.prepare(
      "UPDATE household SET is_main=CASE WHEN id=? THEN 1 ELSE 0 END WHERE user=?",
    );
    for (const member of members) {
      if (seen.has(member.user)) continue;
      seen.add(member.user);
      update.run(member.id, member.user);
    }
  }
  store() {
    return this.cache;
  }
  findCollectionByNameOrId(name) {
    const value = this.collections.get(name);
    if (!value) throw new NotFoundError("Unknown collection");
    return value;
  }
  findRecordById(name, id) {
    const collection = this.findCollectionByNameOrId(name);
    const row = this.connection
      .prepare(`SELECT * FROM ${identifier(collection.name)} WHERE id=?`)
      .get(String(id));
    if (!row) throw new NotFoundError();
    return new DataRecord(collection, row);
  }
  findRecordsByFilter(
    name,
    filter = "",
    sort = "",
    limit = 0,
    offset = 0,
    params = {},
  ) {
    const collection = this.findCollectionByNameOrId(name);
    const where = compileFilter(filter, collection.names, params);
    let sql = `SELECT * FROM ${identifier(collection.name)} WHERE ${where.sql}${compileSort(sort, collection.names)}`;
    if (limit > 0) {
      sql += " LIMIT ? OFFSET ?";
      where.values.push(Math.trunc(limit), Math.max(0, Math.trunc(offset)));
    }
    return this.connection
      .prepare(sql)
      .all(...where.values)
      .map((row) => new DataRecord(collection, row));
  }
  countRecords(name, filter = "", params = {}) {
    const collection = this.findCollectionByNameOrId(name),
      where = compileFilter(filter, collection.names, params);
    return this.connection
      .prepare(
        `SELECT count(*) AS total FROM ${identifier(collection.name)} WHERE ${where.sql}`,
      )
      .get(...where.values).total;
  }
  on(event, callback, collections) {
    for (const name of collections) {
      const key = event + ":" + name;
      const list = this.hooks.get(key) || [];
      list.push(callback);
      this.hooks.set(key, list);
    }
  }
  emit(event, record, terminal = () => {}, auth = null) {
    const callbacks =
      this.hooks.get(event + ":" + record.collection().name) || [];
    let cursor = 0;
    const next = () =>
      cursor < callbacks.length
        ? callbacks[cursor++]({ record, auth, app: this, next })
        : terminal();
    return next();
  }
  runInTransaction(callback) {
    const name = "monline_" + this.depth++;
    this.connection.exec("SAVEPOINT " + name);
    try {
      const result = callback(this);
      if (result && typeof result.then === "function")
        throw new Error(
          "Network operations cannot run inside a database transaction",
        );
      this.connection.exec("RELEASE " + name);
      return result;
    } catch (error) {
      this.connection.exec("ROLLBACK TO " + name);
      this.connection.exec("RELEASE " + name);
      throw error;
    } finally {
      this.depth--;
    }
  }
  save(record) {
    if (!(record instanceof DataRecord)) {
      this.connection
        .prepare("INSERT OR REPLACE INTO monline_meta VALUES (?,?)")
        .run("settings", JSON.stringify(record));
      return;
    }
    return this.runInTransaction(() => {
      const collection = record.collection(),
        isNew = !record._original;
      if (collection.name === "subscriptions")
        record.set("name", normalizeSubscriptionName(record.get("name")));
      if (!record.id) record.id = newId();
      if (!/^[a-z0-9]{15}$/.test(record.id))
        throw new BadRequestError("Invalid record ID");
      if (collection.names.has("updated")) record.set("updated", stamp());
      if (
        isNew &&
        collection.names.has("created") &&
        !record.getString("created")
      )
        record.set("created", stamp());
      this.emit(isNew ? "create" : "update", record, () => {
        this.validate(record);
        const fields = [],
          values = [];
        for (const field of collection.fields) {
          if (!Object.hasOwn(record._values, field.name)) continue;
          let value = record._values[field.name];
          if (field.type === "file" && value && typeof value === "object") {
            const bytes = Buffer.from(value.bytes || value.reader?.bytes || []);
            if (
              !bytes.length ||
              bytes.length >
                Math.min(field.maxSize || 12 * 1024 * 1024, 12 * 1024 * 1024)
            )
              throw new BadRequestError(
                "File is empty or exceeds the upload limit",
              );
            const filename =
              crypto.randomBytes(8).toString("hex") +
              "_" +
              path
                .basename(value.name || "file")
                .replace(/[^\p{L}\p{N}._-]/gu, "_")
                .slice(-120);
            const folder = path.join(
              this.directory,
              "storage",
              collection.name,
              record.id,
            );
            fs.mkdirSync(folder, { recursive: true });
            fs.writeFileSync(path.join(folder, filename), bytes, {
              mode: 0o600,
            });
            value = filename;
            record.set(field.name, filename);
          }
          if (field.type === "bool")
            value = value === true || value === 1 || value === "true" ? 1 : 0;
          if (field.type === "number") {
            value = Number(value ?? 0);
            if (!Number.isFinite(value))
              throw new BadRequestError("Invalid number: " + field.name);
          }
          if (field.type === "json")
            value =
              value == null
                ? null
                : typeof value === "string"
                  ? value
                  : JSON.stringify(value);
          if (value == null && field.type !== "json") value = "";
          fields.push(field.name);
          values.push(value);
        }
        if (isNew)
          this.connection
            .prepare(
              `INSERT INTO ${identifier(collection.name)} (${fields.map(identifier).join(",")}) VALUES (${fields.map(() => "?").join(",")})`,
            )
            .run(...values);
        else {
          const mutable = fields.filter((name) => name !== "id");
          this.connection
            .prepare(
              `UPDATE ${identifier(collection.name)} SET ${mutable.map((name) => identifier(name) + "=?").join(",")} WHERE id=?`,
            )
            .run(
              ...mutable.map((name) => values[fields.indexOf(name)]),
              record.id,
            );
        }
      });
      if (isNew) this.emit("afterCreate", record);
      if (
        !isNew &&
        collection.name === "users" &&
        ["totp_enabled", "totp_secret"].some(
          (field) => record.get(field) !== record.original().get(field),
        )
      )
        this.connection
          .prepare(
            "DELETE FROM monline_sessions WHERE user_id=? AND purpose='device'",
          )
          .run(record.id);
      if (
        !isNew &&
        collection.name === "users" &&
        record.getString("password") !== record.original().getString("password")
      )
        this.connection
          .prepare("DELETE FROM monline_sessions WHERE user_id=?")
          .run(record.id);
      // Reload SQL defaults without losing transient import flags.
      Object.assign(
        record._values,
        this.connection
          .prepare(`SELECT * FROM ${identifier(collection.name)} WHERE id=?`)
          .get(record.id),
      );
      record._original = { ...record._values };
      return record;
    });
  }
  validate(record) {
    const collection = record.collection(),
      owner = record.getString(
        collection.name === "notification_log" ? "user_id" : "user",
      );
    for (const field of collection.fields) {
      const value = record.get(field.name);
      if (
        field.required &&
        !["id", "number", "bool"].includes(field.type) &&
        field.name !== "id" &&
        !value
      )
        throw new BadRequestError("Required field: " + field.name, {
          [field.name]: { message: "Required" },
        });
      if (
        typeof value === "string" &&
        field.max > 0 &&
        value.length > field.max &&
        field.type !== "password"
      )
        throw new BadRequestError("Field is too long: " + field.name);
      if (field.type === "relation" && value) {
        const related = this.findRecordById(field.collectionId, value);
        if (
          owner &&
          related.collection().names.has("user") &&
          related.getString("user") !== owner
        )
          throw new BadRequestError(
            "Related record belongs to another account",
          );
        if (
          collection.name === "users" &&
          field.name === "main_currency" &&
          related.getString("user") !== record.id
        )
          throw new BadRequestError("Invalid main currency");
      }
      if (
        field.type === "select" &&
        value &&
        field.values?.length &&
        !field.values.includes(value)
      )
        throw new BadRequestError("Invalid choice: " + field.name);
      if (field.type === "date" && value && !Number.isFinite(Date.parse(value)))
        throw new BadRequestError("Invalid date: " + field.name);
    }
    if (collection.name === "subscriptions") {
      if (
        record.getFloat("price") < 0 ||
        record.getFloat("frequency") < 1 ||
        !record.getString("currency") ||
        !record.getString("cycle") ||
        !record.getString("next_payment")
      )
        throw new BadRequestError(
          "Subscription amount, currency, billing cycle and next payment are required",
        );
      const cycle = this.findRecordById("cycles", record.getString("cycle"));
      const reason =
        require("./domain/lib/pure/record-types.js").validateRecordTypeCycle(
          record.getString("record_type"),
          cycle.getString("name"),
        );
      if (reason) throw new BadRequestError(reason);
    }
  }
  delete(record) {
    return this.runInTransaction(() =>
      this.emit("delete", record, () => {
        const name = record.collection().name;
        if (name === "users") {
          for (const entry of schema) {
            const owner =
              entry.name === "notification_log" ? "user_id" : "user";
            if (entry.fields.some((field) => field.name === owner))
              for (const row of this.findRecordsByFilter(
                entry.name,
                `${owner} = {:id}`,
                "",
                0,
                0,
                { id: record.id },
              ))
                this.delete(row);
          }
          this.connection
            .prepare("DELETE FROM monline_sessions WHERE user_id=?")
            .run(record.id);
        } else {
          for (const entry of schema)
            for (const field of entry.fields) {
              if (
                field.type !== "relation" ||
                this.collections.get(field.collectionId)?.name !== name ||
                field.name === "user"
              )
                continue;
              this.connection
                .prepare(
                  `UPDATE ${identifier(entry.name)} SET ${identifier(field.name)}='' WHERE ${identifier(field.name)}=?`,
                )
                .run(record.id);
            }
        }
        this.connection
          .prepare(`DELETE FROM ${identifier(name)} WHERE id=?`)
          .run(record.id);
        // Files remain until explicit cleanup; database rollback must not destroy data.
      }),
    );
  }
  settings() {
    const row = this.connection
      .prepare("SELECT value FROM monline_meta WHERE key=?")
      .get("settings");
    return row
      ? JSON.parse(row.value)
      : {
          smtp: {
            enabled: false,
            host: "",
            port: 587,
            username: "",
            password: "",
            tls: true,
            authMethod: "PLAIN",
            localName: "",
          },
          meta: { senderAddress: "", senderName: "Monline" },
        };
  }
  cleanupFiles() {
    let deleted = 0;
    for (const entry of schema) {
      const fields = entry.fields.filter((field) => field.type === "file");
      if (!fields.length) continue;
      const root = path.join(this.directory, "storage", entry.name);
      if (!fs.existsSync(root)) continue;
      for (const folder of fs.readdirSync(root, { withFileTypes: true })) {
        if (!folder.isDirectory() || !/^[a-z0-9]{15}$/.test(folder.name))
          continue;
        let record = null;
        try {
          record = this.findRecordById(entry.name, folder.name);
        } catch {}
        const referenced = new Set(
          fields.map((field) => record?.getString(field.name)).filter(Boolean),
        );
        for (const file of fs.readdirSync(path.join(root, folder.name), {
          withFileTypes: true,
        })) {
          if (!file.isFile() || referenced.has(file.name)) continue;
          fs.unlinkSync(path.join(root, folder.name, file.name));
          deleted++;
        }
      }
    }
    return deleted;
  }
  newMailClient(smtpOverride) {
    return {
      send: async (message) => {
        const smtp = smtpOverride || this.settings().smtp;
        if (!smtp.enabled) throw new BadRequestError("SMTP is not configured");
        const transport = require("nodemailer").createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.port === 465 && smtp.tls,
          requireTLS: smtp.tls && smtp.port !== 465,
          name: smtp.localName || undefined,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
          authMethod: smtp.authMethod || undefined,
          auth: smtp.username
            ? { user: smtp.username, pass: smtp.password }
            : undefined,
        });
        try {
          await transport.sendMail(message);
        } finally {
          transport.close();
        }
      },
    };
  }
  db() {
    return {
      newQuery: (query) => {
        let params = {};
        const sql = query
          .replace(/\{\{(\w+)\}\}|\[\[(\w+)\]\]/g, (_, a, b) =>
            identifier(a || b),
          )
          .replace(/\{:(\w+)\}/g, ":$1");
        const handle = {
          bind: (values) => {
            params = values;
            return handle;
          },
          execute: () => this.connection.prepare(sql).run(params),
        };
        return handle;
      },
    };
  }
  async backup(target) {
    await backup(this.connection, target);
  }
}
module.exports = { Repository, DataRecord, schema, newId, identifier };
