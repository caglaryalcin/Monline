const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const { rateLimit } = require("express-rate-limit");
const { migrateLegacy } = require("./migrate.cjs");
const { Repository, DataRecord } = require("./storage.cjs");
const { createAuth } = require("./auth.cjs");
const { registerDataApi } = require("./data-api.cjs");
const { registerBackupApi } = require("./backups.cjs");
const {
  registerDatabaseMaintenanceApi,
} = require("./database-maintenance.cjs");
const { registerOidc } = require("./oidc.cjs");
const { registerSetupApi } = require("./setup.cjs");

async function main() {
  const directory =
    process.env.MONLINE_DATA_DIR || path.join(__dirname, "../monline_data");
  const legacy =
    process.env.MONLINE_LEGACY_DATA_DIR || path.join(__dirname, "../pb_data");
  await migrateLegacy(directory, legacy);
  const repository = new Repository(directory);
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  const auth = createAuth(repository);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
    });
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (req, res) => res.json({ code: 200, status: "ok" }));
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many requests. Please try again later." },
    }),
  );
  app.use(auth.middleware);
  app.use(
    "/api/account/import",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many import requests. Please try again later." },
    }),
    (req, res, next) => {
      try {
        auth.requireUser(req);
        express.json({ limit: "100mb" })(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  registerBackupApi(app, repository, auth);
  registerDatabaseMaintenanceApi(app, repository, auth);
  const uploads = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 64 * 1024 * 1024,
      files: 3,
      fields: 100,
      fieldSize: 1024 * 1024,
      parts: 110,
    },
  }).any();
  app.use((req, res, next) => {
    if (!req.is("multipart/form-data")) return next();
    try {
      auth.requireUser(req);
      uploads(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  require("./runtime.cjs").configure(app, repository, auth);
  // Each domain module registers Monline routes, lifecycle rules or scheduled jobs.
  // The pure money/date helpers remain shared with existing application behavior.
  const domain = path.join(__dirname, "domain");
  for (const entry of fs
    .readdirSync(domain)
    .filter((name) => name.endsWith(".js"))
    .sort())
    require(path.join(domain, entry));
  seed(repository);
  require("./subscription-names.cjs").normalizeStoredSubscriptionNames(
    repository,
  );
  const repairedSchedules =
    require("./domain/lib/statement-schedule.js").repairImportedSchedules(
      repository,
      require("./domain/lib/date-helpers.js").formatLocalDate(new Date()),
    );
  if (repairedSchedules)
    console.info(
      `[Monline] Corrected ${repairedSchedules} imported subscription schedule(s)`,
    );
  registerSetupApi(app, repository, auth);
  auth.register(app);
  registerOidc(app, repository, auth);
  registerDataApi(app, repository, auth);
  app.use("/api", (req, res) =>
    res.status(404).json({ message: "Endpoint not found" }),
  );
  const publicDirectory = path.join(__dirname, "../public");
  app.use(express.static(publicDirectory, { index: false, maxAge: "1h" }));
  app.get("/{*path}", (req, res) => {
    const index = path.join(publicDirectory, "index.html");
    if (fs.existsSync(index))
      res.set("Cache-Control", "no-store").sendFile(index);
    else
      res
        .status(404)
        .type("text")
        .send(
          "Monline API is running. Open the Vite development server on port 5173.",
        );
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status =
      error.status ||
      (error.code === "LIMIT_FILE_SIZE"
        ? 413
        : error.code?.startsWith("SQLITE_CONSTRAINT") ||
            String(error.message).includes("UNIQUE constraint failed")
          ? 400
          : 500);
    // Do not send SQL, uploaded statements, credentials or provider responses to logs.
    if (status === 500)
      console.error(
        "[Monline] Request failed:",
        req.method,
        req.path,
        error.name,
      );
    res.status(status).json({
      message:
        status === 500 ? "An unexpected server error occurred" : error.message,
      data: error.data || {},
    });
  });
  const port = Number(process.env.MONLINE_PORT || 8080),
    host = process.env.MONLINE_HOST || "127.0.0.1";
  const server = app.listen(port, host, () =>
    console.info(`[Monline] Server listening on http://${host}:${port}`),
  );
  const shutdown = () =>
    server.close(() => {
      repository.connection.close();
      process.exit(0);
    });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
function seed(repository) {
  repository.runInTransaction(() => {
    if (!repository.countRecords("cycles")) {
      for (const name of ["Daily", "Weekly", "Monthly", "Yearly", "One-Time"]) {
        const cycle = new DataRecord(
          repository.findCollectionByNameOrId("cycles"),
        );
        cycle.set("name", name);
        repository.save(cycle);
        const count =
          name === "Monthly"
            ? 12
            : name === "Yearly"
              ? 10
              : name === "Weekly"
                ? 4
                : name === "Daily"
                  ? 3
                  : 1;
        for (let value = 1; value <= count; value++) {
          const frequency = new DataRecord(
            repository.findCollectionByNameOrId("frequencies"),
          );
          frequency.set("cycle", cycle.id);
          frequency.set("value", value);
          frequency.set(
            "name",
            name === "One-Time" ? "Once" : `${name} × ${value}`,
          );
          repository.save(frequency);
        }
      }
    }
    if (!repository.countRecords("admin_settings")) {
      const settings = new DataRecord(
        repository.findCollectionByNameOrId("admin_settings"),
      );
      settings.set("open_registrations", false);
      settings.set("latest_version", "1.0.8");
      settings.set("smtp_port", 587);
      repository.save(settings);
    }
  });
}
main().catch((error) => {
  console.error("[Monline] Startup failed:", error.message);
  process.exitCode = 1;
});
