const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createGunzip } = require("node:zlib");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const multer = require("multer");
const tar = require("tar");
const { rateLimit } = require("express-rate-limit");
const { schema, identifier } = require("./storage.cjs");
const { BadRequestError, ForbiddenError, HttpError } = require("./errors.cjs");

const FORMAT = "monline-instance-backup";
const UPLOAD_LIMIT = 500 * 1024 * 1024;
const EXPANDED_LIMIT = 2 * 1024 * 1024 * 1024;
// These collections were introduced in v2. A v1 instance backup legitimately
// has none of them; existing v2 backups must still contain them.
const V2_COLLECTIONS = new Set([
  "finance_rows",
  "finance_entries",
  "salary_history",
  "finance_benchmarks",
  "finance_card_transactions",
  "finance_statement_links",
  "merchant_logos",
  "manual_bills",
]);
// Match the additive migrations in Repository. All other columns remain required.
const MIGRATED_COLUMNS = {
  users: ["disabled", "show_currency_code"],
  payment_records: [
    "scheduled_date",
    "statement_sources",
    "name",
    "currency",
    "logo",
    "category",
    "payment_method",
    "payer",
  ],
  subscriptions: [
    "sharing",
    "statement_imported",
    "billing_anchor_day",
    "calendar_history_recovery_passes",
    "calendar_projection_hidden",
  ],
  payment_methods: ["is_main", "finance_card"],
  household: ["is_main", "account", "account_approval"],
  sharing_groups: ["pending_members"],
  bank_statements: ["summary", "unresolved", "excluded_transactions", "tracking_hidden"],
  finance_rows: ["expense_type", "payment_card", "year", "origin_row", "is_deleted", "loan_id"],
  notifications_config: ["ntfy_username", "ntfy_password"],
};

function temporaryDirectory(repository) {
  const folder = path.join(repository.directory, "backups");
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  const work = fs.mkdtempSync(path.join(folder, "work-"));
  fs.chmodSync(work, 0o700);
  return work;
}

function snapshot(repository, destination) {
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  // Keep the database and file snapshot in the same event-loop turn so uploads,
  // deletes and background jobs cannot change one without the other.
  const database = path.join(destination, "monline.db");
  repository.connection.exec(`VACUUM INTO '${database.replace(/'/g, "''")}'`);
  fs.chmodSync(database, 0o600);
  let size = fs.statSync(database).size + 4096;
  let count = 2;
  if (size > EXPANDED_LIMIT)
    throw new BadRequestError(
      "Instance backup exceeds the 2 GiB expanded limit",
    );
  const storage = path.join(repository.directory, "storage");
  if (fs.existsSync(storage)) {
    fs.cpSync(storage, path.join(destination, "storage"), {
      recursive: true,
      filter(source) {
        const stat = fs.lstatSync(source);
        if (!stat.isFile() && !stat.isDirectory())
          throw new BadRequestError(
            "Backup storage contains an unsupported file",
          );
        size += Math.ceil(stat.size / 512) * 512 + 1536;
        if (++count > 100_000 || size > EXPANDED_LIMIT)
          throw new BadRequestError(
            "Instance backup exceeds the 2 GiB expanded limit",
          );
        return true;
      },
    });
  } else fs.mkdirSync(path.join(destination, "storage"));
  fs.writeFileSync(
    path.join(destination, "manifest.json"),
    JSON.stringify({
      format: FORMAT,
      version: 1,
      appVersion: require("../package.json").version,
      createdAt: new Date().toISOString(),
    }),
    { mode: 0o600 },
  );
}

async function packSnapshot(directory, file) {
  await tar.create(
    { cwd: directory, file, gzip: true, portable: true, strict: true },
    ["manifest.json", "monline.db", "storage"],
  );
  fs.chmodSync(file, 0o600);
  if (fs.statSync(file).size > UPLOAD_LIMIT) {
    fs.rmSync(file, { force: true });
    throw new BadRequestError(
      "Instance backup exceeds the 500 MiB archive limit",
    );
  }
}

