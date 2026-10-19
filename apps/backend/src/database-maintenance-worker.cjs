const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const { parentPort, workerData } = require("node:worker_threads");

function fileSize(file) {
  try {
    return fs.statSync(file).size;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

function statistics(database, file) {
  const pageSize = Number(database.prepare("PRAGMA page_size").get().page_size);
  const pages = Number(database.prepare("PRAGMA page_count").get().page_count);
  const freePages = Number(
    database.prepare("PRAGMA freelist_count").get().freelist_count,
  );
  return {
    databaseBytes: fileSize(file),
    walBytes: fileSize(file + "-wal"),
    logicalBytes: pages * pageSize,
    freeBytes: freePages * pageSize,
  };
}

function checkIntegrity(database) {
  // Keep both checks on the same snapshot even if normal requests are writing.
  database.exec("BEGIN");
  try {
    const errors = database.prepare("PRAGMA integrity_check(20)").all();
    const structural =
      errors.length === 1 && Object.values(errors[0])[0] === "ok";
    const foreignKeyError = database.prepare("PRAGMA foreign_key_check").get();
    return structural && !foreignKeyError;
  } finally {
    database.exec("ROLLBACK");
  }
}

async function run() {
  const { directory, action } = workerData;
  const file = path.join(directory, "monline.db");
  const database = new DatabaseSync(file, { readOnly: action === "check" });
  let safetyBackup = null;
  try {
    database.exec("PRAGMA busy_timeout=5000");
    const before = statistics(database, file);
    if (!checkIntegrity(database))
      return { ok: false, before, after: before, safetyBackup };
    if (action === "check")
      return { ok: true, before, after: before, safetyBackup };
    if (action !== "optimize")
      throw new Error("Unsupported maintenance action");

    const disk = fs.statfsSync(directory);
    // VACUUM needs working space; also reserve space for the safety backup.
    if (
      Number(disk.bavail) * Number(disk.bsize) <
      before.logicalBytes * 3 + 16 * 1024 * 1024
    )
      return { error: "database_maintenance_disk_space" };
    const folder = path.join(directory, "backups");
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    safetyBackup = `before-maintenance-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.db`;
    const target = path.join(folder, safetyBackup);
    // Open privately before SQLite writes any credentials to the backup.
    fs.closeSync(fs.openSync(target, "wx", 0o600));
    try {
      await backup(database, target);
    } catch (error) {
      fs.rmSync(target, { force: true });
      throw error;
    }

    database.exec("VACUUM; PRAGMA optimize=0x10012;");
    const checkpoint = database
      .prepare("PRAGMA wal_checkpoint(TRUNCATE)")
      .get();
    const ok = checkIntegrity(database);
    return {
      ok,
      before,
      after: statistics(database, file),
      safetyBackup,
      checkpointBusy: Number(checkpoint.busy) !== 0,
    };
  } catch (error) {
    // Return only fixed error codes; SQL, user data and filesystem paths stay private.
    return {
      error:
        error.errcode === 5 || error.errcode === 6
          ? "database_maintenance_busy"
          : "database_maintenance_failed",
      safetyBackup,
    };
  } finally {
    database.close();
  }
}

run().then(
  (result) => parentPort.postMessage(result),
  () => parentPort.postMessage({ error: "database_maintenance_failed" }),
);
