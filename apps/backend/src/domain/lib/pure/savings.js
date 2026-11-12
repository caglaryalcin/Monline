const GOLD_ASSETS = ["GRA", "CEYREKALTIN", "YARIMALTIN", "TAMALTIN", "CUMHURIYETALTINI"];
const ASSETS = ["TRY", "USD", "EUR", "GBP", ...GOLD_ASSETS];
const NON_CURRENCY_CODES = new Set(["XAU", "XAG", "XPT", "XPD", "BTC", "GRA"]);
const { normalizeBanknotes } = require("./savings-banknotes.mjs");
const FIELDS = ["name", "asset", "quantity", "notes", "banknotes"];

function validAsset(asset) {
  return typeof asset === "string" && (GOLD_ASSETS.includes(asset) ||
    (/^[A-Z]{3}$/.test(asset) && !NON_CURRENCY_CODES.has(asset)));
}

function validQuantity(asset, quantity) {
  if (!validAsset(asset)) return false;
  const digits = asset === "GRA" ? 4 : GOLD_ASSETS.includes(asset) ? 0 :
    new Intl.NumberFormat("en", { style: "currency", currency: asset }).resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10 ** digits;
  return typeof quantity === "number" && Number.isFinite(quantity) &&
    quantity > 0 && quantity <= 1e9 &&
    Math.abs(quantity * scale - Math.round(quantity * scale)) < 0.00001;
}

function validate(value) {
  if (!value || typeof value.name !== "string" || !value.name.trim() ||
    value.name.length > 160 || !validAsset(value.asset) ||
    !validQuantity(value.asset, value.quantity) ||
    (value.notes != null && (typeof value.notes !== "string" || value.notes.length > 2000)))
    throw new Error("savings_invalid");
  return { name: value.name.trim(), asset: value.asset, quantity: value.quantity, notes: value.notes || "",
    banknotes: normalizeBanknotes(value.asset, value.banknotes, value.quantity) };
}

// Fixer quotes XAU in troy ounces of fine gold (https://fixer.io/symbols).
// NIST: 1 troy ounce = 31.1034768 g.
// https://www.nist.gov/system/files/documents/2017/05/09/Precious-Metals-Conversion-Information-march2015.pdf
// Darphane publishes the nominal coin weights and 22/24 fineness:
// https://en.darphane.gov.tr/cumhuriyet-gold-manufacturing/
// Coin prices here are intrinsic metal values, excluding premiums and spreads.
const TROY_OUNCE_GRAMS = 31.1034768;
const GOLD_FINE_GRAMS = {
  GRA: 1,
  CEYREKALTIN: 1.754 * 22 / 24,
  YARIMALTIN: 3.508 * 22 / 24,
  TAMALTIN: 7.016 * 22 / 24,
  CUMHURIYETALTINI: 7.216 * 22 / 24,
};
const METALS = new Set(["XAU", "XAG", "XPT", "XPD"]);
const positive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

function parseRates(data) {
  if (!data || !/^[A-Z]{3}$/.test(data.base) || !data.rates ||
    typeof data.rates !== "object" || Array.isArray(data.rates) ||
    !positive(data.timestamp) || data.timestamp * 1000 > Date.now() + 300000) return null;
  const asOf = new Date(data.timestamp * 1000);
  if (!Number.isFinite(asOf.getTime())) return null;
  const quotes = { ...data.rates, [data.base]: 1 };
  if (!positive(quotes.TRY)) return null;
  const currencyRates = Object.fromEntries(Object.entries(quotes).flatMap(([code, quote]) => {
    const rate = positive(quote) ? quotes.TRY / quote : null;
    return /^[A-Z]{3}$/.test(code) && !METALS.has(code) && code !== "BTC" && positive(rate)
      ? [[code, rate]] : [];
  }));
  currencyRates.TRY = 1;
  const rates = { ...currencyRates };
  if (positive(quotes.XAU)) {
    const fineGramTry = quotes.TRY / quotes.XAU / TROY_OUNCE_GRAMS;
    for (const [asset, grams] of Object.entries(GOLD_FINE_GRAMS)) {
      const value = fineGramTry * grams;
      if (positive(value)) rates[asset] = value;
    }
  }
  return {
    rates, currency_rates: currencyRates, as_of: asOf.toISOString(),
    source: "Fixer.io", source_url: "https://fixer.io/",
  };
}

module.exports = { ASSETS, FIELDS, validAsset, validQuantity, validate, parseRates };