async function unpack(file, destination) {
  let invalid = false;
  let bytes = 0;
  let entries = 0;
  const seen = new Set();
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      callback(
        bytes > EXPANDED_LIMIT
          ? new BadRequestError("Expanded backup exceeds 2 GiB")
          : null,
        chunk,
      );
    },
  });
  try {
    await pipeline(
      fs.createReadStream(file),
      createGunzip(),
      limiter,
      tar.extract({
        cwd: destination,
        strict: true,
        filter(name, entry) {
          const normalized = name.replace(/\/$/, "");
          const parts = normalized.split("/");
          const key = normalized.normalize("NFC").toLowerCase();
          const directory = entry.type === "Directory";
          const allowed =
            ++entries <= 100_000 &&
            !seen.has(key) &&
            !/[\\:\x00-\x1f]/.test(normalized) &&
            parts.every(
              (part) =>
                part && part !== "." && part !== ".." && !/[. ]$/.test(part),
            ) &&
            (entry.type === "File" || directory) &&
            Number.isSafeInteger(entry.size) &&
            entry.size >= 0 &&
            entry.size <= EXPANDED_LIMIT &&
            (directory
              ? parts[0] === "storage" && parts.length <= 3
              : normalized === "manifest.json" ||
                normalized === "monline.db" ||
                (parts[0] === "storage" && parts.length === 4));
          seen.add(key);
          if (!allowed) invalid = true;
          return allowed;
        },
      }),
    );
    if (invalid) throw new Error("Unsupported archive entry");
    const manifestPath = path.join(destination, "manifest.json");
    if (fs.statSync(manifestPath).size > 16_384)
      throw new Error("Invalid manifest");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (
      manifest.format !== FORMAT ||
      manifest.version !== 1 ||
      !fs.statSync(path.join(destination, "storage")).isDirectory()
    )
      throw new Error("Incompatible backup");
    return manifest;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError("Select a valid Monline .tar.gz instance backup");
  }
}

function validateDatabase(file, { allowV1Schema = false } = {}) {
  let input;
  try {
    const header = Buffer.alloc(16);
    const descriptor = fs.openSync(file, "r");
    try {
      fs.readSync(descriptor, header, 0, 16, 0);
    } finally {
      fs.closeSync(descriptor);
    }
    if (header.toString() !== "SQLite format 3\u0000")
      throw new Error("Invalid database backup");
    input = new DatabaseSync(file, { readOnly: true });
    if (Object.values(input.prepare("PRAGMA quick_check").get())[0] !== "ok")
      throw new Error("Invalid database");
    // Early full backups have no appVersion in their manifest. Treat them as
    // v1 only if no v2 collection exists; never accept a partial v2 schema.
    const tables = new Set(input.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((table) => table.name));
    allowV1Schema = allowV1Schema && ![...V2_COLLECTIONS].some((name) => tables.has(name));
    for (const entry of schema) {
      if (
        entry.name === "sharing_groups" &&
        !input
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='sharing_groups'",
          )
          .get()
      )
        continue;
      const columns = new Set(
        input
          .prepare(`PRAGMA table_info(${identifier(entry.name)})`)
          .all()
          .map((row) => row.name),
      );
      if (
        !columns.size &&
        (["budget_matches", "calendar_moves", "sharing_groups"].includes(entry.name) ||
          (allowV1Schema && V2_COLLECTIONS.has(entry.name)))
      )
        continue;
      if (
        entry.fields.some(
          (field) =>
            !columns.has(field.name) &&
            !MIGRATED_COLUMNS[entry.name]?.includes(field.name),
        )
      )
        throw new Error("Incompatible database");
    }
    // Validate metadata before touching the running instance.
    input.prepare("SELECT key,value FROM monline_meta").all();
    return input;
  } catch {
    input?.close();
    throw new BadRequestError(
      "Invalid or incompatible Monline database backup",
    );
  }
}

