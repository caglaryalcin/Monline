const {
  repository,
  routerAdd,
  Record,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
  onRecordCreate,
  onRecordUpdate,
} = require("../runtime.cjs");
const logos = require("./lib/pure/merchant-logos.js");
function owner(e) {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  return e.auth.id;
}
for (const hook of [onRecordCreate, onRecordUpdate])
  hook((e) => {
    let values;
    try {
      values = logos.validate(
        Object.fromEntries(
          ["merchant_name", "provider_name", "domain", "row_id", "start_month", "scope", "updated_at"].map((key) => [
            key,
            e.record.getString(key),
          ]),
        ),
      );
    } catch {
      throw new BadRequestError("merchant_logo_invalid");
    }
    for (const [key, value] of Object.entries(values)) e.record.set(key, value);
    return e.next();
  }, "merchant_logos");
routerAdd("GET", "/api/merchant-logos", (e) =>
  e.json(
    200,
    repository.findRecordsByFilter(
      "merchant_logos",
      "user = {:owner}",
      "merchant_name",
      0,
      0,
      { owner: owner(e) },
    ),
  ),
);
routerAdd("POST", "/api/merchant-logos", (e) => {
  const user = owner(e);
  let values;
  try {
    values = logos.validate(e.requestInfo().body);
  } catch {
    throw new BadRequestError("merchant_logo_invalid");
  }
  let result;
  repository.runInTransaction((tx) => {
    const latest = tx.findRecordsByFilter("merchant_logos", "user = {:owner}", "-updated_at", 1, 0, { owner: user })[0];
    values.updated_at = new Date(Math.max(Date.now(), (Date.parse(latest?.getString("updated_at") || "") || 0) + 1)).toISOString();
    if (values.row_id) {
      const row = tx.findRecordById("finance_rows", values.row_id);
      if (row.getString("user") !== user) throw new NotFoundError();
    }
    // A new ongoing choice also replaces an exception in its starting month.
    // Exceptions in later months remain scheduled.
    if (values.scope === "from")
      for (const exception of tx.findRecordsByFilter(
        "merchant_logos",
        "user = {:owner} && merchant_key = {:key} && row_id = {:row} && start_month = {:month} && scope = 'month'",
        "", 0, 0,
        { owner: user, key: values.merchant_key, row: values.row_id, month: values.start_month },
      )) tx.delete(exception);
    const record =
      tx.findRecordsByFilter(
        "merchant_logos",
        "user = {:owner} && merchant_key = {:key} && row_id = {:row} && start_month = {:month} && scope = {:scope}",
        "",
        1,
        0,
        { owner: user, key: values.merchant_key, row: values.row_id, month: values.start_month, scope: values.scope },
      )[0] || new Record(tx.findCollectionByNameOrId("merchant_logos"));
    record.set("user", user);
    for (const [key, value] of Object.entries(values)) record.set(key, value);
    tx.save(record);
    result = record;
  });
  return e.json(200, result);
});
routerAdd("DELETE", "/api/merchant-logos/{id}", (e) => {
  const user = owner(e),
    record = repository.findRecordById(
      "merchant_logos",
      e.request.pathValue("id"),
    );
  if (record.getString("user") !== user) throw new NotFoundError();
  repository.delete(record);
  return e.json(200, { deleted: true });
});
