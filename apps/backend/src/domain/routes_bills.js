const {
  repository,
  Record,
  routerAdd,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
  onRecordCreate,
  onRecordUpdate,
} = require("../runtime.cjs");
const bills = require("./lib/pure/manual-bills.js");
function owner(e) {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  return e.auth.id;
}
function owned(e) {
  const user = owner(e),
    record = repository.findRecordById(
      "manual_bills",
      e.request.pathValue("id"),
    );
  if (record.getString("user") !== user) throw new NotFoundError();
  return record;
}
for (const hook of [onRecordCreate, onRecordUpdate])
  hook((e) => {
    let values;
    try {
      values = bills.validate(
        Object.fromEntries(bills.FIELDS.map((key) => [key, e.record.get(key)])),
      );
    } catch {
      throw new BadRequestError("bill_invalid");
    }
    for (const [key, value] of Object.entries(values)) e.record.set(key, value);
    return e.next();
  }, "manual_bills");
function save(e, record) {
  let values;
  try {
    values = bills.validate({ ...e.requestInfo().body, bill_skip: "" });
  } catch {
    throw new BadRequestError("bill_invalid");
  }
  record.set("user", owner(e));
  for (const [key, value] of Object.entries(values)) record.set(key, value);
  repository.save(record);
  return record;
}
routerAdd("POST", "/api/bills", (e) => {
  owner(e);
  return e.json(
    201,
    save(e, new Record(repository.findCollectionByNameOrId("manual_bills"))),
  );
});
routerAdd("PUT", "/api/bills/{id}", (e) => e.json(200, save(e, owned(e))));
routerAdd("DELETE", "/api/bills/{id}", (e) => {
  repository.delete(owned(e));
  return e.json(200, { deleted: true });
});

routerAdd("POST", "/api/bills/month-status", (e) => {
  const user = owner(e), body = e.requestInfo().body;
  if (!body || !["ledger", "manual_bill"].includes(body.source) ||
      typeof body.skipped !== "boolean" || !/^[a-z0-9]{15}$/.test(body.id) ||
      !require("./lib/pure/backfill-schedule.js").validDate(body.date))
    throw new BadRequestError("bill_invalid");
  repository.runInTransaction((tx) => {
    const collection = body.source === "ledger" ? "finance_entries" : "manual_bills";
    const record = tx.findRecordById(collection, body.id);
    if (record.getString("user") !== user) throw new NotFoundError();
    if (record.getString("date") !== body.date) throw new BadRequestError("bill_invalid");
    if (body.source === "ledger") {
      const row = tx.findRecordById("finance_rows", record.getString("row_id"));
      if (row.getString("user") !== user || row.getString("kind") !== "expense" ||
          !row.getString("bill_type") || row.getBool("is_deleted") ||
          row.getString("expense_type") === "credit_card" || row.getBool("is_auto_carryover"))
        throw new BadRequestError("bill_invalid");
    }
    if (record.getString("status") !== "planned" || record.getString("source_payment") ||
        tx.findRecordsByFilter("budget_matches", "user = {:user} && target_type = {:type} && target_id = {:id}", "", 1, 0,
          { user, type: collection, id: record.id }).length)
      throw new BadRequestError("bill_invalid");
    const saved = require("./lib/pure/bill-skip.js").skippedAmount(record.getString("bill_skip"), body.date);
    if (body.skipped && saved === null) {
      record.set("bill_skip", JSON.stringify({ amount: record.getFloat("amount"), month: body.date.slice(0, 7) }));
      record.set("amount", 0);
    } else if (!body.skipped && saved !== null) {
      record.set("bill_skip", "");
      record.set("amount", saved);
    } else return;
    tx.save(record);
  });
  return e.json(200, { skipped: body.skipped });
});
