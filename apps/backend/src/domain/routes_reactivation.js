const { repository, Record, routerAdd, UnauthorizedError, NotFoundError, BadRequestError } = require("../runtime.cjs");
const { validDate } = require("./lib/pure/backfill-schedule.js");

routerAdd("POST", "/api/subscriptions/{id}/reactivate", (e) => {
  if (!e.auth || e.auth.collection().name !== "users") throw new UnauthorizedError();
  const body = e.requestInfo().body || {};
  if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price < 0 || body.price > 1e12)
    throw new BadRequestError("reactivate_invalid_amount");
  const offset = body.utc_offset_minutes, paidOffset = body.paid_utc_offset_minutes;
  if (![offset, paidOffset].every((value) => Number.isInteger(value) && value >= -840 && value <= 840))
    throw new BadRequestError("reactivate_invalid_dates");
  const now = new Date();
  const today = new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  if (!validDate(body.paid_date) || body.paid_date < "1970-01-01" || body.paid_date > today ||
      !validDate(body.next_payment) || body.next_payment <= today || body.next_payment <= body.paid_date ||
      body.next_payment > "2200-12-31") throw new BadRequestError("reactivate_invalid_dates");
  const paidAt = new Date(Date.parse(body.paid_date + "T00:00:00Z") + paidOffset * 60000);
  if (paidAt > now) throw new BadRequestError("reactivate_invalid_dates");
  repository.runInTransaction((tx) => {
    const sub = tx.findRecordById("subscriptions", e.request.pathValue("id"));
    if (sub.getString("user") !== e.auth.id) throw new NotFoundError();
    if (!sub.getBool("inactive") || sub.getString("next_payment") !== body.expected_next_payment ||
        sub.getString("currency") !== body.expected_currency)
      throw new BadRequestError("reactivate_changed");
    const limit = sub.getFloat("payment_limit");
    if ((limit > 0 && sub.getFloat("payments_completed") >= limit) ||
        ["end_date", "cancellation_date"].some((field) => sub.getString(field) &&
          sub.getString(field).slice(0, 10) < body.next_payment))
      throw new BadRequestError("reactivate_schedule_ended");
    const existing = tx.findRecordsByFilter("payment_records",
      "user = {:owner} && subscription_id = {:sub} && (scheduled_date = {:date} || (due_date >= {:date} && due_date < {:until}))",
      "", 0, 0, { owner: e.auth.id, sub: sub.id, date: body.paid_date, until: body.paid_date + "~" });
    if (!existing.some((record) => record.getString("paid_at"))) {
      const payment = existing[0] || new Record(tx.findCollectionByNameOrId("payment_records"));
      if (!existing.length) {
        payment.set("user", e.auth.id);
        payment.set("subscription_id", sub.id);
        payment.set("due_date", body.paid_date);
        for (const field of ["name", "brand_name", "currency", "category", "payment_method", "payer"])
          payment.set(field, sub.get(field));
      }
      payment.set("paid_at", paidAt.toISOString());
      payment.set("amount", body.price);
      payment.set("auto_paid", false);
      tx.save(payment);
    }
    sub.set("__monline_reactivation_dates", true);
    // Keep historical prices; the confirmed renewal amount is effective at the next occurrence.
    if (sub.getString("record_type") === "credit") sub.set("price", body.price);
    else sub.set("price_changes", [...(sub.get("price_changes") || [])
      .filter((change) => change.effective_date !== body.next_payment),
      { effective_date: body.next_payment, price: body.price }]);
    sub.set("inactive", false);
    sub.set("next_payment", body.next_payment);
    sub.set("billing_anchor_day", Number(body.next_payment.slice(8, 10)));
    tx.save(sub);
  });
  return e.json(200, { reactivated: true });
});
