const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Repository } = require("../../src/storage.cjs");

it("upgrades legacy databases and identifies statement history without changing dates or amounts", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-origin-"));
  let repository;
  try {
    repository = new Repository(directory);
    const db = repository.connection;
    db.prepare(
      "INSERT INTO subscriptions(id,user,name,start_date,price) VALUES(?,?,?,?,?)",
    ).run("sub000000000001", "owner0000000001", "Chatgpt", "2026-01-06", 5000);
    db.prepare(
      "INSERT INTO subscriptions(id,user,name,start_date) VALUES(?,?,?,?)",
    ).run(
      "sub000000000002",
      "owner0000000002",
      "Manual subscription",
      "2026-01-06",
    );
    db.prepare(
      "INSERT INTO payment_records(id,user,subscription_id,amount,statement_sources) VALUES(?,?,?,?,?)",
    ).run(
      "pay000000000001",
      "owner0000000001",
      "sub000000000001",
      8000,
      JSON.stringify(["[monline-statement:file-hash:row-1]"]),
    );
    // A different user's payment must never mark another account's subscription.
    db.prepare(
      "INSERT INTO payment_records(id,user,subscription_id,amount,statement_sources) VALUES(?,?,?,?,?)",
    ).run(
      "pay000000000002",
      "owner0000000001",
      "sub000000000002",
      100,
      JSON.stringify(["[monline-statement:file-hash:row-2]"]),
    );
    db.exec("ALTER TABLE subscriptions DROP COLUMN statement_imported");
    db.exec(
      "UPDATE subscriptions SET next_payment='2026-01-31' WHERE id='sub000000000001'; ALTER TABLE subscriptions DROP COLUMN billing_anchor_day",
    );
    db.exec(`INSERT INTO payment_methods(id,user,name) VALUES
      ('method000000001','owner0000000001','Visa'),('method000000002','owner0000000001','Mastercard');
      ALTER TABLE payment_methods DROP COLUMN is_main;
      INSERT INTO categories(id,user,name,translation_key) VALUES
      ('cat000000000001','owner0000000001','Food','food'),('cat000000000002','owner0000000001','Custom Food',''),
      ('cat000000000003','owner0000000001','Shopping','shopping');
      UPDATE subscriptions SET category='cat000000000001' WHERE id='sub000000000001';`);
    db.close();
    repository = new Repository(directory);
    expect(
      repository.findRecordsByFilter("payment_methods", "is_main = true"),
    ).toHaveLength(1);
    expect(
      repository.findRecordsByFilter("categories").map((record) => record.id),
    ).toEqual(["cat000000000001", "cat000000000002", "cat000000000003"]);
    const imported = repository.findRecordById(
      "subscriptions",
      "sub000000000001",
    );
    expect(imported.getBool("statement_imported")).toBe(true);
    expect(imported.getFloat("billing_anchor_day")).toBe(31);
    expect(imported.getString("start_date")).toBe("2026-01-06");
    expect(imported.getFloat("price")).toBe(5000);
    expect(imported.getString("category")).toBe("cat000000000001");
    expect(
      repository
        .findRecordById("payment_records", "pay000000000001")
        .getFloat("amount"),
    ).toBe(8000);
    expect(
      repository
        .findRecordById("subscriptions", "sub000000000002")
        .getBool("statement_imported"),
    ).toBe(false);
  } finally {
    repository?.connection.close();
    if (
      path
        .resolve(directory)
        .startsWith(path.resolve(os.tmpdir()) + path.sep + "monline-origin-")
    )
      fs.rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
  }
});
