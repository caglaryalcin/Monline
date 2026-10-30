const { validDate } = require("./backfill-schedule.js");
const FIELDS = ["name", "date", "amount", "currency", "status", "notes"];
function validate(input) {
  if (!input || typeof input !== "object") throw new Error("bill_invalid");
  const { name, date, amount, currency, status } = input;
  const notes = input.notes ?? "";
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 250 ||
    !validDate(date) ||
    date < "1970-01-01" ||
    date > "2200-12-31" ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1e12 ||
    amount !== Number(amount.toFixed(2)) ||
    typeof currency !== "string" ||
    !/^[A-Z]{3}$/.test(currency) ||
    !["planned", "settled"].includes(status) ||
    typeof notes !== "string" ||
    notes.length > 2000
  )
    throw new Error("bill_invalid");
  return {
    name: name.trim(),
    date,
    amount,
    currency,
    status,
    notes: notes.trim(),
  };
}
module.exports = { FIELDS, validate };
