const {
  repository,
  routerAdd,
  Record,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
  onRecordCreate,
  onRecordUpdate,
  onRecordDelete,
} = require("../runtime.cjs");
const { loadSpendingData } = require("./lib/spending-data.js");
const { budgetData } = require("./lib/pure/budget.js");
const matching = require("./lib/pure/budget-matching.js");
const finance = require("./lib/pure/finance.js");
function owner(e) {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  return e.auth.id;
}
function owned(name, id, user) {
  const record = repository.findRecordById(name, id);
  if (record.getString("user") !== user) throw new NotFoundError();
  return record;
}
function load(user) {
  const data = loadSpendingData(repository, user);
  for (const name of [
    "subscriptions",
    "payment_records",
    "currencies",
    "payment_methods",
    "categories",
  ])
    data[name] = repository
      .findRecordsByFilter(name, "user = {:user}", "", 0, 0, { user })
      .map((record) => record.publicExport());
  data.cycles = repository
    .findRecordsByFilter("cycles", "", "", 0, 0)
    .map((record) => record.publicExport());
  return data;
}
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function validMonth(month) {
  return (
    typeof month === "string" &&
    /^(19[7-9]\d|20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(month)
  );
}
onRecordDelete((e) => {
  repository.connection
    .prepare("UPDATE finance_rows SET payment_card='' WHERE user=?")
    .run(e.record.id);
  repository.connection
    .prepare("UPDATE payment_methods SET finance_card='' WHERE user=?")
    .run(e.record.id);
  return e.next();
}, "users");
routerAdd("GET", "/api/budget", (e) => {
  const user = owner(e),
    month = e.request.url.query().get("month") || today().slice(0, 7);
  if (!validMonth(month)) throw new BadRequestError("budget_invalid_month");
  let result;
  repository.runInTransaction(() => {
    const data = load(user);
    result = {
      ...budgetData(data, month, today()),
      payment_methods: data.payment_methods.map((method) => ({
        id: method.id,
        name: method.name,
        finance_card: method.finance_card || "",
      })),
    };
  });
  return e.json(200, result);
});
for (const event of [onRecordCreate, onRecordUpdate]) {
  event((e) => {
    const card = e.record.getString("finance_card");
    if (
      card &&
      owned("finance_rows", card, e.record.getString("user")).getString(
        "expense_type",
      ) !== "credit_card"
    )
      throw new BadRequestError("budget_invalid_card");
    return e.next();
  }, "payment_methods");
  event((e) => {
    const record = e.record,
      type = record.getString("target_type");
    if (
      !Object.hasOwn(matching.PREFIX, type) ||
      !/^[a-f0-9]{64}$/.test(record.getString("fingerprint")) ||
      !["same", "different"].includes(record.getString("relation") || "same") ||
      !record.getString("transaction_id") ||
      record.getString("transaction_id").length > 200
    )
      throw new BadRequestError("budget_invalid_match");
    const user = record.getString("user");
    owned(type, record.getString("target_id"), user);
    const statement = owned(
      "bank_statements",
      record.getString("statement_id"),
      user,
    );
    if (
      !(statement.get("transactions") || []).some(
        (transaction) => transaction.id === record.getString("transaction_id"),
      )
    )
      throw new BadRequestError("budget_invalid_match");
    return e.next();
  }, "budget_matches");
}
// All write paths, including generic record updates and undo, enforce card ownership.
for (const event of [onRecordUpdate, onRecordDelete])
  event((e) => {
    if (
      e.record.getString("expense_type") === "credit_card" &&
      event !== onRecordDelete
    )
      return e.next();
    const id = e.record.id;
    if (
      repository.findRecordsByFilter(
        "finance_rows",
        "payment_card = {:id}",
        "",
        1,
        0,
        { id },
      ).length ||
      repository.findRecordsByFilter(
        "payment_methods",
        "finance_card = {:id}",
        "",
        1,
        0,
        { id },
      ).length
    )
      throw new BadRequestError("budget_card_in_use");
    return e.next();
  }, "finance_rows");
// Keep a stale proof when a source transaction changes; its fingerprint makes
// the review requirement visible. Deleting a record removes its relation.
for (const name of ["bank_statements", ...Object.keys(matching.PREFIX)])
  onRecordDelete((e) => {
    const field = name === "bank_statements" ? "statement_id" : "target_id";
    const filter =
      `${field} = {:id}` +
      (field === "target_id" ? " && target_type = {:type}" : "");
    for (const match of repository.findRecordsByFilter(
      "budget_matches",
      filter,
      "",
      0,
      0,
      { id: e.record.id, type: name },
    ))
      repository.delete(match);
    return e.next();
  }, name);
routerAdd("POST", "/api/budget/matches", (e) => {
  const user = owner(e),
    body = e.requestInfo().body;
  if (
    !Object.hasOwn(matching.PREFIX, body.target_type) ||
    !validMonth(body.month)
  )
    throw new BadRequestError("budget_invalid_match");
  let result;
  repository.runInTransaction(() => {
    const data = load(user),
      view = budgetData(data, body.month, today());
    const target = view.targets.find(
      (event) =>
        event.id === matching.eventId(body.target_type, body.target_id),
    );
    const source = view.statements.find(
      (event) =>
        event.id === `statement:${body.statement_id}:${body.transaction_id}`,
    );
    if (!matching.compatible(target, source))
      throw new BadRequestError("budget_match_mismatch");
    const relation = body.relation || "same";
    if (!["same", "different"].includes(relation))
      throw new BadRequestError("budget_invalid_match");
    const previous = data.budget_matches.find(
      (match) =>
        match.target_type === body.target_type &&
        match.target_id === body.target_id &&
        ((match.statement_id === body.statement_id &&
          match.transaction_id === body.transaction_id) ||
          (relation === "same" && match.relation !== "different")),
    );
    if (
      relation === "same" &&
      (data.budget_matches.some(
        (match) =>
          match.relation !== "different" &&
          match.id !== previous?.id &&
          match.statement_id === body.statement_id &&
          match.transaction_id === body.transaction_id,
      ) ||
        (source.verified_target_id && source.verified_target_id !== target.id))
    )
      throw new BadRequestError("budget_match_in_use");
    const record = previous
      ? owned("budget_matches", previous.id, user)
      : new Record(repository.findCollectionByNameOrId("budget_matches"));
    for (const key of [
      "target_type",
      "target_id",
      "statement_id",
      "transaction_id",
    ])
      record.set(key, body[key]);
    record.set("user", user);
    record.set("relation", relation);
    record.set("fingerprint", matching.fingerprint(target, source));
    repository.save(record);
    result = record.publicExport();
  });
  return e.json(200, result);
});
routerAdd("DELETE", "/api/budget/matches/{id}", (e) => {
  repository.delete(
    owned("budget_matches", e.request.pathValue("id"), owner(e)),
  );
  return e.json(200, { deleted: true });
});
routerAdd("POST", "/api/budget/plan", (e) => {
  const user = owner(e),
    body = e.requestInfo().body;
  const row = owned("finance_rows", body.row_id, user);
  if (
    !(body.amount > 0) ||
    row.getString("expense_type") !== "" ||
    row.getString("kind") !== "expense" ||
    !validMonth(body.from) ||
    !validMonth(body.to) ||
    body.from > body.to ||
    !Number.isInteger(body.day) ||
    body.day < 1 ||
    body.day > 31 ||
    finance.validate("finance_entries", {
      date: `${body.from}-01`,
      amount: body.amount,
      status: "planned",
      settled_date: "",
      row_id: row.id,
    })
  )
    throw new BadRequestError("budget_invalid_plan");
  const start = new Date(`${body.from}-01T12:00:00Z`),
    end = new Date(`${body.to}-01T12:00:00Z`);
  const count =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth() +
    1;
  if (count > 360) throw new BadRequestError("budget_invalid_plan");
  let created = 0;
  repository.runInTransaction(() => {
    const existing = repository.findRecordsByFilter(
      "finance_entries",
      "row_id = {:row}",
      "",
      0,
      0,
      { row: row.id },
    );
    for (let index = 0; index < count; index++) {
      const date = new Date(start);
      date.setUTCMonth(date.getUTCMonth() + index);
      const month = date.toISOString().slice(0, 7);
      if (existing.some((entry) => entry.getString("date").startsWith(month)))
        continue;
      const last = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
      ).getUTCDate();
      const record = new Record(
        repository.findCollectionByNameOrId("finance_entries"),
      );
      for (const [key, value] of Object.entries({
        user,
        row_id: row.id,
        date: `${month}-${String(Math.min(body.day, last)).padStart(2, "0")}`,
        amount: body.amount,
        status: "planned",
        settled_date: "",
        notes: body.notes || "",
      }))
        record.set(key, value);
      repository.save(record);
      created++;
    }
  });
  return e.json(200, { created });
});
routerAdd("POST", "/api/budget/template", (e) => {
  const user = owner(e);
  const headings = [
    ["Kredi kartı", "credit_card"],
    ["Kredi", ""],
    ["Sabit okul gideri", ""],
    ["Turkcell fatura 1", ""],
    ["Turkcell fatura 2", ""],
    ["Elektrik fatura", ""],
    ["Su fatura", ""],
    ["Doğalgaz fatura", ""],
    ["İnternet", ""],
    ["Mazot", ""],
    ["Diğer gider", ""],
    ["Önceki ay eksi", ""],
  ];
  let created = 0;
  repository.runInTransaction(() => {
    const existing = repository.findRecordsByFilter(
      "finance_rows",
      "user = {:user}",
      "",
      0,
      0,
      { user },
    );
    for (const [name, expense_type] of headings) {
      if (
        existing.some(
          (row) =>
            row.getString("name").toLocaleLowerCase("tr") ===
            name.toLocaleLowerCase("tr"),
        )
      )
        continue;
      const record = new Record(
        repository.findCollectionByNameOrId("finance_rows"),
      );
      for (const [field, value] of Object.entries({
        user,
        name,
        kind: "expense",
        expense_type,
        notes: "",
      }))
        record.set(field, value);
      repository.save(record);
      created++;
    }
  });
  return e.json(200, { created });
});
