const { DataRecord } = require("../../storage.cjs");
const {
  BadRequestError,
  NotFoundError,
  HttpError,
} = require("../../errors.cjs");
const { validDate } = require("./pure/backfill-schedule.js");
const { advanceDate } = require("./date-helpers.js");
const { occurrenceIsAllowed } = require("./pure/subscription-limits.js");

function projectedOccurrence(app, sub, date) {
  if (
    sub.getBool("calendar_projection_hidden") ||
    sub.getBool("inactive") ||
    sub.getString("record_type") === "credit"
  )
    return false;
  let cursor = sub.getString("next_payment").slice(0, 10);
  const start = sub.getString("start_date").slice(0, 10);
  const end = [sub.getString("end_date"), sub.getString("cancellation_date")]
    .filter(Boolean)
    .sort()[0];
  if (!validDate(cursor) || date < cursor || (start && date < start))
    return false;
  const cycle = app
    .findRecordById("cycles", sub.getString("cycle"))
    .getString("name");
  const frequency = sub.getFloat("frequency");
  if (cycle === "One-Time") return date === cursor;
  if (
    ![
      "Daily",
      "Weekly",
      "Monthly",
      "Quarterly",
      "Half-Yearly",
      "Yearly",
    ].includes(cycle) ||
    !Number.isInteger(frequency) ||
    frequency < 1
  )
    return false;
  const anchor =
    sub.getFloat("billing_anchor_day") || Number(cursor.slice(8, 10));
  let index = sub.getFloat("payments_completed");
  for (let guard = 0; guard < 5000 && cursor <= date; guard++, index++) {
    if (!occurrenceIsAllowed(cursor, end, index, sub.getFloat("payment_limit")))
      return false;
    if (cursor === date) return true;
    const next = advanceDate(
      new Date(cursor + "T12:00:00Z"),
      cycle,
      frequency,
      anchor,
    )
      .toISOString()
      .slice(0, 10);
    if (next <= cursor) return false;
    cursor = next;
  }
  return false;
}

function moveCalendarPayment(app, userId, input) {
  const {
    from_date: from,
    to_date: to,
    payment_id: paymentId,
    subscription_id: subscriptionId,
  } = input;
  if (
    !validDate(from) ||
    !validDate(to) ||
    from === to ||
    (!paymentId && !subscriptionId)
  )
    throw new BadRequestError("calendar_move_invalid");
  return app.runInTransaction((tx) => {
    let record, sub;
    if (paymentId) {
      record = tx.findRecordById("payment_records", String(paymentId));
      if (record.getString("user") !== userId) throw new NotFoundError();
      if (record.getString("due_date").slice(0, 10) !== from)
        throw new HttpError(409, "calendar_move_changed");
    }
    const subId = record
      ? record.getString("subscription_id")
      : String(subscriptionId);
    if (subId) {
      sub = tx.findRecordById("subscriptions", subId);
      if (sub.getString("user") !== userId) throw new NotFoundError();
      if (sub.getString("record_type") === "credit")
        throw new BadRequestError("calendar_move_invalid");
    }
    const related = sub
      ? tx.findRecordsByFilter(
          "payment_records",
          "user = {:owner} && subscription_id = {:sub}",
          "",
          0,
          0,
          { owner: userId, sub: sub.id },
        )
      : [record];
    let moving = related.filter(
      (item) => item.getString("due_date").slice(0, 10) === from,
    );
    if (!moving.length) {
      if (!sub || !projectedOccurrence(tx, sub, from))
        throw new HttpError(409, "calendar_move_changed");
      if (related.some((item) => item.getString("scheduled_date") === from))
        throw new HttpError(409, "calendar_move_changed");
      record = new DataRecord(tx.findCollectionByNameOrId("payment_records"));
      for (const key of [
        "name",
        "currency",
        "category",
        "payment_method",
        "payer",
      ])
        record.set(key, sub.get(key));
      record.set("subscription_id", sub.id);
      record.set("user", userId);
      record.set("amount", sub.get("price"));
      record.set("paid_at", "");
      record.set("auto_paid", false);
      moving = [record];
    }
    const origin = moving[0].getString("scheduled_date") || from;
    if (
      sub &&
      (related.some(
        (item) =>
          !moving.includes(item) &&
          item.getString("due_date").slice(0, 10) === to,
      ) ||
        (to !== origin && projectedOccurrence(tx, sub, to)))
    )
      throw new HttpError(409, "calendar_move_conflict");
    for (const item of moving) {
      item.set("scheduled_date", item.getString("scheduled_date") || from);
      item.set("due_date", to);
      tx.save(item);
    }
    return { updated: moving.length, payment: moving[0].publicExport() };
  });
}
function calendarNextPayment(app, sub) {
  const date = sub.getString("next_payment").slice(0, 10);
  const moved = app.findRecordsByFilter(
    "payment_records",
    "user = {:owner} && subscription_id = {:sub} && scheduled_date = {:date}",
    "",
    1,
    0,
    { owner: sub.getString("user"), sub: sub.id, date },
  );
  return moved[0]?.getString("due_date").slice(0, 10) || date;
}
module.exports = {
  moveCalendarPayment,
  projectedOccurrence,
  calendarNextPayment,
};
