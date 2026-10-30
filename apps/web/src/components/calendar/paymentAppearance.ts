import type { PaymentRecord } from "@/types";

import type { DayEntry } from "./types";

export const CALENDAR_PAYMENT_TONES = [
  "ledger-paid",
  "ledger-pending",
  "manual-paid",
  "manual-pending",
  "statement-paid",
  "statement-pending",
] as const;

type PaymentTone = (typeof CALENDAR_PAYMENT_TONES)[number];

export function paymentTone(tone: PaymentTone) {
  return {
    className: `calendar-payment-tone calendar-payment-tone--${tone}`,
    labelKey: `calendar_color_${tone.replace("-", "_")}`,
  };
}

export function paymentAppearance(entry: DayEntry, record?: PaymentRecord) {
  const statementRecord =
    record?.statement_sources?.some((source) => source.startsWith("[monline-statement:")) ||
    /\[monline-statement(?:-backfill)?:/.test(record?.notes || "");
  const source = entry.spending
    ? entry.spending.source === "ledger"
      ? "ledger"
      : entry.spending.source === "statement"
        ? "statement"
        : "manual"
    : statementRecord
      ? "statement"
      : "manual";
  const paid = entry.spending
    ? entry.spending.status === "settled" ||
      (entry.spending.source === "statement" && entry.spending.status === "recorded")
    : !!record?.paid_at;
  const tone: PaymentTone = `${source}-${paid ? "paid" : "pending"}`;
  return {
    paid,
    ...paymentTone(tone),
  };
}
