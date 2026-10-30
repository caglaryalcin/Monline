const {
  repository,
  routerAdd,
  Record,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  NotFoundError,
  onRecordCreate,
  onRecordUpdate,
  onRecordDelete,
} = require("../runtime.cjs");
const finance = require("./lib/pure/finance.js");
const financeYears = require("./lib/pure/finance-years.js");
const { compareCardPayment } = require("./lib/pure/finance-card-payments.js");
const references = require("./lib/finance-references.js");
const fields = {
  finance_rows: [
    "name",
    "kind",
    "expense_type",
    "notes",
    "payment_card",
    "bill_type",
    "row_order",
    "is_loan",
    "is_rent",
    "is_auto_carryover",
    "loan_id",
    "year",
    "origin_row",
    "is_deleted",
  ],
  finance_statement_links: ["row_id", "month", "statement_id"],
  finance_card_transactions: [
    "row_id",
    "month",
    "date",
    "merchant",
    "amount",
    "notes",
  ],
  finance_entries: [
    "row_id",
    "date",
    "amount",
    "status",
    "settled_date",
    "payment_tag",
    "notes",
  ],
  salary_history: ["effective_date", "amount", "notes"],
  finance_benchmarks: [
    "month",
    "salary_tag",
    "usd",
    "eur",
    "minimum_wage",
    "rate_date",
    "source",
    "updated_at",
  ],
};
function own(name, user) {
  const records = repository.findRecordsByFilter(
    name,
    "user = {:user}",
    "",
    0,
    0,
    {
      user,
    },
  );
  return name === "finance_rows"
    ? records.sort((a, b) => a.getFloat("row_order") - b.getFloat("row_order"))
    : records;
}
function user(e) {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  return e.auth.id;
}
function financeYearData(owner) {
  return Object.fromEntries(
    ["finance_rows", "finance_entries", "finance_statement_links", "finance_card_transactions"]
      .map((name) => [name, own(name, owner).map((record) => record.publicExport())]),
  );
}
function yearRows(owner, year) {
  const data = financeYearData(owner);
  return financeYears.rowsForYear(data.finance_rows, year, data);
}
function yearRow(owner, id, year) {
  const data = financeYearData(owner);
  return financeYears.rowForYear(data.finance_rows, id, year, data);
}
function owned(name, id, owner) {
  const record = repository.findRecordById(name, id);
  if (record.getString("user") !== owner) throw new NotFoundError();
  return record;
}
function check(record) {
  const values = Object.fromEntries(
    fields[record.collection().name].map((key) => [key, record.get(key)]),
  );
  const reason = finance.validate(record.collection().name, values);
  if (reason) throw new BadRequestError(reason);
  if (
    record.collection().name === "finance_rows" &&
    (values.kind !== "expense" || values.expense_type === "credit_card") &&
    repository.connection
      .prepare(
        `SELECT 1 FROM budget_matches m JOIN finance_entries e ON e.id=m.target_id
      WHERE m.target_type='finance_entries' AND e.row_id=? LIMIT 1`,
      )
      .get(record.id)
  )
    throw new BadRequestError("budget_remove_proof_first");
  if (record.collection().name === "finance_rows" && values.payment_card) {
    const card = owned(
      "finance_rows",
      values.payment_card,
      record.getString("user"),
    );
    if (
      values.kind !== "expense" ||
      values.expense_type === "credit_card" ||
      card.getString("expense_type") !== "credit_card" ||
      card.id === record.id
    )
      throw new BadRequestError("budget_invalid_card");
  }
  if (
    record.collection().name === "finance_rows" &&
    (values.kind !== "expense" || values.expense_type !== "credit_card") &&
    ["finance_card_transactions", "finance_statement_links"].some(
      (name) =>
        repository.findRecordsByFilter(name, "row_id = {:row}", "", 1, 0, {
          row: record.id,
        }).length,
    )
  )
    throw new BadRequestError("finance_card_type_in_use");
  if (record.collection().name === "finance_entries") {
    const row = owned("finance_rows", values.row_id, record.getString("user"));
    if (
      values.payment_tag &&
      (row.getString("kind") !== "expense" ||
        row.getString("expense_type") === "credit_card")
    )
      throw new BadRequestError("finance_invalid_payment_tag");
  }
  if (
    record.collection().name === "finance_rows" &&
    (values.kind !== "expense" || values.expense_type === "credit_card") &&
    own("finance_entries", record.getString("user")).some(
      (entry) =>
        entry.getString("row_id") === record.id &&
        entry.getString("payment_tag"),
    )
  )
    throw new BadRequestError("finance_payment_tag_in_use");
  if (record.collection().name === "finance_card_transactions") {
    const row = owned("finance_rows", values.row_id, record.getString("user"));
    if (
      row.getString("kind") !== "expense" ||
      row.getString("expense_type") !== "credit_card"
    )
      throw new BadRequestError("finance_invalid_card_transaction");
  }
  if (record.collection().name === "finance_statement_links") {
    const owner = record.getString("user");
    const row = owned("finance_rows", values.row_id, owner);
    const statement = owned("bank_statements", values.statement_id, owner);
    if (
      row.getString("kind") !== "expense" ||
      row.getString("expense_type") !== "credit_card"
    )
      throw new BadRequestError("finance_invalid_statement_link");
    if (statement.getString("period") !== values.month)
      throw new BadRequestError("finance_statement_period_mismatch");
    if (
      own("finance_statement_links", owner).some(
        (link) =>
          link.id !== record.id &&
          (link.getString("statement_id") === values.statement_id ||
            (link.getString("row_id") === values.row_id &&
              link.getString("month") === values.month)),
      )
    )
      throw new BadRequestError("finance_statement_link_conflict");
  }
  if (record.collection().name === "finance_rows" && values.origin_row) {
    const root = owned("finance_rows", values.origin_row, record.getString("user"));
    if (root.id === record.id || root.getString("origin_row")) throw new BadRequestError("finance_invalid_row");
  }
  if (["finance_entries", "finance_card_transactions", "finance_statement_links"].includes(record.collection().name)) {
    const row = owned("finance_rows", values.row_id, record.getString("user"));
    const year = Number((values.date || values.month || "").slice(0, 4));
    if (row.getBool("is_deleted") || (row.getFloat("year") && row.getFloat("year") !== year))
      throw new BadRequestError("finance_invalid_year");
  }
  const uniqueField =
    record.collection().name === "salary_history"
      ? "effective_date"
      : record.collection().name === "finance_benchmarks"
        ? "month"
        : null;
  if (
    uniqueField &&
    own(record.collection().name, record.getString("user")).some(
      (row) =>
        row.id !== record.id &&
        row.getString(uniqueField) === values[uniqueField],
    )
  )
    throw new BadRequestError("finance_duplicate_date");
}
for (const event of [onRecordCreate, onRecordUpdate])
  event(
    (e) => {
      check(e.record);
      if (event === onRecordUpdate && e.record.collection().name === "finance_rows" &&
          !e.record.getBool("__monline_restore") && !e.record.getFloat("year") && !finance.isCarryoverRow(e.record.publicExport()))
        throw new BadRequestError("finance_invalid_year");
      return e.next();
    },
    ...finance.COLLECTIONS,
  );