function replaceDatabase(repository, input) {
  for (const entry of schema) {
    const columns = new Set(
      input
        .prepare(`PRAGMA table_info(${identifier(entry.name)})`)
        .all()
        .map((column) => column.name),
    );
    const fields = entry.fields
      .map((field) => field.name)
      .filter((field) => columns.has(field));
    repository.connection.exec(`DELETE FROM ${identifier(entry.name)}`);
    if (!fields.length) continue;
    // Omit newly added columns so SQLite applies the current schema defaults,
    // including NOT NULL text/number fields, rather than inserting null.
    const insert = repository.connection.prepare(
      `INSERT INTO ${identifier(entry.name)} (${fields.map(identifier)}) VALUES (${fields.map(() => "?")})`,
    );
    for (const row of input
      .prepare(`SELECT * FROM ${identifier(entry.name)}`)
      .iterate())
      insert.run(...fields.map((field) => row[field]));
  }
  repository.connection.exec(
    "DELETE FROM monline_sessions; DELETE FROM monline_meta",
  );
  const insertMeta = repository.connection.prepare(
    "INSERT INTO monline_meta VALUES (?,?)",
  );
  for (const row of input.prepare("SELECT key,value FROM monline_meta").all())
    insertMeta.run(row.key, row.value);
  repository.repairStatementImportMarkers();
  repository.repairBillingAnchorDays();
  repository.repairMainPaymentMethods();
  repository.repairMainHousehold();
  repository.repairSelfHousehold();
  repository.repairFinanceRowTypes();
  require("./domain/lib/calendar-history-recovery.js").recoverCalendarHistory(
    repository,
    require("./domain/lib/date-helpers.js").formatLocalDate(new Date()),
  );
}

