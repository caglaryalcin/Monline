function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  var time = Date.parse(value + "T00:00:00.000Z");
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
function paymentDateRange(now, offset) {
  if (!Number.isInteger(offset) || offset < -840 || offset > 840)
    throw new Error("historical_invalid_date");
  var today = new Date(now.getTime() - offset * 60000);
  var end = today.toISOString().slice(0, 10);
  // Clamp leap day to the last day of February in the preceding year.
  var year = today.getUTCFullYear() - 1;
  var month = today.getUTCMonth();
  var day = Math.min(
    today.getUTCDate(),
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  );
  var start = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  return { start, end };
}

function paymentFields(body) {
  if (
    typeof body.amount !== "number" ||
    !Number.isFinite(body.amount) ||
    body.amount < 0 ||
    body.amount > 1e12
  )
    throw new Error("historical_invalid_amount");
  if (
    body.notes != null &&
    (typeof body.notes !== "string" || body.notes.length > 2000)
  )
    throw new Error("historical_invalid_notes");
  return {
    amount: body.amount,
    auto_paid: false,
    notes: String(body.notes || "").trim(),
  };
}

function validateHistoricalPayment(body, now, { limitToPastYear = true } = {}) {
  var offset = body.utc_offset_minutes;
  var paidOffset =
    body.paid_utc_offset_minutes == null
      ? offset
      : body.paid_utc_offset_minutes;
  var { start, end } = paymentDateRange(now, offset);
  if (!Number.isInteger(paidOffset) || paidOffset < -840 || paidOffset > 840)
    throw new Error("historical_invalid_date");
  for (var date of [body.due_date, body.paid_date]) {
    if (!validDate(date) || (limitToPastYear && date < start) || date > end)
      throw new Error("historical_invalid_date");
  }
  var fields = paymentFields(body);
  // The selected day may have a different UTC offset because of daylight saving.
  var paidAt = new Date(
    Date.parse(body.paid_date + "T00:00:00.000Z") + paidOffset * 60000,
  );
  if (paidAt > now) throw new Error("historical_invalid_date");
  return {
    due_date: body.due_date,
    paid_at: paidAt.toISOString(),
    ...fields,
  };
}

function validateCalendarPayment(body, now) {
  // Requests from older clients keep the original past-payment validation.
  if (body.status === undefined) return validateHistoricalPayment(body, now);
  if (!["paid", "pending"].includes(body.status))
    throw new Error("calendar_payment_invalid_status");
  var { start } = paymentDateRange(now, body.utc_offset_minutes);
  if (
    !validDate(body.due_date) ||
    body.due_date < start ||
    body.due_date > "2200-12-31"
  )
    throw new Error("calendar_payment_invalid_date");
  if (body.status === "paid") {
    const values = validateHistoricalPayment(
      { ...body, due_date: body.paid_date },
      now,
    );
    return { ...values, due_date: body.due_date };
  }
  return {
    due_date: body.due_date,
    paid_at: "",
    ...paymentFields(body),
  };
}
module.exports = {
  validDate,
  validateHistoricalPayment,
  validateCalendarPayment,
};