onRecordDelete((e) => {
  if (
    repository.findRecordsByFilter(
      "finance_statement_links",
      "row_id = {:row}",
      "",
      1,
      0,
      { row: e.record.id },
    ).length
  )
    throw new BadRequestError("finance_statement_row_in_use");
  for (const transaction of repository.findRecordsByFilter(
    "finance_card_transactions",
    "row_id = {:row}",
    "",
    0,
    0,
    { row: e.record.id },
  ))
    repository.delete(transaction);
  for (const entry of repository.findRecordsByFilter(
    "finance_entries",
    "row_id = {:row}",
    "",
    0,
    0,
    { row: e.record.id },
  ))
    repository.delete(entry);
  return e.next();
}, "finance_rows");
onRecordDelete((e) => {
  for (const link of repository.findRecordsByFilter(
    "finance_statement_links",
    "statement_id = {:statement}",
    "",
    0,
    0,
    { statement: e.record.id },
  ))
    repository.delete(link);
  return e.next();
}, "bank_statements");
// Account deletion removes links before the general owner cascade reaches rows.
onRecordDelete((e) => {
  for (const link of own("finance_statement_links", e.record.id))
    repository.delete(link);
  return e.next();
}, "users");
function save(name, owner, body, id) {
  let record = id
    ? owned(name, id, owner)
    : new Record(repository.findCollectionByNameOrId(name));
  if (name === "finance_rows" && id && body.year != null)
    record = scopedRow(owner, record, body.year);
  if (["finance_entries", "finance_card_transactions", "finance_statement_links"].includes(name)) {
    const rowId = body.row_id || record.getString("row_id");
    const period = body.date || body.month || record.getString("date") || record.getString("month");
    if (rowId && period) {
      const row = yearRow(owner, rowId, Number(period.slice(0, 4)));
      if (!row) throw new BadRequestError("finance_invalid_row");
      body = { ...body, row_id: row.id };
    }
  }
  record.set("user", owner);
  if (name === "finance_rows" && !id && body.row_order == null) {
    const expense = body.kind === "expense";
    const peers = (body.year ? yearRows(owner, body.year).map((row) => owned(name, row.id, owner)) : own(name, owner)).filter(
      (row) => (row.getString("kind") === "expense") === expense,
    );
    const last = peers.at(-1);
    let carryover = expense && last && finance.isCarryoverRow(last.publicExport()) && !finance.isCarryoverRow(body) ? last : undefined;
    if (carryover && body.year) carryover = scopedRow(owner, carryover, body.year);
    const order = Math.max(
      0,
      ...peers.filter((row) => row.id !== carryover?.id).map((row) => row.getFloat("row_order")),
    ) + 1;
    if (carryover && carryover.getFloat("row_order") <= order) {
      carryover.set("row_order", order + 1);
      repository.save(carryover);
    }
    record.set("row_order", order);
  }
  const previousName = record.getString("name");
  for (const key of fields[name])
    if (Object.hasOwn(body, key)) record.set(key, body[key]);
  if (name === "finance_rows" && (body.is_loan === false ||
      (id && body.name != null && body.name !== previousName)))
    record.set("loan_id", "");
  repository.save(record);
  return record;
}
function requestedYear(value) {
  if (!Number.isInteger(value) || value < 1970 || value > 2200)
    throw new BadRequestError("finance_invalid_year");
  return value;
}
function scopedRow(owner, original, year) {
  requestedYear(year);
  if (original.getFloat("year") === year) return original;
  const root = original.getString("origin_row") || original.id;
  let scoped = own("finance_rows", owner).find((row) => row.getFloat("year") === year && row.getString("origin_row") === root);
  if (!scoped) {
    if (original.getFloat("year")) {
      original = owned("finance_rows", root, owner);
      if (original.getString("origin_row")) throw new BadRequestError("finance_invalid_year");
    }
    scoped = new Record(repository.findCollectionByNameOrId("finance_rows"));
    scoped.set("user", owner);
    for (const field of fields.finance_rows) scoped.set(field, original.get(field));
    scoped.set("source_subscription", original.getString("source_subscription"));
    scoped.set("year", year);
    scoped.set("origin_row", root);
    scoped.set("is_deleted", false);
    repository.save(scoped);
  }
  if (scoped.getBool("is_deleted")) throw new BadRequestError("finance_invalid_row");
  for (const [name, period] of [["finance_entries", "date"], ["finance_card_transactions", "month"], ["finance_statement_links", "month"]]) {
    for (const record of own(name, owner)) {
      if (record.getString("row_id") === root && record.getString(period).startsWith(year + "-")) {
        record.set("row_id", scoped.id);
        repository.save(record);
      }
    }
  }
  return scoped;
}
function deleteFinanceRows(owner, rowIds, year) {
  const selected = rowIds.map((id) => {
    const original = owned("finance_rows", id, owner);
    const row = yearRow(owner, original.id, year);
    if (!row || finance.isCarryoverRow(row)) throw new BadRequestError("finance_invalid_row");
    return row;
  });
  if (new Set(selected.map((row) => row.id)).size !== selected.length)
    throw new BadRequestError("finance_invalid_row");
  const rows = selected.map((row) => scopedRow(owner, owned("finance_rows", row.id, owner), year));
  const ids = new Set(rows.map((row) => row.id));
  const visible = yearRows(owner, year);
  for (const row of rows)
    if (row.getString("expense_type") === "credit_card" && visible.some((item) => item.payment_card === row.id && !ids.has(item.id)))
      throw new BadRequestError("finance_card_type_in_use");
  for (const [collection, field] of [["finance_statement_links", "month"], ["finance_card_transactions", "month"], ["finance_entries", "date"]])
    for (const item of own(collection, owner))
      if (ids.has(item.getString("row_id")) && item.getString(field).startsWith(year + "-")) repository.delete(item);
  for (const row of rows) {
    row.set("is_deleted", true);
    repository.save(row);
  }
  return { deleted_rows: rows.length };
}
function ensureDefaultCarryoverRow(owner) {
  repository.runInTransaction(() => {
    const rows = own("finance_rows", owner);
    const exists = rows.some((row) => !row.getFloat("year") && !row.getBool("is_deleted") && finance.isCarryoverRow(row.publicExport()));
    if (exists) return;
    // Upgrade the old shared automatic-row family without duplicating it.
    // Independent manual/yearly rows with the same name stay ordinary rows.
    const legacy = rows.find((row) => !row.getFloat("year") && !row.getString("origin_row") && !row.getBool("is_deleted") &&
      row.getString("kind") === "expense" && !row.getString("expense_type") && !row.getString("bill_type") &&
      !row.getBool("is_loan") && !row.getBool("is_rent") && !row.getString("payment_card") &&
      row.getString("name").normalize("NFD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/\s+/g, " ").trim() === "onceki ay eksi");
    if (legacy) {
      for (const row of rows.filter((row) => row.id === legacy.id || row.getString("origin_row") === legacy.id)) {
        row.set("is_auto_carryover", true);
        repository.save(row);
      }
      return;
    }
    save("finance_rows", owner, { name: "Önceki ay eksi", kind: "expense", notes: "", is_auto_carryover: true });
  });
}
const historyFields = ["id", ...fields.finance_entries, "source_payment"];
const rowHistoryFields = ["id", ...fields.finance_rows, "source_subscription"];
const transactionHistoryFields = ["id", ...fields.finance_card_transactions];
const historySpecs = [
  { name: "finance_entries", key: null, fields: historyFields },
  { name: "finance_rows", key: "rows", fields: rowHistoryFields },
  {
    name: "finance_card_transactions",
    key: "transactions",
    fields: transactionHistoryFields,
  },
  { name: "finance_statement_links", key: "links", fields: ["id", ...fields.finance_statement_links] },
  { name: "budget_matches", key: "matches", fields: ["id", "target_type", "target_id", "statement_id", "transaction_id", "fingerprint", "relation"] },
  { name: "calendar_moves", key: "moves", fields: ["id", "source", "source_id", "source_date", "date"] },
];
function snapshot(spec, owner) {
  return own(spec.name, owner).map((record) =>
    Object.fromEntries(spec.fields.map((key) => [key, record.get(key)])),
  );
}
function entryChange(owner, action) {
  let result, history;
  repository.runInTransaction(() => {
    const before = historySpecs.map((spec) => snapshot(spec, owner));
    result = action();
    history = { before: [], after: [] };
    for (const [index, spec] of historySpecs.entries()) {
      const after = snapshot(spec, owner);
      const previous = new Map(
        before[index].map((row) => [row.id, JSON.stringify(row)]),
      );
      const next = new Map(after.map((row) => [row.id, JSON.stringify(row)]));
      const changed = new Set(
        [...previous.keys(), ...next.keys()].filter(
          (id) => previous.get(id) !== next.get(id),
        ),
      );
      const change = {
        before: before[index].filter((row) => changed.has(row.id)),
        after: after.filter((row) => changed.has(row.id)),
      };
      if (change.before.length > 1200 || change.after.length > 1200)
        throw new BadRequestError("finance_history_invalid");
      if (spec.key && changed.size) history[spec.key] = change;
      else if (!spec.key) Object.assign(history, change);
    }
  });
  return { result, history };
}
// Validate and restore each affected record atomically, checking all expected values.
routerAdd("POST", "/api/finance/restore", (e) => {
  const owner = user(e),
    body = e.requestInfo().body;
  const changes = historySpecs.map((spec) =>
    spec.key ? (body[spec.key] ?? { before: [], after: [] }) : body,
  );
  if (
    changes.some(
      (change) =>
        !change ||
        ![change.before, change.after].every(
          (side) => Array.isArray(side) && side.length <= 1200,
        ),
    ) ||
    changes.every((change) => !change.before.length && !change.after.length)
  )
    throw new BadRequestError("finance_history_invalid");
  // Older page sessions and old backups have no expense subtype.
  for (const side of [changes[0].before, changes[0].after])
    for (const entry of side)
      if (entry && entry.payment_tag === undefined) entry.payment_tag = "";
  for (const side of [changes[1].before, changes[1].after])
    for (const row of side)
      if (row) {
        if (row.expense_type === undefined) row.expense_type = "";
        if (row.payment_card === undefined) row.payment_card = "";
        if (row.bill_type === undefined) row.bill_type = "";
        if (row.row_order === undefined) row.row_order = 0;
        if (row.is_loan === undefined) row.is_loan = false;
        if (row.is_rent === undefined) row.is_rent = false;
        if (row.is_auto_carryover === undefined) row.is_auto_carryover = false;
        if (row.loan_id === undefined) row.loan_id = "";
        if (row.year === undefined) row.year = 0;
        if (row.origin_row === undefined) row.origin_row = "";
        if (row.is_deleted === undefined) row.is_deleted = false;
      }
  for (const [index, spec] of historySpecs.entries()) {
    for (const side of [changes[index].before, changes[index].after]) {
      const ids = new Set();
      for (const record of side) {
        if (
          !record ||
          spec.fields.some(
            (key) =>
              !["amount", "row_order", "is_loan", "is_rent", "is_auto_carryover", "year", "is_deleted"].includes(key) &&
              typeof record[key] !== "string",
          ) ||
          !/^[a-z0-9]{15}$/.test(record.id) ||
          ids.has(record.id) ||
          finance.validate(spec.name, record) ||
          (record.source_subscription?.length || 0) > 200 ||
          (record.source_payment?.length || 0) > 200
        )
          throw new BadRequestError("finance_history_invalid");
        ids.add(record.id);
        if (spec.key === "matches") {
          const targetIndex = record.target_type === "finance_entries" ? 0 : record.target_type === "finance_card_transactions" ? 2 : -1;
          if (targetIndex < 0) throw new BadRequestError("finance_history_invalid");
          if (!changes[targetIndex].before.some((target) => target.id === record.target_id))
            owned(record.target_type, record.target_id, owner);
          owned("bank_statements", record.statement_id, owner);
        } else if (spec.key === "moves") {
          if (record.source !== "ledger" || !/^ledger:[a-z0-9]{15}$/.test(record.source_id) ||
              !/^\d{4}-\d{2}-\d{2}$/.test(record.source_date) || !/^\d{4}-\d{2}-\d{2}$/.test(record.date))
            throw new BadRequestError("finance_history_invalid");
          const entryId = record.source_id.slice(7);
          if ([record.source_date, record.date].some((date) => finance.validate("finance_entries", {
            row_id: entryId, date, amount: 0, status: "planned", settled_date: "",
          }))) throw new BadRequestError("finance_history_invalid");
          if (!changes[0].before.some((entry) => entry.id === entryId)) owned("finance_entries", entryId, owner);
        } else if (
          spec.key !== "rows" &&
          !changes[1].before.some((row) => row.id === record.row_id)
        )
          owned("finance_rows", record.row_id, owner);
      }
    }
  }
  const { history } = entryChange(owner, () => {
    const current = historySpecs.map(
      (spec) =>
        new Map(own(spec.name, owner).map((record) => [record.id, record])),
    );
    const expected = changes.map(
      (change) => new Map(change.after.map((record) => [record.id, record])),
    );
    for (const [index, spec] of historySpecs.entries()) {
      for (const id of new Set(
        [...changes[index].before, ...changes[index].after].map(
          (record) => record.id,
        ),
      )) {
        const actual = current[index].get(id),
          wanted = expected[index].get(id);
        if (
          !!actual !== !!wanted ||
          (actual && spec.fields.some((key) => actual.get(key) !== wanted[key]))
        )
          throw new BadRequestError("finance_history_conflict");
        if (
          !actual &&
          repository.findRecordsByFilter(spec.name, "id = {:id}", "", 1, 0, {
            id,
          }).length
        )
          throw new NotFoundError();
      }
    }
    const keepRows = new Set(changes[1].before.map((row) => row.id));
    const removedRows = new Set(
      changes[1].after
        .filter((row) => !keepRows.has(row.id))
        .map((row) => row.id),
    );
    for (const index of [0, 2]) {
      if (
        changes[index].before.some((record) => removedRows.has(record.row_id))
      )
        throw new BadRequestError("finance_history_invalid");
      for (const record of current[index].values()) {
        if (
          removedRows.has(record.getString("row_id")) &&
          (!expected[index].has(record.id) ||
            changes[index].before.some(
              (before) =>
                before.id === record.id &&
                before.row_id === record.getString("row_id"),
            ))
        )
          throw new BadRequestError("finance_history_conflict");
      }
    }
    // Rows must exist before their dependent payments and card transactions.
    for (const index of [1, 0, 2, 3, 4, 5]) {
      const spec = historySpecs[index],
        restored = new Set(changes[index].before.map((record) => record.id));
      if (index !== 1)
        for (const record of changes[index].after)
          if ((!restored.has(record.id) || index === 3) && repository.findRecordsByFilter(spec.name, "id = {:id}", "", 1, 0, { id: record.id }).length) {
            repository.delete(current[index].get(record.id));
            if (index === 3) current[index].delete(record.id);
          }
      for (const value of changes[index].before) {
        const record =
          current[index].get(value.id) ||
          new Record(repository.findCollectionByNameOrId(spec.name));
        record.id = value.id;
        record.set("user", owner);
        for (const key of spec.fields.slice(1)) record.set(key, value[key]);
        repository.save(record);
      }
    }
    for (const id of removedRows) repository.delete(current[1].get(id));
  });
  return e.json(200, { history });
});
routerAdd("POST", "/api/finance/cells/action", (e) => {
  const owner = user(e), body = e.requestInfo().body;
  if (!body || !["clear", "move"].includes(body.action) || !Array.isArray(body.cells) ||
      !body.cells.length || body.cells.length > 1200 ||
      (body.action === "move" && (!Array.isArray(body.targets) || body.targets.length !== body.cells.length)))
    throw new BadRequestError("finance_clipboard_invalid");
  const { result, history } = entryChange(owner, () => {
    const entries = own("finance_entries", owner), links = own("finance_statement_links", owner);
    const readCells = (snapshots) => {
      const seen = new Set();
      let count = 0;
      return snapshots.map((cell) => {
        if (!cell || typeof cell.row_id !== "string" ||
            !/^(19[7-9]\d|20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(cell.month) ||
            !Array.isArray(cell.entries) || (count += cell.entries.length) > 1200)
          throw new BadRequestError("finance_clipboard_invalid");
        const row = owned("finance_rows", cell.row_id, owner), key = `${cell.row_id}:${cell.month}`;
        if (seen.has(key) || finance.isCarryoverRow(row.publicExport()))
          throw new BadRequestError("finance_clipboard_invalid");
        seen.add(key);
        const current = entries.filter((entry) => entry.getString("row_id") === cell.row_id && entry.getString("date").startsWith(cell.month + "-"));
        const expected = new Map(cell.entries.map((entry) => [entry?.id, entry]));
        if (expected.size !== cell.entries.length || current.length !== expected.size ||
            current.some((entry) => !expected.has(entry.id) || historyFields.some((field) =>
              entry.get(field) !== (field === "payment_tag" || field === "source_payment" ? expected.get(entry.id)[field] || "" : expected.get(entry.id)[field]))))
          throw new BadRequestError("finance_clipboard_conflict");
        const link = links.find((link) => link.getString("row_id") === cell.row_id && link.getString("month") === cell.month);
        if ((link?.id || null) !== (cell.statement_link?.id || null) ||
            (link && link.getString("statement_id") !== cell.statement_link?.statement_id))
          throw new BadRequestError("finance_clipboard_conflict");
        return { row, month: cell.month, entries: current, link };
      });
    };
    const sources = readCells(body.cells);
    const targets = body.action === "move" ? readCells(body.targets) : [];
    if (body.action === "move" && sources.every((source, index) =>
      source.row.id === targets[index].row.id && source.month === targets[index].month))
      return { updated: 0 };
    const sourceIds = new Set(sources.flatMap((cell) => cell.entries.map((entry) => entry.id)));
    const affectedIds = new Set([...sourceIds, ...targets.flatMap((cell) => cell.entries.map((entry) => entry.id))]);
    for (const move of own("calendar_moves", owner)) {
      if (move.getString("source") === "ledger" && affectedIds.has(move.getString("source_id").replace(/^ledger:/, "")))
        repository.delete(move);
    }
    // Unlink overwritten cells. Compatible same-month card links can follow the cut.
    const keptLinks = new Map();
    if (body.action === "move") sources.forEach((source, index) => {
      const target = targets[index];
      if (source.link && source.month === target.month && target.row.getString("expense_type") === "credit_card")
        keptLinks.set(source.link.id, target);
    });
    const affectedLinks = new Map([...sources, ...targets].filter((cell) => cell.link).map((cell) => [cell.link.id, cell.link]));
    for (const link of affectedLinks.values()) repository.delete(link);
    if (body.action === "clear") {
      for (const cell of sources) for (const entry of cell.entries) repository.delete(entry);
    } else {
      for (const target of targets) for (const entry of target.entries)
        if (!sourceIds.has(entry.id)) repository.delete(entry);
      sources.forEach((source, index) => {
        const target = targets[index], [year, month] = target.month.split("-").map(Number);
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        for (const entry of source.entries) {
          const day = Math.min(Number(entry.getString("date").slice(8, 10)), lastDay);
          save("finance_entries", owner, {
            row_id: target.row.id,
            date: `${target.month}-${String(day).padStart(2, "0")}`,
          }, entry.id);
        }
      });
      for (const [id, target] of keptLinks) {
        const original = affectedLinks.get(id);
        const restored = new Record(repository.findCollectionByNameOrId("finance_statement_links"));
        restored.id = id;
        restored.set("user", owner);
        restored.set("row_id", target.row.id);
        restored.set("month", target.month);
        restored.set("statement_id", original.getString("statement_id"));
        repository.save(restored);
      }
    }
    return { updated: sources.length };
  });
  return e.json(200, { ...result, history });
});
routerAdd("POST", "/api/finance/rows/delete", (e) => {
  const owner = user(e), body = e.requestInfo().body;
  if (!body || !Array.isArray(body.row_ids) || !body.row_ids.length || body.row_ids.length > 1200 ||
      body.row_ids.some((id) => typeof id !== "string" || !/^[a-z0-9]{15}$/.test(id)) ||
      new Set(body.row_ids).size !== body.row_ids.length)
    throw new BadRequestError("finance_invalid_row");
  const year = requestedYear(body.year);
  const { result, history } = entryChange(owner, () => deleteFinanceRows(owner, body.row_ids, year));
  return e.json(200, { ...result, history });
});
routerAdd("POST", "/api/finance/rows/tag", (e) => {
  const owner = user(e), body = e.requestInfo().body;
  if (!body || !finance.ROW_TAGS.includes(body.tag) || !Array.isArray(body.rows) ||
      !body.rows.length || body.rows.length > 1200 ||
      body.rows.some((row) => !row || !/^[a-z0-9]{15}$/.test(row.id) || !finance.ROW_TAGS.includes(row.tag)) ||
      new Set(body.rows.map((row) => row.id)).size !== body.rows.length)
    throw new BadRequestError("finance_invalid_row");
  const year = requestedYear(body.year);
  const { result, history } = entryChange(owner, () => {
    const targets = body.rows.map((expected) => {
      const original = owned("finance_rows", expected.id, owner);
      const row = yearRow(owner, original.id, year);
      if (!row || finance.isCarryoverRow(row) ||
          (row.kind === "expense" ? body.tag === "salary" : !["", "salary"].includes(body.tag)))
        throw new BadRequestError("finance_invalid_row");
      if (finance.rowTag(row) !== expected.tag) throw new BadRequestError("finance_history_conflict");
      return row;
    });
    if (new Set(targets.map((row) => row.id)).size !== targets.length)
      throw new BadRequestError("finance_invalid_row");
    let tagged_rows = 0;
    for (const row of targets) {
      if (finance.rowTag(row) === body.tag && !(body.tag === "credit_card" && row.payment_card)) continue;
      save("finance_rows", owner, {
        ...finance.rowTagValues(body.tag),
        ...(row.kind !== "expense" ? { kind: body.tag === "salary" ? "salary" : "income" } : {}),
        year,
      }, row.id);
      tagged_rows++;
    }
    return { tagged_rows };
  });
  return e.json(200, { ...result, history });
});
routerAdd("POST", "/api/finance/rows/action", (e) => {
  const owner = user(e),
    body = e.requestInfo().body;
  if (
    !body ||
    !["insert_above", "insert_below", "move_up", "move_down"].includes(
      body.action,
    ) ||
    !/^[a-z0-9]{15}$/.test(body.row_id) ||
    !Array.isArray(body.expected_order) ||
    body.expected_order.length > 1200
  )
    throw new BadRequestError("finance_invalid_row");
  const { result, history } = entryChange(owner, () => {
    const year = requestedYear(body.year);
    const anchor = owned("finance_rows", body.row_id, owner);
    const expense = anchor.getString("kind") === "expense";
    let rows = yearRows(owner, year).map((row) => owned("finance_rows", row.id, owner)).filter(
      (row) => (row.getString("kind") === "expense") === expense,
    );
    if (
      rows.length !== body.expected_order.length ||
      rows.some((row, index) => row.id !== body.expected_order[index])
    )
      throw new BadRequestError("finance_history_conflict");
    const index = rows.findIndex((row) => row.id === anchor.id);
    if (index < 0) throw new BadRequestError("finance_history_conflict");
    rows = rows.map((row) => scopedRow(owner, row, year));
    let created;
    if (body.action.startsWith("insert_")) {
      if (
        !body.values ||
        (body.values.kind != null &&
          (!["salary", "income", "expense"].includes(body.values.kind) ||
            (body.values.kind === "expense") !== expense))
      )
        throw new BadRequestError("finance_invalid_row");
      created = save("finance_rows", owner, {
        ...body.values,
        kind: body.values.kind ?? anchor.getString("kind"),
        row_order: 0,
        year,
      });
      rows.splice(index + (body.action === "insert_below" ? 1 : 0), 0, created);
    } else {
      const next = index + (body.action === "move_up" ? -1 : 1);
      if (next < 0 || next >= rows.length) return { changed: false };
      [rows[index], rows[next]] = [rows[next], rows[index]];
    }
    rows.forEach((row, index) => {
      if (row.getFloat("row_order") !== index + 1) {
        row.set("row_order", index + 1);
        repository.save(row);
      }
    });
    return {
      changed: true,
      ...(created ? { row: created.publicExport() } : {}),
    };
  });
  return e.json(200, { ...result, history });
});
routerAdd("GET", "/api/finance", (e) => {
  const owner = user(e);
  ensureDefaultCarryoverRow(owner);
  const projected = require("./lib/pure/spending.js").spendingData(
    require("./lib/spending-data.js").loadSpendingData(repository, owner),
  );
  const comparisonData = financeYearData(owner);
  const statements = new Map(own("bank_statements", owner).map((statement) => [statement.id, statement.publicExport()]));
  return e.json(200, {
    ...Object.fromEntries(
      finance.COLLECTIONS.map((name) => [name, own(name, owner)]),
    ),
    entry_verifications: Object.fromEntries(
      projected.events
        .filter((event) => event.source === "ledger" && event.verification)
        .map((event) => [event.id.slice(7), event.verification]),
    ),
    card_payment_checks: Object.fromEntries(comparisonData.finance_statement_links.flatMap((link) => {
      const statement = statements.get(link.statement_id);
      return statement ? [[link.id, compareCardPayment(comparisonData, link.row_id, statement)]] : [];
    })),
  });
});
routerAdd("POST", "/api/finance/card-payment-check", (e) => {
  const owner = user(e), body = e.requestInfo().body;
  if (!body || typeof body.row_id !== "string" || typeof body.statement_id !== "string")
    throw new BadRequestError("finance_invalid_statement_link");
  const row = owned("finance_rows", body.row_id, owner);
  const statement = owned("bank_statements", body.statement_id, owner);
  if (row.getString("kind") !== "expense" || row.getString("expense_type") !== "credit_card")
    throw new BadRequestError("finance_invalid_statement_link");
  return e.json(200, compareCardPayment(financeYearData(owner), row.id, statement.publicExport()));
});
routerAdd("POST", "/api/finance/opening-deficit", (e) => {
  const owner = user(e), body = e.requestInfo().body;
  const year = requestedYear(body?.year);
  if ((body.amount !== null && !finance.amount(body.amount)) || !finance.amount(body.expected_amount))
    throw new BadRequestError("finance_invalid_entry");
  const { history } = entryChange(owner, () => {
    const data = financeYearData(owner);
    const currentYear = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date()));
    if (year !== (financeYears.firstYear(data) ?? currentYear))
      throw new BadRequestError("finance_opening_deficit_locked");
    const row = financeYears.rowsForYear(data.finance_rows, year, data).find(finance.isCarryoverRow);
    if (!row) throw new BadRequestError("finance_invalid_row");
    const month = `${year}-01`;
    const opening = data.finance_entries.filter((entry) =>
      data.finance_rows.some((item) => item.id === entry.row_id && finance.isCarryoverRow(item)) && entry.date.startsWith(month));
    const total = opening.reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0);
    if (total !== Math.round(body.expected_amount * 100))
      throw new BadRequestError("finance_history_conflict");
    if (body.amount === null) {
      for (const entry of opening) repository.delete(owned("finance_entries", entry.id, owner));
      return;
    }
    const scoped = scopedRow(owner, owned("finance_rows", row.id, owner), year);
    for (const entry of opening.slice(1)) repository.delete(owned("finance_entries", entry.id, owner));
    save("finance_entries", owner, {
      row_id: scoped.id, date: `${month}-01`, amount: body.amount,
      status: "settled", settled_date: `${month}-01`, payment_tag: "", notes: opening[0]?.notes || "",
    }, opening[0]?.id);
  });
  return e.json(200, { history });
});
routerAdd("POST", "/api/finance/salary-tag", (e) => {
  const owner = user(e), body = e.requestInfo().body;
  if (!body || typeof body.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month) || !finance.SALARY_TAGS.includes(body.tag))
    throw new BadRequestError("finance_invalid_benchmark");
  let result;
  repository.runInTransaction(() => {
    const existing = own("finance_benchmarks", owner).find((row) => row.getString("month") === body.month);
    if (!existing && body.tag === "") { result = { month: body.month, salary_tag: "" }; return; }
    result = save("finance_benchmarks", owner, { month: body.month, salary_tag: body.tag }, existing?.id).publicExport();
  });
  return e.json(200, result);
});
for (const name of finance.COLLECTIONS) {
  routerAdd("POST", `/api/finance/${name}`, (e) => {
    const owner = user(e),
      body = e.requestInfo().body;
    if (name === "finance_rows") requestedYear(body.year);
    if (name === "finance_benchmarks") {
      const found = own(name, owner).find(
        (row) => row.getString("month") === body.month,
      );
      return e.json(
        200,
        save(
          name,
          owner,
          { ...body, source: "manual", updated_at: new Date().toISOString() },
          found?.id,
        ),
      );
    }
    if (
      name === "finance_entries" ||
      name === "finance_rows" ||
      name === "finance_card_transactions"
    ) {
      const { result, history } = entryChange(owner, () =>
        save(name, owner, body),
      );
      return e.json(201, { ...result.publicExport(), history });
    }
    return e.json(201, save(name, owner, body));
  });
  routerAdd("PUT", `/api/finance/${name}/{id}`, (e) => {
    if (name === "finance_rows") requestedYear(e.requestInfo().body.year);
    const owner = user(e),
      action = () =>
        save(name, owner, e.requestInfo().body, e.request.pathValue("id"));
    if (
      name === "finance_entries" ||
      name === "finance_rows" ||
      name === "finance_card_transactions"
    ) {
      const { result, history } = entryChange(owner, action);
      return e.json(200, { ...result.publicExport(), history });
    }
    return e.json(200, action());
  });
  routerAdd("DELETE", `/api/finance/${name}/{id}`, (e) => {
    if (name === "finance_rows") {
      const owner = user(e), year = requestedYear(Number(e.request.url.query().get("year")));
      const { history } = entryChange(owner, () => deleteFinanceRows(owner, [e.request.pathValue("id")], year));
      return e.json(200, { deleted: true, history });
    }
    if (
      name === "finance_entries" ||
      name === "finance_rows" ||
      name === "finance_card_transactions"
    ) {
      const owner = user(e);
      const { history } = entryChange(owner, () =>
        repository.delete(owned(name, e.request.pathValue("id"), owner)),
      );
      return e.json(200, { deleted: true, history });
    }
    repository.delete(owned(name, e.request.pathValue("id"), user(e)));
    return e.json(200, { deleted: true });
  });
}
// Names and amounts are applied together; a failed cell rolls back the entire import.
routerAdd("POST", "/api/finance/cells", (e) => {
  const owner = user(e),
    { year, cells, rows = [] } = e.requestInfo().body;
  if (
    !Number.isInteger(year) ||
    year < 1970 ||
    year > 2200 ||
    !Array.isArray(cells) ||
    !Array.isArray(rows) ||
    rows.length > 1200 ||
    (!cells.length && !rows.length) ||
    cells.length + rows.length > 1200
  )
    throw new BadRequestError("finance_clipboard_invalid");
  const { history } = entryChange(owner, () => {
    const rowIds = new Map();
    for (const row of rows) {
      if (
        !row ||
        typeof row.row_id !== "string" ||
        rowIds.has(row.row_id) ||
        finance.validate("finance_rows", {
          name: row.name,
          kind: row.kind,
          notes: "",
        })
      )
        throw new BadRequestError("finance_clipboard_invalid");
      if (/^new:\d+$/.test(row.row_id)) {
        rowIds.set(
          row.row_id,
          save("finance_rows", owner, {
            name: row.name,
            kind: row.kind,
            notes: "",
            year,
          }).id,
        );
      } else {
        const existing = owned("finance_rows", row.row_id, owner);
        const view = yearRow(owner, existing.id, year);
        const rowValue = (value, key) => ["row_order", "year"].includes(key)
          ? value[key] ?? 0
          : ["is_loan", "is_rent", "is_auto_carryover", "is_deleted"].includes(key) ? value[key] ?? false : value[key] || "";
        if (
          !view || view.id !== existing.id || !row.expected ||
          rowHistoryFields.some(
            (key) =>
              rowValue(view, key) !== rowValue(row.expected, key),
          ) ||
          existing.getString("kind") !== row.kind
        )
          throw new BadRequestError("finance_clipboard_conflict");
        const scoped = save("finance_rows", owner, { name: row.name, year }, existing.id);
        rowIds.set(row.row_id, scoped.id);
      }
    }
    const entries = own("finance_entries", owner),
      seen = new Set();
    let recordCount = 0;
    for (const sourceCell of cells) {
      const cell = sourceCell && {
        ...sourceCell,
        row_id: rowIds.get(sourceCell.row_id) || sourceCell.row_id,
      };
      if (
        !cell ||
        typeof cell.row_id !== "string" ||
        !Number.isInteger(cell.month) ||
        cell.month < 1 ||
        cell.month > 12
      )
        throw new BadRequestError("finance_clipboard_invalid");
      owned("finance_rows", cell.row_id, owner);
      const date = `${year}-${String(cell.month).padStart(2, "0")}-01`,
        key = cell.row_id + ":" + cell.month;
      if (
        seen.has(key) ||
        finance.validate("finance_entries", {
          row_id: cell.row_id,
          date,
          amount: cell.amount,
          status: "planned",
          settled_date: "",
        })
      )
        throw new BadRequestError("finance_clipboard_invalid");
      seen.add(key);
      const matches = entries.filter(
        (entry) =>
          entry.getString("row_id") === cell.row_id &&
          entry.getString("date").startsWith(date.slice(0, 7)),
      );
      if (matches.length > 1)
        throw new BadRequestError("finance_clipboard_multiple");
      const existing = matches[0];
      if (
        (existing?.id ?? null) !== cell.entry_id ||
        (existing && existing.getFloat("amount") !== cell.expected_amount)
      )
        throw new BadRequestError("finance_clipboard_conflict");
      if (Object.hasOwn(cell, "records")) {
        if (
          !Array.isArray(cell.records) ||
          !cell.records.length ||
          (recordCount += cell.records.length) > 1200
        )
          throw new BadRequestError("finance_clipboard_invalid");
        let total = 0;
        for (const record of cell.records) {
          if (
            !record ||
            finance.validate("finance_entries", {
              ...record,
              date,
              row_id: cell.row_id,
            })
          )
            throw new BadRequestError("finance_clipboard_invalid");
          total += Math.round(record.amount * 100);
        }
        if (total !== Math.round(cell.amount * 100))
          throw new BadRequestError("finance_clipboard_invalid");
        cell.records.forEach((record, index) => {
          const values = {
            amount: record.amount,
            status: record.status,
            settled_date: record.settled_date,
            payment_tag: record.payment_tag || "",
          };
          if (index === 0 && existing)
            save("finance_entries", owner, values, existing.id);
          else
            save("finance_entries", owner, {
              ...values,
              row_id: cell.row_id,
              date,
              notes: "",
            });
        });
      } else if (existing)
        save("finance_entries", owner, { amount: cell.amount }, existing.id);
      else
        save("finance_entries", owner, {
          row_id: cell.row_id,
          date,
          amount: cell.amount,
          status: "planned",
          settled_date: "",
          notes: "",
        });
    }
  });
  return e.json(200, { updated: cells.length + rows.length, history });
});
routerAdd("POST", "/api/finance/plan", (e) => {
  const owner = user(e),
    body = e.requestInfo().body;
  const row = owned("finance_rows", body.row_id, owner);
  const { year, from_month, to_month, day, amount } = body;
  if (
    ![year, from_month, to_month, day].every(Number.isInteger) ||
    year < 1970 ||
    year > 2200 ||
    from_month < 1 ||
    to_month > 12 ||
    from_month > to_month ||
    day < 1 ||
    day > 31
  )
    throw new BadRequestError("finance_invalid_plan");
  let created = 0;
  repository.runInTransaction(() => {
    const entries = own("finance_entries", owner);
    for (let month = from_month; month <= to_month; month++) {
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      if (
        entries.some(
          (entry) =>
            entry.getString("row_id") === row.id &&
            entry.getString("date").startsWith(prefix),
        )
      )
        continue;
      const date = `${prefix}-${String(Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate())).padStart(2, "0")}`;
      save("finance_entries", owner, {
        row_id: row.id,
        date,
        amount,
        status: "planned",
        settled_date: "",
        notes: body.notes || "",
      });
      created++;
    }
  });
  return e.json(200, { created });
});
routerAdd("POST", "/api/finance/salary-plan", (e) => {
  const owner = user(e),
    { year, row_id, name } = e.requestInfo().body;
  if (!Number.isInteger(year) || year < 1970 || year > 2200)
    throw new BadRequestError("finance_invalid_plan");
  const history = own("salary_history", owner).sort((a, b) =>
    b.getString("effective_date").localeCompare(a.getString("effective_date")),
  );
  if (!history.length) throw new BadRequestError("finance_invalid_salary");
  let created = 0;
  repository.runInTransaction(() => {
    const row = row_id
      ? owned("finance_rows", row_id, owner)
      : yearRows(owner, year).map((item) => owned("finance_rows", item.id, owner)).find(
          (row) =>
            row.getString("kind") === "salary" &&
            row.getString("name") === name,
        ) || save("finance_rows", owner, { name, kind: "salary", notes: "", year });
    if (row.getString("kind") !== "salary")
      throw new BadRequestError("finance_invalid_row");
    const entries = own("finance_entries", owner);
    for (let month = 1; month <= 12; month++) {
      const prefix = `${year}-${String(month).padStart(2, "0")}`,
        date = `${prefix}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
      const salary = history.find(
        (item) => item.getString("effective_date") <= date,
      );
      if (
        !salary ||
        entries.some(
          (item) =>
            item.getString("row_id") === row.id &&
            item.getString("date").startsWith(prefix),
        )
      )
        continue;
      save("finance_entries", owner, {
        row_id: row.id,
        date,
        amount: salary.getFloat("amount"),
        status: "planned",
        settled_date: "",
        notes: "",
      });
      created++;
    }
  });
  return e.json(200, { created });
});
// Keep old clients from copying subscription payments into the manual ledger.
routerAdd("POST", "/api/finance/import-payments", (e) => {
  user(e);
  throw new ForbiddenError("finance_manual_only");
});
async function updateReference(owner, month) {
  const today = references.today();
  if (!finance.rateDates(month, today).length) throw new BadRequestError("finance_invalid_month");
  const existing = own("finance_benchmarks", owner).find((row) => row.getString("month") === month);
  const minimum = existing?.getFloat("minimum_wage") || 0;
  const [rates, fetchedMinimum] = await Promise.all([
    references.fetchRates(month, today),
    minimum > 0 ? Promise.resolve(null) : references.fetchMinimumWage(month, today),
  ]);
  if (!rates && !fetchedMinimum) throw new BadRequestError("finance_rates_unavailable");
  const current = own("finance_benchmarks", owner).find((row) => row.getString("month") === month);
  const newMinimum = current?.getFloat("minimum_wage") > 0 ? null : fetchedMinimum;
  const sources = [...new Set([current?.getString("source") || "", rates ? "TCMB" : "", newMinimum ? "CSGB" : ""]
    .flatMap((value) => value.split("/").map((item) => item.trim()).filter(Boolean)))];
  const record = save("finance_benchmarks", owner, {
    month,
    ...(rates || {}),
    ...(newMinimum ? { minimum_wage: newMinimum } : {}),
    source: sources.join(" / "),
    updated_at: rates ? new Date().toISOString() : current?.getString("updated_at") || "",
  }, current?.id);
  const missing = [];
  if (!rates) missing.push("rates");
  if (!(record.getFloat("minimum_wage") > 0)) missing.push("minimum_wage");
  return { ...record.publicExport(), missing };
}
routerAdd("POST", "/api/finance/rates", async (e) => {
  return e.json(
    200,
    await updateReference(user(e), e.requestInfo().body.month),
  );
});
routerAdd("POST", "/api/finance/rates-year", async (e) => {
  const owner = user(e),
    { year } = e.requestInfo().body;
  if (!Number.isInteger(year) || year < 1970 || year > 2200)
    throw new BadRequestError("finance_invalid_plan");
  const today = references.today();
  const months = Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  ).filter((month) => month <= today.slice(0, 7));
  const existing = own("finance_benchmarks", owner);
  const pending = months.filter(
    (month) =>
      !existing.some(
        (row) =>
          row.getString("month") === month &&
          row.getFloat("usd") > 0 &&
          row.getFloat("eur") > 0 &&
          row.getFloat("minimum_wage") > 0 &&
          (month < today.slice(0, 7) ||
            row.getString("updated_at").startsWith(today)),
      ),
  );
  let updated = 0,
    partial = 0,
    failed = 0;
  for (let i = 0; i < pending.length; i += 3) {
    const results = await Promise.allSettled(
      pending.slice(i, i + 3).map((month) => updateReference(owner, month)),
    );
    updated += results.filter((result) => result.status === "fulfilled").length;
    partial += results.filter((result) => result.status === "fulfilled" && result.value.missing.length).length;
    failed += results.filter((result) => result.status === "rejected").length;
  }
  return e.json(200, { updated, failed, partial, unchanged: pending.length === 0 });
});
