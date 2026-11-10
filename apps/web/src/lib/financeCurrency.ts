import { formatCurrency, getCurrencyFractionDigits } from "@/lib/utils";

/** Existing ledger records are TRY. A display quote never changes saved records. */
export function financeCurrencyQuote(currency: string, rate: number | null) {
  const precision = getCurrencyFractionDigits(currency);
  const scale = 10 ** precision;
  const available = rate !== null && Number.isFinite(rate) && rate > 0;
  const toDisplay = (amount: number) => available ? amount * rate! : null;
  const toStored = (amount: number, previous?: number) => {
    if (!available || !Number.isFinite(amount)) throw new Error("finance_currency_unavailable");
    // Opening an existing amount and saving its rounded display must be a no-op.
    if (previous !== undefined && Math.round(previous * rate! * scale) === Math.round(amount * scale))
      return previous;
    return Math.round(amount / rate! * 100) / 100;
  };
  const format = (amount: number | null, options: Parameters<typeof formatCurrency>[2] = {}) => {
    const converted = amount === null ? null : toDisplay(amount);
    return converted === null ? "—" : formatCurrency(converted, currency, options);
  };
  return { currency, precision, rate: available ? rate : null, available, toDisplay, toStored, format };
}
