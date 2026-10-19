/** Shift by one billing period, clamping to the target month's last day. */
function shiftPaymentDate(
  nextPayment: string,
  cycle: string,
  frequency: number,
  direction: number,
): string {
  const date = new Date(nextPayment + "T00:00:00.000Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(nextPayment) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== nextPayment ||
    !Number.isInteger(frequency) ||
    frequency < 1
  )
    return "";
  const months: Record<string, number> = { Monthly: 1, Quarterly: 3, "Half-Yearly": 6, Yearly: 12 };
  if (months[cycle]) {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + direction * frequency * months[cycle]);
    const last = new Date(date.getTime());
    last.setUTCMonth(last.getUTCMonth() + 1);
    last.setUTCDate(0);
    date.setUTCDate(Math.min(day, last.getUTCDate()));
  } else if (cycle === "Daily" || cycle === "Weekly") {
    date.setUTCDate(date.getUTCDate() + direction * frequency * (cycle === "Weekly" ? 7 : 1));
  } else if (cycle !== "One-Time") return "";
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

export function automaticStartDate(date: string, cycle: string, frequency = 1) {
  return shiftPaymentDate(date, cycle, frequency, -1);
}

export function nextPaymentDate(date: string, cycle: string, frequency = 1) {
  return shiftPaymentDate(date, cycle, frequency, 1);
}
