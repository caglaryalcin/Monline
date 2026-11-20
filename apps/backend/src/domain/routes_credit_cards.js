const {
  repository, Record, routerAdd, UnauthorizedError, NotFoundError, BadRequestError,
  onRecordCreate, onRecordUpdate, apiLimits,
} = require("../runtime.cjs");
const cards = require("./lib/pure/credit-cards.js");

function owner(e) {
  if (!e.auth || e.auth.collection().name !== "users") throw new UnauthorizedError();
  return e.auth.id;
}
function owned(tx, collection, id, user) {
  if (typeof id !== "string" || !/^[a-z0-9]{15}$/.test(id)) throw new NotFoundError();
  const record = tx.findRecordById(collection, id);
  if (record.getString("user") !== user) throw new NotFoundError();
  return record;
}
function validate(value) {
  try { return cards.validate(value); }
  catch (error) { throw new BadRequestError(error.message === "credit_cards_invalid_statement_day" ? error.message : "credit_cards_invalid"); }
}
function assign(tx, card, ids, user) {
  if (!Array.isArray(ids) || ids.length > 5000 || ids.some(id => typeof id !== "string" || !/^[a-z0-9]{15}$/.test(id)))
    throw new BadRequestError("credit_cards_invalid_statements");
  for (const id of new Set(ids)) {
    const statement = owned(tx, "bank_statements", id, user);
    if (statement.getString("bank") !== card.getString("bank"))
      throw new BadRequestError("credit_cards_bank_mismatch");
    if (statement.getString("credit_card") && statement.getString("credit_card") !== card.id)
      throw new BadRequestError("credit_cards_already_assigned");
    statement.set("credit_card", card.id);
    tx.save(statement);
  }
}
for (const hook of [onRecordCreate, onRecordUpdate]) {
  hook(e => {
    const values = validate(Object.fromEntries(["bank", "name", "last_four", "expiry", "statement_day", "statement_weekend_adjust", "network"].map(key => [key, e.record.get(key)])));
    // A bank edit must not invalidate the bank identity of archived statements.
    const linked = repository.connection.prepare("SELECT bank FROM bank_statements WHERE user=? AND credit_card=?").all(e.record.getString("user"), e.record.id);
    if (linked.some(statement => statement.bank !== values.bank)) throw new BadRequestError("credit_cards_bank_locked");
    for (const [key, value] of Object.entries(values)) e.record.set(key, value);
    return e.next();
  }, "credit_cards");
  hook(e => {
    const id = e.record.getString("credit_card");
    if (id) {
      const card = owned(repository, "credit_cards", id, e.record.getString("user"));
      if (card.getString("bank") !== e.record.getString("bank")) throw new BadRequestError("credit_cards_bank_mismatch");
    }
    return e.next();
  }, "bank_statements");
}
routerAdd("GET", "/api/credit-cards", e => {
  const user = owner(e);
  const counts = new Map(repository.connection.prepare("SELECT credit_card, COUNT(*) AS count FROM bank_statements WHERE user=? GROUP BY credit_card").all(user).map(row => [row.credit_card, row.count]));
  return e.json(200, {
    cards: repository.findRecordsByFilter("credit_cards", "user = {:user}", "created,id", 0, 0, { user }).map(card => ({ ...card.publicExport(), statement_count: counts.get(card.id) || 0 })),
    unassigned_count: counts.get("") || 0,
    total_count: [...counts.values()].reduce((sum, count) => sum + count, 0),
  });
});
routerAdd("POST", "/api/credit-cards", e => {
  const user = owner(e), body = e.requestInfo().body, values = validate(body);
  const result = repository.runInTransaction(tx => {
    const card = new Record(tx.findCollectionByNameOrId("credit_cards"));
    card.set("user", user);
    for (const [key, value] of Object.entries(values)) card.set(key, value);
    tx.save(card);
    assign(tx, card, body.statement_ids ?? [], user);
    return card;
  });
  return e.json(201, result);
}, apiLimits.bodyLimit(128 * 1024));
routerAdd("PUT", "/api/credit-cards/{id}", e => {
  const user = owner(e), body = e.requestInfo().body;
  const result = repository.runInTransaction(tx => {
    const card = owned(tx, "credit_cards", e.request.pathValue("id"), user);
    const values = validate({ ...card.publicExport(), ...body });
    for (const [key, value] of Object.entries(values)) card.set(key, value);
    tx.save(card);
    return card;
  });
  return e.json(200, result);
}, apiLimits.bodyLimit(4096));
routerAdd("POST", "/api/credit-cards/{id}/statements", e => {
  const user = owner(e);
  repository.runInTransaction(tx => assign(tx, owned(tx, "credit_cards", e.request.pathValue("id"), user), e.requestInfo().body.statement_ids, user));
  return e.json(200, { assigned: true });
}, apiLimits.bodyLimit(128 * 1024));
routerAdd("DELETE", "/api/credit-cards/{id}", e => {
  const user = owner(e);
  repository.runInTransaction(tx => tx.delete(owned(tx, "credit_cards", e.request.pathValue("id"), user)));
  return e.json(200, { deleted: true });
});
