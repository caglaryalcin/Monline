const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { Repository, DataRecord, schema } = require("../../src/storage.cjs");

it("upgrades an existing notification config without losing settings and persists ntfy credentials across restarts", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "monline-ntfy-migration-"),
  );
  let connection;
  try {
    connection = new DatabaseSync(path.join(directory, "monline.db"));
    const oldSQL = schema
      .find((entry) => entry.name === "notifications_config")
      .sql.replace(
        /, "ntfy_(?:username|password)" TEXT NOT NULL DEFAULT ''/g,
        "",
      );
    connection.exec(oldSQL);
    connection
      .prepare(
        "INSERT INTO notifications_config (id,user,ntfy_enabled,ntfy_url,ntfy_topic,ntfy_auth_token,telegram_bot_token) VALUES (?,?,?,?,?,?,?)",
      )
      .run(
        "config000000001",
        "owner1",
        1,
        "https://ntfy.example.test",
        "private-topic",
        "tk_preserved",
        "telegram-preserved",
      );
    connection.close();
    connection = undefined;
    let repository = new Repository(directory);
    connection = repository.connection;
    for (const id of ["owner1", "owner2"])
      connection
        .prepare("INSERT INTO users (id,email) VALUES (?,?)")
        .run(id, id + "@example.test");
    const record = repository.findRecordById(
      "notifications_config",
      "config000000001",
    );
    expect(record.getString("ntfy_username")).toBe("");
    expect(record.getString("ntfy_password")).toBe("");
    expect(record.getString("ntfy_auth_token")).toBe("tk_preserved");
    expect(record.getString("telegram_bot_token")).toBe("telegram-preserved");
    record.set("ntfy_username", "demo");
    record.set("ntfy_password", "demo-password");
    repository.save(record);
    connection.close();
    connection = undefined;
    repository = new Repository(directory);
    connection = repository.connection;
    expect(
      repository
        .findRecordById("notifications_config", "config000000001")
        .publicExport(),
    ).toMatchObject({
      user: "owner1",
      ntfy_enabled: true,
      ntfy_url: "https://ntfy.example.test",
      ntfy_topic: "private-topic",
      ntfy_username: "demo",
      ntfy_password: "demo-password",
      ntfy_auth_token: "tk_preserved",
      telegram_bot_token: "telegram-preserved",
    });
    const fresh = new DataRecord(
      repository.findCollectionByNameOrId("notifications_config"),
    );
    fresh.set("user", "owner2");
    fresh.set("ntfy_username", "new-user");
    fresh.set("ntfy_password", "new-password");
    repository.save(fresh);
    expect(
      repository
        .findRecordById("notifications_config", fresh.id)
        .getString("ntfy_password"),
    ).toBe("new-password");
  } finally {
    connection?.close();
    const prefix =
      path.resolve(os.tmpdir()) + path.sep + "monline-ntfy-migration-";
    if (path.resolve(directory).startsWith(prefix))
      fs.rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
  }
});
