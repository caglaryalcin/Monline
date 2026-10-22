const {
  BadRequestError,
  NotFoundError,
  Record,
  UnauthorizedError,
  files,
  repository,
  routerAdd,
} = require("../runtime.cjs");
const domainPath = __dirname;
routerAdd("POST", "/api/payments/history", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError("Authentication required");
  const helper = require(domainPath + "/lib/pure/historical-payment.js");
  const body = { ...e.requestInfo().body };
  if (e.request.header.get("Content-Type").startsWith("multipart/form-data")) {
    for (const key of [
      "amount",
      "utc_offset_minutes",
      "paid_utc_offset_minutes",
    ])
      if (typeof body[key] === "string" && body[key].trim())
        body[key] = Number(body[key]);
  }
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
    if (!body.subscription_id) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.trim().length > 200
      )
        throw new BadRequestError("historical_invalid_name");
      let currency;
      try {
        currency = tx.findRecordById("currencies", String(body.currency || ""));
      } catch (_) {
        throw new BadRequestError("historical_invalid_currency");
      }
      if (currency.getString("user") !== e.auth.id)
        throw new BadRequestError("historical_invalid_currency");
      const record = new Record(tx.findCollectionByNameOrId("payment_records"));
      record.set("user", e.auth.id);
      record.set("name", body.name.trim());
      record.set("currency", currency.id);
      for (const [key, collection] of Object.entries({
        category: "categories",
        payment_method: "payment_methods",
        payer: "household",
      })) {
        if (!body[key]) continue;
        let related;
        try {
          related = tx.findRecordById(collection, String(body[key]));
        } catch (_) {
          throw new BadRequestError("historical_invalid_details");
        }
        if (related.getString("user") !== e.auth.id)
          throw new BadRequestError("historical_invalid_details");
        record.set(key, related.id);
      }
      let logo;
      try {
        [, logo] = e.request.formFile("logo");
      } catch (_) {}
      if (logo) {
        if (
          !require(domainPath + "/lib/pure/image-source.js").imageContentType(
            logo.buffer,
          )
        )
          throw new BadRequestError("historical_invalid_logo");
        record.set("logo", files.fileFromMultipart(logo));
      }
      for (const key of Object.keys(values)) record.set(key, values[key]);
      tx.save(record);
      saved = record;
      return;
    }
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
