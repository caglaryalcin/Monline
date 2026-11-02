const { validDate } = require("./backfill-schedule.js");
const { rootId } = require("./finance-years.js");

const CALENDAR_MOVE_SCOPES = ["single", "future", "past", "all"];
const monthIndex = (date) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;

function ledgerCalendarTargets(events, rows, selected, to, scope) {
  if (
    !CALENDAR_MOVE_SCOPES.includes(scope) ||
    !validDate(to) ||
    !validDate(selected.date)
  )
    throw new Error("calendar_move_invalid");
  if (scope === "single") return [{ event: selected, date: to }];
  const row = rows.find((row) => row.id === selected.row_id);
  if (selected.source !== "ledger" || row?.kind !== "expense")
    throw new Error("calendar_move_invalid");
  const related = new Set(
    rows
      .filter((item) => item.kind === "expense" && rootId(item) === rootId(row))
      .map((item) => item.id),
  );
  const anchor = monthIndex(selected.date);
  const offset = monthIndex(to) - anchor;
  const day = Number(to.slice(8, 10));
  return events
    .filter(
      (event) =>
        event.source === "ledger" &&
        related.has(event.row_id) &&
        !event.undated &&
        validDate(event.date) &&
        (scope !== "future" || monthIndex(event.date) >= anchor) &&
        (scope !== "past" || monthIndex(event.date) <= anchor),
    )
    .map((event) => {
      const index = monthIndex(event.date) + offset;
      const year = Math.floor(index / 12);
      if (year < 0 || year > 9999) throw new Error("calendar_move_invalid");
      const month = `${String(year).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
      const end = new Date(`${month}-01T12:00:00Z`);
      end.setUTCMonth(end.getUTCMonth() + 1, 0);
      return {
        event,
        date: `${month}-${String(Math.min(day, end.getUTCDate())).padStart(2, "0")}`,
      };
    });
}

module.exports = { CALENDAR_MOVE_SCOPES, ledgerCalendarTargets };
