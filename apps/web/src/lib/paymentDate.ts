import { toDateStr } from "@/components/calendar/types";
import { isValidISODate } from "@/lib/dateInput";
import type { PaymentRecord } from "@/types";

export function paymentDateForRecord(paidAt?: string) {
  if (!paidAt) return "";
  const date = new Date(paidAt.replace(" ", "T"));
  return Number.isFinite(date.getTime()) ? toDateStr(date) : "";
}

/** Keep an unchanged timestamp exact; a selected day is local, including DST. */
export function editedPaymentDate(
  paidDate: string,
  record?: Pick<PaymentRecord, "paid_at" | "auto_paid">,
  now = new Date(),
) {
  if (!isValidISODate(paidDate) || paidDate < "1970-01-01") throw new Error("payment_date_invalid");
  if (paidDate > toDateStr(now)) throw new Error("payment_date_future");
  if (record?.paid_at && paymentDateForRecord(record.paid_at) === paidDate)
    return { paid_at: record.paid_at, auto_paid: record.auto_paid ?? false };
  const midnight = new Date(`${paidDate}T00:00:00`);
  if (!Number.isFinite(midnight.getTime()) || toDateStr(midnight) !== paidDate)
    throw new Error("payment_date_invalid");
  return {
    paid_at: !record?.paid_at && paidDate === toDateStr(now)
      ? now.toISOString()
      : midnight.toISOString(),
    // A manually corrected automatic payment must use the selected date in reports.
    auto_paid: false,
  };
}
