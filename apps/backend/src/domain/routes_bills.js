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
    values = bills.validate(e.requestInfo().body);
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
