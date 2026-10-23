const { onRecordCreate, onRecordUpdate } = require("../runtime.cjs");
const { automaticStartDate } = require("./lib/pure/subscription-start.js");

onRecordCreate((e) => {
  // New subscriptions already use durable period records. Only records restored
  // from an older version need the one-off historical recovery.
  if (e.record.get("__monline_restore") !== true)
    e.record.set("calendar_history_recovery_passes", 2);
  const anchor = Number(e.record.get("billing_anchor_day"));
  if (
    e.record.get("__monline_restore") !== true ||
    !Number.isInteger(anchor) ||
    anchor < 1 ||
    anchor > 31
  )
    e.record.set(
      "billing_anchor_day",
      Number(e.record.get("__monline_initial_billing_day")) ||
        Number(e.record.getString("next_payment").slice(8, 10)),
    );
  if (
    e.record.get("__monline_restore") !== true &&
    !e.record.getString("start_date")
  ) {
    const [cycle] = e.app.findRecordsByFilter(
      "cycles",
      "id = {:id}",
      "",
      1,
      0,
      { id: e.record.getString("cycle") },
    );
    if (cycle)
      e.record.set(
        "start_date",
        automaticStartDate(
          e.record.getString("next_payment").slice(0, 10),
          cycle.getString("name"),
          Number(e.record.get("frequency")) || 1,
        ),
      );
  }
  e.next();
}, "subscriptions");

onRecordUpdate((e) => {
  if (e.record.get("__monline_restore") !== true) {
    const original = e.record.original();
    const rescheduled =
      e.record.get("__monline_schedule_advance") !== true &&
      e.record.getString("next_payment") !== original.getString("next_payment");
    e.record.set(
      "billing_anchor_day",
      rescheduled
        ? Number(e.record.getString("next_payment").slice(8, 10))
        : Number(original.get("billing_anchor_day")) ||
            Number(original.getString("next_payment").slice(8, 10)),
    );
  }
  e.next();
  e.record.set("__monline_schedule_advance", false);
}, "subscriptions");
