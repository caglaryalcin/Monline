const {
  repository, Record, routerAdd, UnauthorizedError, NotFoundError, BadRequestError,
  onRecordCreate, onRecordUpdate,
} = require("../runtime.cjs");
const savings = require("./lib/pure/savings.js");

function owner(e) {
  if (!e.auth || e.auth.collection().name !== "users") throw new UnauthorizedError();
  return e.auth.id;
}
function owned(e) {
  const user = owner(e);
  const record = repository.findRecordById("savings", e.request.pathValue("id"));
  if (record.getString("user") !== user) throw new NotFoundError();
  return record;
}
function validate(value) {
  try { return savings.validate(value); }
  catch { throw new BadRequestError("savings_invalid"); }
}
for (const hook of [onRecordCreate, onRecordUpdate])
  hook((e) => {
    const values = validate(Object.fromEntries(savings.FIELDS.map((key) => [key, e.record.get(key)])));
    for (const [key, value] of Object.entries(values)) e.record.set(key, value);
    return e.next();
  }, "savings");

function save(e, record) {
  const values = validate(e.requestInfo().body);
  record.set("user", owner(e));
  for (const [key, value] of Object.entries(values)) record.set(key, value);
  repository.save(record);
  return record;
}
routerAdd("GET", "/api/savings", (e) => {
  const user = owner(e);
  return e.json(200, repository.findRecordsByFilter("savings", "user = {:user}", "name,id", 0, 0, { user }));
});
routerAdd("GET", "/api/savings/rates", async (e) => {
  owner(e);
  return e.json(200, await require("./lib/savings-rates.js").latest());
});
routerAdd("POST", "/api/savings/rates", async (e) => {
  owner(e);
  return e.json(200, await require("./lib/savings-rates.js").latest({ force: true }));
});
routerAdd("POST", "/api/savings", (e) => {
  owner(e);
  return e.json(201, save(e, new Record(repository.findCollectionByNameOrId("savings"))));
});
routerAdd("PUT", "/api/savings/{id}", (e) => e.json(200, save(e, owned(e))));
routerAdd("DELETE", "/api/savings/{id}", (e) => {
  repository.delete(owned(e));
  return e.json(200, { deleted: true });
});
