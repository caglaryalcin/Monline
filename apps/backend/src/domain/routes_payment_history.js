const {
  BadRequestError,
  NotFoundError,
  Record,
  UnauthorizedError,
  repository,
  routerAdd,
} = require("../runtime.cjs");
const domainPath = __dirname;
routerAdd("POST", "/api/payments/history", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError("Authentication required");
  const helper = require(domainPath + "/lib/pure/historical-payment.js");
  const body = e.requestInfo().body;
  let values;
  try {
    values = helper.validateHistoricalPayment(body, new Date());
  } catch (err) {
    return e.json(400, {
      error: err.message,
    });
  }
  let saved;
  let duplicate = false;
  repository.runInTransaction((tx) => {
    let sub;
    try {
      sub = tx.findRecordById(
        "subscriptions",
        String(body.subscription_id || ""),
      );
    } catch (_) {
      throw new NotFoundError();
    }
    if (sub.getString("user") !== e.auth.id) throw new NotFoundError();
    if (sub.getString("record_type") === "credit")
      throw new BadRequestError("historical_expense_only");
    const matches = tx.findRecordsByFilter(
      "payment_records",
      "user = {:user} && subscription_id = {:sub} && due_date >= {:from} && due_date < {:until}",
      "",
      0,
      0,
      {
        user: e.auth.id,
        sub: sub.id,
        from: values.due_date,
        until: values.due_date + "~",
      },
    );
    if (matches.some((record) => !!record.getString("paid_at"))) {
      duplicate = true;
      return;
    }
    const record =
      matches[0] || new Record(tx.findCollectionByNameOrId("payment_records"));
    record.set("user", e.auth.id);
    record.set("subscription_id", sub.id);
    for (const key of Object.keys(values)) record.set(key, values[key]);
    tx.save(record);
    saved = record;
  });
  if (duplicate)
    return e.json(409, {
      error: "historical_duplicate",
    });
  return e.json(201, saved);
});
