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
  "/api/statements/check-file",
  (e) => {
    if (!e.auth || e.auth.collection().name !== "users")
      throw new UnauthorizedError();
    const hash = e.requestInfo().body?.file_hash;
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))
      return e.json(400, { error: "statement_invalid_file" });
    const existing = repository.findRecordsByFilter(
      "bank_statements",
      "user = {:owner} && file_hash = {:hash}",
      "",
      1,
      0,
      { owner: e.auth.id, hash },
    );
    return e.json(200, { exists: existing.length > 0 });
  },
  apiLimits.bodyLimit(2048),
);
routerAdd(
  "POST",
  "/api/statements/check-duplicates",
  (e) => {
    if (!e.auth || e.auth.collection().name !== "users")
      throw new UnauthorizedError();
    let draft;
    try {
      draft = require("./lib/bank-statements.js").validate(
        e.requestInfo().body,
      );
    } catch {
      return e.json(400, { error: "statement_invalid_rows" });
    }
    let result;
    let alreadySaved = false;
    repository.runInTransaction((tx) => {
      // Check the document identity before comparing each transaction. The save
      // endpoint rejects this same file too; hundreds of row warnings cannot
      // make a re-upload of an already saved PDF valid.
      const existing = tx.findRecordsByFilter(
        "bank_statements",
        "user = {:owner} && file_hash = {:hash}",
        "",
        1,
        0,
        { owner: e.auth.id, hash: draft.file_hash },
      );
      if (existing.length) {
        alreadySaved = true;
        return;
      }
      result =
        require("./lib/pure/statement-duplicates.js").statementDuplicates(
          draft,
          require("./lib/spending-data.js").loadSpendingData(tx, e.auth.id),
        );
    });
    if (alreadySaved) return e.json(409, { error: "statement_duplicate" });
    return e.json(200, result);
  },
  apiLimits.bodyLimit(2 * 1024 * 1024),
);
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
    const verification = require(
      domainPath + "/lib/statement-checks.js",
    ).inspectAccounting(
      [...data.transactions, ...data.excluded_transactions],
      data.summary,
      data.bank,
      { unresolvedCount: data.unresolved.length },
    );
    if (
      verification.status !== "verified" &&
      e.requestInfo().body.reconciliation_reviewed !== true
    )
      return e.json(400, {
        error: verification.status === "incomplete" ? "statement_totals_unverified" : "statement_totals_mismatch",
        differences: verification.differences,
        verification,
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
        const categoriesCreated = require(
          domainPath + "/lib/statement-categories.js",
        ).ensureStatementCategories(tx, e.auth.id, data);
        const record = new Record(
          tx.findCollectionByNameOrId("bank_statements"),
        );
        record.set("user", e.auth.id);
        for (const name of Object.keys(data)) record.set(name, data[name]);
        tx.save(record);
        result = {
          id: record.id,
          categories_created: categoriesCreated,
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
