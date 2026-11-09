const { DataRecord } = require("../../storage.cjs");
const {
  BadRequestError,
  NotFoundError,
  HttpError,
} = require("../../errors.cjs");
const { validDate } = require("./pure/backfill-schedule.js");
const { spendingData } = require("./pure/spending.js");
const { loadSpendingData } = require("./spending-data.js");
const { rowForYear, rootId } = require("./pure/finance-years.js");
const {
  CALENDAR_MOVE_SCOPES,
  ledgerCalendarTargets,
} = require("./pure/calendar-move-scope.js");
const SOURCES = {
  ledger: ["ledger", "finance_entries"],
  statement: ["statement", "bank_statements"],
  manual_card: ["manual", "finance_card_transactions"],
  manual_bill: ["bill", "manual_bills"],
};
function sourceReference(source, id) {
  const spec = SOURCES[source];
  const [prefix, recordId, ...suffix] = String(id || "").split(":");
  if (
    !spec ||
    prefix !== spec[0] ||
    !recordId ||
    (source === "statement" ? !suffix.length : suffix.length)
  )
    return null;
  return {
    prefix,
    collection: spec[1],
    recordId,
    suffix: suffix.length ? ":" + suffix.join(":") : "",
  };
}
function moveSourceCalendar(app, owner, input) {
  const { source, source_id: id, from_date: from, to_date: to } = input;
  const mode = input.mode === undefined ? "calendar" : input.mode;
  const scope = input.scope === undefined ? "single" : input.scope;
  if (
    !["calendar", "ledger"].includes(mode) ||
    !CALENDAR_MOVE_SCOPES.includes(scope) ||
    (scope !== "single" && (source !== "ledger" || mode !== "calendar")) ||
    (mode === "ledger" && source !== "ledger") ||
    !sourceReference(source, id) ||
    !validDate(from) ||
    !validDate(to) ||
    (from === to && scope === "single")
  )
    throw new BadRequestError("calendar_move_invalid");
  return app.runInTransaction((tx) => {
    const data = loadSpendingData(tx, owner);
    const spending = spendingData(data);
    const event = spending.events.find(
      (event) => event.id === id && event.source === source,
    );
    if (!event || !validDate(event.date) || event.undated)
      throw new NotFoundError();
    const previous = tx.findRecordsByFilter(
      "calendar_moves",
      "user = {:owner} && source = {:source} && source_id = {:id}",
      "",
      1,
      0,
      { owner, source, id },
    )[0];
    const currentDate =
      previous?.getString("source_date") === event.date
        ? previous.getString("date")
        : event.date;
    if (currentDate !== from) throw new HttpError(409, "calendar_move_changed");
    if (
      scope !== "single" &&
      (input.expected_source_date !== event.date ||
        input.expected_row_id !== event.row_id)
    )
      throw new HttpError(409, "calendar_move_changed");
    if (mode === "ledger") {
      if (
        input.expected_source_date !== event.date ||
        typeof input.expected_amount !== "number" ||
        input.expected_amount !== event.amount
      )
        throw new HttpError(409, "calendar_move_changed");
      const ref = sourceReference(source, id);
      const entry = tx.findRecordById("finance_entries", ref.recordId);
      if (entry.getString("user") !== owner) throw new NotFoundError();
      const year = Number(to.slice(0, 4));
      let row = rowForYear(
        data.finance_rows,
        entry.getString("row_id"),
        year,
        data,
      );
      if (!row) {
        const original = data.finance_rows.find(
          (item) => item.id === entry.getString("row_id"),
        );
        if (
          !original ||
          data.finance_rows.some(
            (item) =>
              item.year === year && item.origin_row === rootId(original),
          )
        )
          throw new BadRequestError("finance_invalid_year");
        const created = new DataRecord(
          tx.findCollectionByNameOrId("finance_rows"),
        );
        for (const field of [
          "name",
          "kind",
          "expense_type",
          "notes",
          "source_subscription",
          "payment_card",
          "bill_type",
          "row_order",
          "is_loan",
          "is_rent",
          "is_auto_carryover",
          "loan_id",
          "loan_principal",
        ])
          created.set(field, original[field]);
        created.set("user", owner);
        created.set("year", year);
        created.set("origin_row", rootId(original));
        tx.save(created);
        row = created.publicExport();
      }
      entry.set("row_id", row.id);
      entry.set("date", to);
      const reason = require("./pure/finance.js").validate(
        "finance_entries",
        entry.publicExport(),
      );
      if (reason) throw new BadRequestError(reason);
      tx.save(entry);
      if (previous) tx.delete(previous);
      return { updated: 1, ledger_updated: true };
    }
    if (scope !== "single") {
      let targets;
      try {
        targets = ledgerCalendarTargets(
          [...spending.events, ...(spending.pending_bills || [])],
          data.finance_rows,
          event,
          to,
          scope,
        );
      } catch (error) {
        if (error.message === "calendar_move_invalid")
          throw new BadRequestError(error.message);
        throw error;
      }
      const previousMoves = new Map(
        (data.calendar_moves || [])
          .filter((move) => move.source === "ledger")
          .map((move) => [move.source_id, move.id]),
      );
      let updated = 0;
      for (const target of targets) {
        const previousId = previousMoves.get(target.event.id);
        const prior = previousId
          ? tx.findRecordById("calendar_moves", previousId)
          : null;
        updated += placeCalendarDate(
          tx,
          owner,
          target.event,
          target.date,
          prior,
        ).updated;
      }
      return { updated, scope };
    }
    return placeCalendarDate(tx, owner, event, to, previous);
  });
}

function placeCalendarDate(tx, owner, event, to, previous) {
  if (to === event.date) {
    if (previous) tx.delete(previous);
    return { updated: previous ? 1 : 0 };
  }
  if (
    previous?.getString("source_date") === event.date &&
    previous.getString("date") === to
  )
    return { updated: 0 };
  const record =
    previous || new DataRecord(tx.findCollectionByNameOrId("calendar_moves"));
  for (const [key, value] of Object.entries({
    user: owner,
    source: event.source,
    source_id: event.id,
    source_date: event.date,
    date: to,
  }))
    record.set(key, value);
  tx.save(record);
  return { updated: 1, calendar_move: record.publicExport() };
}
module.exports = { sourceReference, moveSourceCalendar };
