export const MAX_BACKFILL_PAYMENTS = 1000;
export interface BackfillPayment {
  due_date: string;
  amount: number;
  paid_utc_offset_minutes: number;
}
export interface BackfillInput {
  confirmed: true;
  mark_as_paid?: boolean;
  utc_offset_minutes: number;
  payments: BackfillPayment[];
}
export interface BackfillSelection {
  enabled: boolean;
  valid: boolean;
  input: BackfillInput | null;
  startDate?: string;
}

function validDate(value: string) {
  const time = Date.parse(value + "T00:00:00.000Z");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
  );
}

export function backfillDates({
  start,
  anchorDate = start,
  billingAnchorDay,
  until,
  cycle,
  frequency,
  end = "",
  limit = 0,
}: {
  start: string;
  anchorDate?: string;
  billingAnchorDay?: number;
  until: string;
  cycle: string;
  frequency: number;
  end?: string;
  limit?: number;
}): string[] {
  const months: Record<string, number> = { Monthly: 1, Quarterly: 3, "Half-Yearly": 6, Yearly: 12 };
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
  const dayOfMonth =
    Number.isInteger(billingAnchorDay) && billingAnchorDay! >= 1 && billingAnchorDay! <= 31
      ? billingAnchorDay!
      : anchor.getUTCDate();
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
  const cutoffTime = Date.parse(`${cutoff}T00:00:00.000Z`);
  const dates: string[] = [];
  for (let index = firstIndex; !limit || dates.length < limit; index++) {
    let date: Date;
    if (months[cycle]) {
      const target = new Date(anchor.getTime());
      target.setUTCDate(1);
      target.setUTCMonth(anchor.getUTCMonth() + index * frequency * months[cycle]);
      const last = new Date(target.getTime());
      last.setUTCMonth(last.getUTCMonth() + 1);
      last.setUTCDate(0);
      target.setUTCDate(Math.min(dayOfMonth, last.getUTCDate()));
      date = target;
    } else {
      date = new Date(anchor.getTime());
      date.setUTCDate(date.getUTCDate() + index * frequency * (cycle === "Weekly" ? 7 : 1));
    }
    if (date.getTime() > cutoffTime) break;
    if (date < beginning) continue;
    if (dates.length === MAX_BACKFILL_PAYMENTS) throw new Error("backfill_too_many");
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
