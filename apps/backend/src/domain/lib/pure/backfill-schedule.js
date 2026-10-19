const MAX_BACKFILL_PAYMENTS = 1000;
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const time = Date.parse(value + "T00:00:00.000Z");
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}

// Always advance from the original day: Jan 31 -> Feb 28 -> Mar 31.
function backfillDates({
  start,
  anchorDate = start,
  until,
  cycle,
  frequency,
  end = "",
  limit = 0,
}) {
  const months = { Monthly: 1, Quarterly: 3, "Half-Yearly": 6, Yearly: 12 };
  if (
    !validDate(start) ||
    !validDate(anchorDate) ||
    !validDate(until) ||
    (end && !validDate(end)) ||
    !["Daily", "Weekly", ...Object.keys(months)].includes(cycle) ||
    !Number.isInteger(frequency) ||
    frequency < 1 ||
    frequency > 1200 ||
    !Number.isInteger(limit) ||
    limit < 0
  )
    throw new Error("backfill_invalid_schedule");
  const anchor = new Date(anchorDate + "T00:00:00.000Z");
  const beginning = new Date(start + "T00:00:00.000Z");
  const monthStep = months[cycle] * frequency;
  const firstIndex = monthStep
    ? Math.floor(
        ((beginning.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
          beginning.getUTCMonth() -
          anchor.getUTCMonth()) /
          monthStep,
      )
    : Math.floor(
        (beginning.getTime() - anchor.getTime()) /
          (86400000 * frequency * (cycle === "Weekly" ? 7 : 1)),
      );
  const cutoff = end && end < until ? end : until;
  const dates = [];
  for (let index = firstIndex; !limit || dates.length < limit; index++) {
    let date;
    if (months[cycle]) {
      const target = new Date(anchor.getTime());
      target.setUTCDate(1);
      target.setUTCMonth(
        anchor.getUTCMonth() + index * frequency * months[cycle],
      );
      const last = new Date(target.getTime());
      last.setUTCMonth(last.getUTCMonth() + 1);
      last.setUTCDate(0);
      target.setUTCDate(Math.min(anchor.getUTCDate(), last.getUTCDate()));
      date = target;
    } else {
      date = new Date(anchor.getTime());
      date.setUTCDate(
        date.getUTCDate() + index * frequency * (cycle === "Weekly" ? 7 : 1),
      );
    }
    if (!Number.isFinite(date.getTime())) break;
    const day = date.toISOString().slice(0, 10);
    if (day > cutoff) break;
    if (day < start) continue;
    if (dates.length === MAX_BACKFILL_PAYMENTS)
      throw new Error("backfill_too_many");
    dates.push(day);
  }
  return dates;
}
module.exports = { backfillDates, validDate, MAX_BACKFILL_PAYMENTS };