function registerBackupApi(app, repository, auth) {
  let busy = false;
  const uploadDirectories = new WeakMap();
  const backupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many backup requests. Please try again later." },
  });
  const requireEmptySetup = () => {
    if (repository.countRecords("users") > 0)
      throw new HttpError(409, "setup_already_complete");
  };
  const firstInstall = (req, res, next) => {
    try {
      requireEmptySetup();
      next();
    } catch (error) {
      next(error);
    }
  };
  const admin = (req, res, next) => {
    if (!auth.isAdmin(req.user))
      return next(new ForbiddenError("Admin access required"));
    next();
  };
  app.post("/api/db/backup", admin, backupLimiter, async (req, res, next) => {
    const password = req.body?.password;
    if (typeof password !== "string" || !password)
      return res.status(400).json({ message: "transfer_password_required" });
    if (!(await auth.passwordValid(password, req.user.getString("password"))))
      return res.status(403).json({ message: "transfer_invalid_password" });
    if (repository.databaseOperation)
      return res
        .status(409)
        .json({ message: "A database operation is already in progress" });
    const work = temporaryDirectory(repository);
    try {
      const source = path.join(work, "snapshot");
      snapshot(repository, source);
      const archive = path.join(work, "backup.tar.gz");
      await packSnapshot(source, archive);
      res.download(
        archive,
        `monline-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`,
        (error) => {
          fs.rmSync(work, { recursive: true, force: true });
          if (error) next(error);
        },
      );
    } catch (error) {
      fs.rmSync(work, { recursive: true, force: true });
      throw error;
    }
  });
  const upload = multer({
    storage: multer.diskStorage({
      destination(req, file, callback) {
        try {
          const work = temporaryDirectory(repository);
          uploadDirectories.set(req, work);
          callback(null, work);
        } catch (error) {
          callback(error);
        }
      },
      filename(req, file, callback) {
        callback(null, "upload");
      },
    }),
    limits: { fileSize: UPLOAD_LIMIT, files: 1, fields: 0, parts: 2 },
  }).single("file");
  const registerRestore = (route, guard, setupOnly = false) =>
    app.post(
      route,
      guard,
      backupLimiter,
      (req, res, next) => {
        if (busy || repository.databaseOperation)
          return res.status(409).json({
            message: setupOnly
              ? "setup_restore_busy"
              : "A restore is already in progress",
          });
        busy = true;
        repository.databaseOperation = "restore";
        upload(req, res, (error) => {
          if (!error) return next();
          busy = false;
          repository.databaseOperation = null;
          const work = uploadDirectories.get(req);
          if (work) fs.rmSync(work, { recursive: true, force: true });
          uploadDirectories.delete(req);
          next(error);
        });
      },
      async (req, res) => {
        let input;
        let preserveWork = false;
        const work = uploadDirectories.get(req);
        try {
          if (!req.file || !work)
            throw new BadRequestError("Select a Monline backup");
          // Multer always writes this server-selected name in a private temp directory.
          // Never use a path or original filename supplied by the upload metadata.
          const uploadPath = path.join(work, "upload");
          const header = Buffer.alloc(16);
          const descriptor = fs.openSync(uploadPath, "r");
          try {
            fs.readSync(descriptor, header, 0, 16, 0);
          } finally {
            fs.closeSync(descriptor);
          }
          const legacy = header.toString() === "SQLite format 3\u0000";
          if (setupOnly && legacy)
            throw new BadRequestError("setup_restore_full_required");
          const extracted = path.join(work, "extracted");
          fs.mkdirSync(extracted, { mode: 0o700 });
          const manifest = legacy ? null : await unpack(uploadPath, extracted);
          input = validateDatabase(
            legacy ? uploadPath : path.join(extracted, "monline.db"),
            {
              allowV1Schema:
                legacy || manifest.appVersion == null ||
                /^1\.\d+\.\d+(?:-[\da-zA-Z.-]+)?(?:\+[\da-zA-Z.-]+)?$/.test(
                  manifest.appVersion,
                ),
            },
          );
          if (setupOnly) {
            requireEmptySetup();
            if (!input.prepare("SELECT 1 FROM users LIMIT 1").get())
              throw new BadRequestError("setup_restore_empty");
          }

          const safety = path.join(work, "before");
          snapshot(repository, safety);
          const safetyFile = path.join(
            repository.directory,
            "backups",
            `before-restore-${Date.now()}.tar.gz`,
          );
          await packSnapshot(safety, safetyFile);

          const storage = path.join(repository.directory, "storage");
          const previous = path.join(work, "previous-storage");
          let moved = false;
          let installed = false;
          try {
            repository.runInTransaction(() => {
              // Extraction and compression yield. Never overwrite an account
              // created by another request while the initial backup was uploading.
              if (setupOnly) requireEmptySetup();
              replaceDatabase(repository, input);
              if (!legacy) {
                if (fs.existsSync(storage)) {
                  fs.renameSync(storage, previous);
                  moved = true;
                }
                fs.renameSync(path.join(extracted, "storage"), storage);
                installed = true;
              }
            });
          } catch (error) {
            try {
              if (installed)
                fs.rmSync(storage, { recursive: true, force: true });
              if (moved) fs.renameSync(previous, storage);
            } catch (rollbackError) {
              // Retain the original storage as well as the safety archive if the
              // filesystem prevents rollback; never delete its only working copy.
              preserveWork = true;
              throw rollbackError;
            }
            throw error;
          }
          repository.cache.clear();
          res.clearCookie("monline_session");
          res.clearCookie("monline_device");
          res.json({ message: "Restore completed. Please sign in again." });
        } finally {
          input?.close();
          if (work && !preserveWork)
            fs.rmSync(work, { recursive: true, force: true });
          uploadDirectories.delete(req);
          busy = false;
          repository.databaseOperation = null;
        }
      },
    );
  registerRestore("/api/db/restore", admin);
  registerRestore("/api/auth/setup/restore", firstInstall, true);
}

module.exports = { registerBackupApi };
