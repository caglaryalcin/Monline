const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Repository } = require("../../src/storage.cjs");

it("upgrades old household data and preserves the selected default after restarting", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "monline-household-"),
  );
  let repository;
  try {
    repository = new Repository(directory);
    repository.connection.exec("ALTER TABLE household DROP COLUMN is_main");
    const insert = repository.connection.prepare(
      "INSERT INTO household(id,user,name) VALUES(?,?,?)",
    );
    insert.run("person000000001", "owner0000000001", "Alpha");
    insert.run("person000000002", "owner0000000001", "Zulu");
    insert.run("person000000003", "owner0000000002", "Other person");
    repository.connection.close();
    repository = new Repository(directory);
    expect(
      repository.connection
        .prepare("SELECT id FROM household WHERE is_main=1 ORDER BY id")
        .all()
        .map((member) => member.id),
    ).toEqual(["person000000001", "person000000003"]);
    repository.connection.exec(
      "UPDATE household SET is_main=CASE WHEN id='person000000002' THEN 1 ELSE 0 END WHERE user='owner0000000001'",
    );
    repository.connection.close();
    repository = new Repository(directory);
    expect(
      repository.connection
        .prepare("SELECT id FROM household WHERE user=? AND is_main=1")
        .get("owner0000000001").id,
    ).toBe("person000000002");
  } finally {
    try {
      repository?.connection.close();
    } catch {}
    if (
      path
        .resolve(directory)
        .startsWith(path.resolve(os.tmpdir()) + path.sep + "monline-household-")
    )
      fs.rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
  }
});
