const {
  UnauthorizedError,
  apiLimits,
  repository,
  routerAdd,
} = require("../runtime.cjs");
const transfer = require("./lib/scoped-transfer.js");
for (const scope of ["calendar", "subscriptions"]) {
  routerAdd("GET", `/api/transfer/${scope}/export`, (e) => {
    if (!e.auth || e.auth.collection().name !== "users")
      throw new UnauthorizedError();
    e.response.header().set("Cache-Control", "no-store");
    return e.json(200, transfer.exportScope(repository, e.auth.id, scope));
  });
  routerAdd(
    "POST",
    `/api/transfer/${scope}/import`,
    (e) => {
      if (!e.auth || e.auth.collection().name !== "users")
        throw new UnauthorizedError();
      try {
        return e.json(
          200,
          transfer.importScope(
            repository,
            e.auth.id,
            scope,
            e.requestInfo().body,
          ),
        );
      } catch (error) {
        return e.json(400, {
          error: ["transfer_invalid_backup", "transfer_too_large"].includes(
            error.message,
          )
            ? error.message
            : "transfer_import_failed",
        });
      }
    },
    apiLimits.bodyLimit(100 * 1024 * 1024),
  );
}
routerAdd("POST", "/api/subscriptions/delete-all", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  if (e.requestInfo().body.confirmed !== true)
    return e.json(400, { error: "confirmation_required" });
  const deleted = repository.runInTransaction((tx) => {
    const subscriptions = tx.findRecordsByFilter(
      "subscriptions",
      "user = {:owner}",
      "",
      0,
      0,
      { owner: e.auth.id },
    );
    const byId = new Map(subscriptions.map((sub) => [sub.id, sub]));
    for (const payment of tx.findRecordsByFilter(
      "payment_records",
      "user = {:owner}",
      "",
      0,
      0,
      { owner: e.auth.id },
    )) {
      const sub = byId.get(payment.getString("subscription_id"));
      if (!sub) continue;
      for (const key of [
        "name",
        "currency",
        "category",
        "payment_method",
        "payer",
      ])
        if (!payment.getString(key)) payment.set(key, sub.get(key));
      payment.set("subscription_id", "");
      tx.save(payment);
    }
    for (const sub of subscriptions) tx.delete(sub);
    return subscriptions.length;
  });
  return e.json(200, { deleted });
});
