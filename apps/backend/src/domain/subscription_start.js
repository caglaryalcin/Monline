const { onRecordCreate, onRecordUpdate } = require("../runtime.cjs");
const { trialEndDate } = require("./lib/pure/subscription-trial.mjs");
const { automaticStartDate } = require("./lib/pure/subscription-start.js");
const { lastWeekdayOfMonth } = require("./lib/pure/last-weekday.mjs");

function normalizeWeekdaySchedule(event) {
  if (event.record.get("__monline_restore") === true) return;
  const date = event.record.getString("next_payment").slice(0, 10);
  const cycle = event.app.findRecordById("cycles", event.record.getString("cycle")).getString("name");
  if (cycle !== "Last-Weekday" || require("./lib/pure/subscription-trial.mjs").isTrialDate(event.record, date)) return;
  const normalized = lastWeekdayOfMonth(date);
  if (normalized) event.record.set("next_payment", normalized);
}

onRecordCreate((e) => {
  normalizeWeekdaySchedule(e);
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
  const trialEnd = Number(e.record.get("trial_duration")) > 0 ? trialEndDate(e.record) : "";
  if (trialEnd && e.record.getString("next_payment").slice(0, 10) <= trialEnd)
    e.record.set("billing_anchor_day", Number(trialEnd.slice(8, 10)));
  e.next();
}, "subscriptions");

onRecordUpdate((e) => {
  normalizeWeekdaySchedule(e);
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
  const trialEnd = Number(e.record.get("trial_duration")) > 0 ? trialEndDate(e.record) : "";
  if (trialEnd && e.record.getString("next_payment").slice(0, 10) <= trialEnd)
    e.record.set("billing_anchor_day", Number(trialEnd.slice(8, 10)));
  e.next();
  e.record.set("__monline_schedule_advance", false);
}, "subscriptions");
