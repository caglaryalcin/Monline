import { isValidISODate } from "@/lib/dateInput";
import { parseClipboardAmount } from "@/lib/financeClipboard";
import type { financeCurrencyQuote } from "@/lib/financeCurrency";

export type LoanPeriod = { loan_start_date: string; loan_end_date: string; loan_installment_amount: number; loan_payment_day: number };
export type RentPeriod = { rent_start_date: string; rent_end_date: string; rent_amount: number };

export function readRentPeriod(form: FormData, currency: ReturnType<typeof financeCurrencyQuote>): RentPeriod {
  const start = String(form.get("rent_start_date") || ""), end = String(form.get("rent_end_date") || "");
  if (!isValidISODate(start) || !isValidISODate(end) || start < "1970-01-01" ||
      end > "2200-12-31" || end < start) throw new Error("finance_rent_period_invalid");
  try {
    const amount = parseClipboardAmount(String(form.get("rent_amount") || ""), currency.currency);
    if (!currency.available || amount === null || amount <= 0) throw new Error();
    const stored = currency.toStored(amount);
    if (stored <= 0) throw new Error();
    return { rent_start_date: start, rent_end_date: end, rent_amount: stored };
  } catch { throw new Error("finance_rent_period_invalid"); }
}

export function readLoanPeriod(form: FormData, currency: ReturnType<typeof financeCurrencyQuote>): LoanPeriod {
  try {
    const amount = parseClipboardAmount(String(form.get("loan_installment_amount") || ""), currency.currency);
    if (!currency.available || amount === null || amount <= 0) throw new Error();
    const stored = currency.toStored(amount);
    if (stored <= 0) throw new Error();
    const start = String(form.get("loan_start_date") || ""), end = String(form.get("loan_end_date") || "");
    if (!isValidISODate(start) || !isValidISODate(end) || start < "1970-01-01" ||
        end > "2200-12-31" || end < start) throw new Error();
    const day = Number(form.get("loan_payment_day"));
    if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error();
    return { loan_start_date: start, loan_end_date: end, loan_installment_amount: stored, loan_payment_day: day };
  } catch { throw new Error("finance_loan_period_invalid"); }
}
