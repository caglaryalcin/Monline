const { BadRequestError } = require("../../errors.cjs");
const { formatLocalDate } = require("./date-helpers.js");
const { lastWeekdayOfMonth } = require("./pure/last-weekday.mjs");
const { isTrialDate } = require("./pure/subscription-trial.mjs");

/** Called inside the user-save transaction, after the new preferences are stored. */
function rescheduleBusinessCalendar(app, user, previous) {
  const today = formatLocalDate(new Date());
  const oldCalendar = { country: previous.getString("country"), region: previous.getString("region") };
  const calendar = { country: user.getString("country"), region: user.getString("region") };
  const cycles = new Set(app.findRecordsByFilter("cycles", "name = 'Last-Weekday'").map((cycle) => cycle.id));
  const subscriptions = app.findRecordsByFilter("subscriptions", "user = {:owner} && inactive = false", "", 0, 0, { owner: user.id });
  for (const sub of subscriptions) {
    if (!cycles.has(sub.getString("cycle")) || sub.getString("record_type") === "credit") continue;
    const records = app.findRecordsByFilter("payment_records", "subscription_id = {:id} && user = {:owner}", "", 0, 0, { id: sub.id, owner: user.id });
    const next = sub.getString("next_payment").slice(0, 10);
    const lockedNext = records.some((record) =>
      (record.getString("scheduled_date") || record.getString("due_date").slice(0, 10)) === next &&
      record.getString("paid_at"));
    for (const record of records) {
      if (record.getString("paid_at")) continue;
      const due = record.getString("due_date").slice(0, 10);
      const scheduled = record.getString("scheduled_date");
      const origin = scheduled || due;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(origin) || origin < today || due < today ||
          isTrialDate(sub, origin) || origin !== lastWeekdayOfMonth(origin, oldCalendar)) continue;
      const target = lastWeekdayOfMonth(origin, calendar);
      if (target < today || target === origin) continue;
      // A manually moved payment keeps its chosen date and follows the new period origin.
      if (scheduled && scheduled !== due) record.set("scheduled_date", target);
      else {
        if (records.some((other) => other.id !== record.id && other.getString("due_date").slice(0, 10) === target))
          throw new BadRequestError("holiday_calendar_payment_conflict");
        record.set("due_date", target);
        if (scheduled) record.set("scheduled_date", target);
      }
      app.save(record);
    }
    if (!lockedNext && next >= today && !isTrialDate(sub, next)) {
      const target = lastWeekdayOfMonth(next, calendar);
      if (target && target >= today && target !== next) {
        sub.set("__monline_schedule_advance", true);
        sub.set("next_payment", target);
        app.save(sub);
      }
    }
  }
}

module.exports = { rescheduleBusinessCalendar };
