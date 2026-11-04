function shiftPaymentDate(nextPayment, cycle, frequency, direction, calendar) {
  const date = new Date(nextPayment + "T00:00:00.000Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(nextPayment) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== nextPayment ||
    !Number.isInteger(frequency) ||
    frequency < 1
  )
    return "";
  const months = { Monthly: 1, "Last-Weekday": 1, Quarterly: 3, "Half-Yearly": 6, Yearly: 12 };
  if (months[cycle]) {
    return require("../date-helpers.js")
      .advanceDate(date, cycle, direction * frequency, undefined, calendar)
      .toISOString()
      .slice(0, 10);
  } else if (cycle === "Daily" || cycle === "Weekly") {
    date.setUTCDate(
      date.getUTCDate() + direction * frequency * (cycle === "Weekly" ? 7 : 1),
    );
  } else if (cycle !== "One-Time") return "";
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}
function automaticStartDate(date, cycle, frequency = 1, calendar) {
  return shiftPaymentDate(date, cycle, frequency, -1, calendar);
}
function nextPaymentDate(date, cycle, frequency = 1, calendar) {
  return shiftPaymentDate(date, cycle, frequency, 1, calendar);
}
module.exports = { automaticStartDate, nextPaymentDate };
