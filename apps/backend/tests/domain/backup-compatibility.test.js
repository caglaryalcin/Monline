const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const tar = require("tar");
const { registerBackupApi } = require("../../src/backups.cjs");
const { Repository } = require("../../src/storage.cjs");

it("restores older full archives with payment history into a new installation using defaults for new columns", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-compat-"));
  const source = new Repository(path.join(directory, "source"));
  const target = new Repository(path.join(directory, "target"));
  let server;
  try {
    source.connection.exec(`
      INSERT INTO users (id,email) VALUES ('aaaaaaaaaaaaaaa','backup@example.test');
      INSERT INTO payment_records (id,user,subscription_id,due_date,paid_at,amount)
        VALUES ('bbbbbbbbbbbbbbb','aaaaaaaaaaaaaaa','ccccccccccccccc','2026-10-01','2026-10-01T12:00:00Z',69.9);
      ALTER TABLE payment_records DROP COLUMN name;
      ALTER TABLE payment_records DROP COLUMN currency;
      ALTER TABLE payment_records DROP COLUMN statement_sources;
      ALTER TABLE payment_records DROP COLUMN logo;
      ALTER TABLE payment_records DROP COLUMN category;
      ALTER TABLE payment_records DROP COLUMN payer;
      ALTER TABLE payment_records DROP COLUMN payment_method;
      ALTER TABLE subscriptions DROP COLUMN statement_imported;
      ALTER TABLE payment_methods DROP COLUMN is_main;
      ALTER TABLE household DROP COLUMN is_main;
    `);
    const snapshot = path.join(directory, "snapshot");
    fs.mkdirSync(
      path.join(snapshot, "storage", "subscriptions", "ccccccccccccccc"),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(
        snapshot,
        "storage",
        "subscriptions",
        "ccccccccccccccc",
        "attachment.txt",
      ),
      "original attachment",
    );
    fs.writeFileSync(
      path.join(snapshot, "manifest.json"),
      JSON.stringify({ format: "monline-instance-backup", version: 1 }),
    );
    source.connection.exec(
      `VACUUM INTO '${path.join(snapshot, "monline.db").replace(/'/g, "''")}'`,
    );
    const archive = path.join(directory, "older.tar.gz");
    await tar.create({ cwd: snapshot, file: archive, gzip: true }, [
      "manifest.json",
      "monline.db",
      "storage",
    ]);
    const app = express();
    app.use(express.json());
    registerBackupApi(app, target, { isAdmin: () => false });
    app.use((error, req, res, next) => {
      res.status(error.status || 500).json({ message: error.message });
    });
    server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const body = new FormData();
    body.set("file", new Blob([fs.readFileSync(archive)]), "older.tar.gz");
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/setup/restore`,
      { method: "POST", body },
    );
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    expect(target.countRecords("users")).toBe(1);
    expect(
      target
        .findRecordById("payment_records", "bbbbbbbbbbbbbbb")
        .publicExport(),
    ).toMatchObject({
      amount: 69.9,
      subscription_id: "ccccccccccccccc",
      name: "",
      currency: "",
      statement_sources: null,
    });
    expect(
      fs.readFileSync(
        path.join(
          target.directory,
          "storage",
          "subscriptions",
          "ccccccccccccccc",
          "attachment.txt",
        ),
        "utf8",
      ),
    ).toBe("original attachment");
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    source.connection.close();
    target.connection.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
