const { validDate } = require("./backfill-schedule.js");

// A skip belongs to one saved month. Keep its amount for an exact undo while
// the live entry remains zero, so existing ledger totals do not include it.
function skippedAmount(value, date) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 100) throw new Error("bill_invalid");
  const saved = JSON.parse(value);
  if (!saved || !validDate(date) || saved.month !== date.slice(0, 7) ||
      typeof saved.amount !== "number" || !Number.isFinite(saved.amount) ||
      saved.amount < 0 || saved.amount > 1e12 ||
      saved.amount !== Number(saved.amount.toFixed(2))) throw new Error("bill_invalid");
  return saved.amount;
}

function validSkip(value) {
  try {
    return skippedAmount(value.bill_skip, value.date) === null ||
      (value.amount === 0 && value.status === "planned" && !value.settled_date);
  } catch {
    return false;
  }
}

module.exports = { skippedAmount, validSkip };
