const {
  UnauthorizedError,
  apiLimits,
  repository,
  routerAdd,
} = require("../runtime.cjs");
const domainPath = __dirname;
routerAdd("GET", "/api/account/export", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  const backup = require(domainPath + "/lib/account-backup.js");
  e.response.header().set("Cache-Control", "no-store");
  try {
    return e.json(200, backup.exportAccount(repository, e.auth.id));
  } catch (_) {
    return e.json(500, {
      error: "transfer_export_failed",
    });
  }
});
routerAdd(
  "POST",
  "/api/account/import",
  (e) => {
    if (!e.auth || e.auth.collection().name !== "users")
      throw new UnauthorizedError();
    const backup = require(domainPath + "/lib/account-backup.js");
    const body = e.requestInfo().body;
    try {
      const result = backup.importAccount(
        repository,
        e.auth.id,
        body.backup,
        body.restoreSettings === true,
      );
      return e.json(200, result);
    } catch (error) {
      const key = ["transfer_invalid_backup", "transfer_too_large"].includes(
        error.message,
      )
        ? error.message
        : "transfer_import_failed";
      return e.json(400, {
        error: key,
      });
    }
  },
  apiLimits.bodyLimit(100 * 1024 * 1024),
);
