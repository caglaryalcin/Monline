const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync, backup } = require("node:sqlite");
const schema = require("./schema.json");
const quote = (name) => '"' + name.replace(/"/g, '""') + '"';

// Copy application tables and assets to a separate directory. The source is
// opened read-only; its database, superusers, sessions and files are never changed.
async function migrateLegacy(directory, legacyDirectory) {
  const target = path.resolve(directory),
    source = path.resolve(legacyDirectory);
  const destination = path.join(target, "monline.db");
  if (
    fs.existsSync(destination) ||
    !fs.existsSync(path.join(source, "data.db"))
  )
    return;
  if (source === target)
    throw new Error(
      "Legacy data and Monline data must use separate directories",
    );
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  const snapshot = path.join(target, "legacy-snapshot.db");
  const old = new DatabaseSync(path.join(source, "data.db"), {
    readOnly: true,
  });
  try {
    await backup(old, snapshot);
  } finally {
    old.close();
  }
  const input = new DatabaseSync(snapshot, { readOnly: true });
  const staging = path.join(target, "migration.db");
  fs.rmSync(staging, { force: true });
  const output = new DatabaseSync(staging);
  try {
    output.exec("BEGIN");
    for (const entry of schema) {
      output.exec(entry.sql);
      const existing = new Set(
        input
          .prepare(`PRAGMA table_info(${quote(entry.name)})`)
          .all()
          .map((field) => field.name),
      );
      if (!existing.size) continue;
      const fields = entry.fields
        .map((field) => field.name)
        .filter((name) => existing.has(name));
      const insert = output.prepare(
        `INSERT INTO ${quote(entry.name)} (${fields.map(quote)}) VALUES (${fields.map(() => "?")})`,
      );
      for (const record of input
        .prepare(`SELECT ${fields.map(quote)} FROM ${quote(entry.name)}`)
        .iterate())
        insert.run(...fields.map((field) => record[field]));
      const fileFields = entry.fields.filter((field) => field.type === "file");
      if (fileFields.length) {
        const folder = path.join(source, "storage", entry.legacyId);
        if (fs.existsSync(folder))
          fs.cpSync(folder, path.join(target, "storage", entry.name), {
            recursive: true,
            errorOnExist: false,
          });
      }
    }
    output.exec(
      "CREATE TABLE monline_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL)",
    );
    // SMTP settings were stored separately from account records. Preserve them
    // when readable; encrypted legacy settings require the old encryption key.
    const row = input
      .prepare("SELECT value FROM _params WHERE id='settings'")
      .get();
    if (row) {
      let settings;
      try {
        settings = JSON.parse(row.value);
      } catch {
        settings = row.value;
      }
      if (typeof settings === "string") {
        const key =
          process.env.MONLINE_LEGACY_KEY || process.env.PB_ENCRYPTION_KEY;
        if (!key)
          throw new Error(
            "Legacy settings are encrypted. Supply MONLINE_LEGACY_KEY once for migration.",
          );
        const crypto = require("node:crypto");
        const bytes = Buffer.from(settings, "base64");
        const decipher = crypto.createDecipheriv(
          "aes-256-gcm",
          Buffer.from(key),
          bytes.subarray(0, 12),
        );
        decipher.setAuthTag(bytes.subarray(-16));
        settings = JSON.parse(
          Buffer.concat([
            decipher.update(bytes.subarray(12, -16)),
            decipher.final(),
          ]).toString(),
        );
      }
      if (settings?.smtp && settings?.meta)
        output
          .prepare("INSERT INTO monline_meta VALUES (?,?)")
          .run(
            "settings",
            JSON.stringify({ smtp: settings.smtp, meta: settings.meta }),
          );
    }
    output
      .prepare("INSERT INTO monline_meta VALUES (?,?)")
      .run("legacy_migrated_at", new Date().toISOString());
    output.exec("COMMIT");
  } catch (error) {
    try {
      output.exec("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    output.close();
    input.close();
  }
  fs.renameSync(staging, destination);
  console.info(
    "[Monline] Existing accounts and files copied. Legacy data remains unchanged.",
  );
}
module.exports = { migrateLegacy };
