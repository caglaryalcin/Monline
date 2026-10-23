const {
  Record,
  NotFoundError,
  UnauthorizedError,
  apiLimits,
  repository,
  routerAdd,
} = require("../runtime.cjs");
const domainPath = __dirname;
routerAdd(
  "POST",
  "/api/statements/delete-all",
  (e) => {
    if (!e.auth || e.auth.collection().name !== "users")
      throw new UnauthorizedError();
    if (e.requestInfo().body.confirmed !== true)
      return e.json(400, { error: "confirmation_required" });
    const deleted = repository.runInTransaction((tx) => {
      const statements = tx.findRecordsByFilter(
        "bank_statements",
        "user = {:owner}",
        "",
        0,
        0,
        { owner: e.auth.id },
      );
      for (const statement of statements) tx.delete(statement);
      return statements.length;
    });
    return e.json(200, { deleted });
  },
  apiLimits.bodyLimit(2048),
);

routerAdd(
  "POST",
  "/api/statements/{id}/import",
  (e) => {
    if (!e.auth || e.auth.collection().name !== "users")
      throw new UnauthorizedError();
    const statement = repository.findRecordById(
      "bank_statements",
      e.request.pathValue("id"),
    );
    if (statement.getString("user") !== e.auth.id) throw new NotFoundError();
    try {
      const result = require(
        domainPath + "/lib/statement-import.js",
      ).importStatement(repository, e.auth.id, statement, e.requestInfo().body);
      return e.json(200, result);
    } catch (error) {
      const code = String(error.message || "");
      return e.json(400, {
        error: /^(statement_import_|historical_invalid_|backfill_)/.test(code)
          ? code
          : "statement_import_failed",
        ...(code === "statement_import_conflict" &&
        Array.isArray(error.conflicts)
          ? { conflicts: error.conflicts }
          : {}),
      });
    }
  },
  apiLimits.bodyLimit(2 * 1024 * 1024),
);
routerAdd("GET", "/api/project-info", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  const repository = require(domainPath + "/lib/project.js").repository();
  return e.json(200, {
    repository,
  });
});
routerAdd(
  "POST",
  "/api/statements",
  (e) => {
    if (!e.auth || e.auth.collection().name !== "users")
      throw new UnauthorizedError();
    let data;
    try {
      data = require(domainPath + "/lib/bank-statements.js").validate(
        e.requestInfo().body,
      );
    } catch (_) {
      return e.json(400, {
        error: "statement_invalid_rows",
      });
    }
    if (
      data.transactions.some(
        (row) =>
          !row.subscription_service ||
          !row.subscription_match ||
          row.kind !== "charge",
      )
    )
      return e.json(400, {
        error: "statement_online_only",
      });
    try {
      let result;
      repository.runInTransaction((tx) => {
        const existing = tx.findRecordsByFilter(
          "bank_statements",
          "user = {:owner} && file_hash = {:hash}",
          "",
          1,
          0,
          {
            owner: e.auth.id,
            hash: data.file_hash,
          },
        );
        if (existing.length) throw new Error("statement_duplicate");
        const record = new Record(
          tx.findCollectionByNameOrId("bank_statements"),
        );
        record.set("user", e.auth.id);
        for (const name of Object.keys(data)) record.set(name, data[name]);
        tx.save(record);
        result = {
          id: record.id,
        };
      });
      return e.json(201, result);
    } catch (error) {
      return e.json(error.message === "statement_duplicate" ? 409 : 400, {
        error:
          error.message === "statement_duplicate"
            ? "statement_duplicate"
            : "statement_save_failed",
      });
    }
  },
  apiLimits.bodyLimit(2 * 1024 * 1024),
);
