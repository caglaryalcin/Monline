import { getCurrencyFractionDigits } from "@/lib/utils";

export const SAVINGS_GOLD_ASSETS = [
  "GRA", "CEYREKALTIN", "YARIMALTIN", "TAMALTIN", "CUMHURIYETALTINI",
] as const;

export const SAVINGS_ASSETS = [
  "TRY", "USD", "EUR", "GBP", ...SAVINGS_GOLD_ASSETS,
] as const;

export type SavingsAsset = string;

export function isGoldSavingsAsset(asset: string) {
  return (SAVINGS_GOLD_ASSETS as readonly string[]).includes(asset);
}

export function isSavingsCurrency(asset: string) {
  return /^[A-Z]{3}$/.test(asset) && !["XAU", "XAG", "XPT", "XPD", "BTC", "GRA"].includes(asset);
}
export interface Saving {
  id: string;
  name: string;
  asset: SavingsAsset;
  quantity: number;
  notes: string;
}
export type SavingInput = Omit<Saving, "id">;
export interface SavingsRates {
  rates: Partial<Record<string, number>>;
  currency_rates?: Record<string, number>;
  as_of: string | null;
  fetched_at: string | null;
  source: string;
  source_url: string;
  status?: "not_configured" | "unavailable" | "gold_unavailable" | null;
  stale: boolean;
}

export function savingsPrecision(asset: SavingsAsset) {
  return asset === "GRA" ? 4 : isGoldSavingsAsset(asset) ? 0 : getCurrencyFractionDigits(asset);
}

export function validSavingsQuantity(asset: SavingsAsset, quantity: number) {
  const scale = 10 ** savingsPrecision(asset);
  return Number.isFinite(quantity) && quantity > 0 && quantity <= 1e9 &&
    Math.abs(quantity * scale - Math.round(quantity * scale)) < 0.00001;
}

export function savingsUnitRate(asset: SavingsAsset, rates?: SavingsRates, currency = "TRY") {
  if (asset === currency) return 1;
  const rate = asset === "TRY" ? 1 : rates?.currency_rates?.[asset] ?? rates?.rates[asset];
  const target = currency === "TRY" ? 1 : rates?.currency_rates?.[currency] ??
    rates?.rates[currency];
  return rate && Number.isFinite(rate) && rate > 0 && target && Number.isFinite(target) && target > 0
    ? rate / target : null;
}

export function savingsValue(saving: Pick<Saving, "asset" | "quantity">, rates?: SavingsRates, currency = "TRY") {
  const rate = savingsUnitRate(saving.asset, rates, currency);
  const scale = 10 ** getCurrencyFractionDigits(currency);
  return rate === null ? null : Math.round(saving.quantity * rate * scale) / scale;
}
