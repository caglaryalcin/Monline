const GOLD_SYMBOLS = {
  GRA: "gram-altin",
  CEYREKALTIN: "ceyrek-altin",
  YARIMALTIN: "yarim-altin",
  TAMALTIN: "tam-altin",
  CUMHURIYETALTINI: "ata-altin",
};
function decimal(value, percent = false) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/[$₺€£%\s]/g, "");
  if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(text)) return null;
  const parsed = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && (percent ? Math.abs(parsed) <= 10000 : parsed > 0) ? parsed : null;
}
function quote(row, symbol, currency = "TRY") {
  if (!row || typeof row !== "object") return null;
  const bid = decimal(row["Alış"]), ask = decimal(row["Satış"]);
  if (bid === null || ask === null || ask < bid) return null;
  return { symbol, bid, ask, change_percent: decimal(row["Değişim"], true), currency };
}
function parseMarketRates(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      typeof data.Update_Date !== "string" || !/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(data.Update_Date)) return null;
  const timestamp = Date.parse(data.Update_Date.replace(" ", "T") + "+03:00");
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + 300000) return null;
  const currencyRates = { TRY: 1 }, quotes = new Map();
  for (const [code, row] of Object.entries(data)) {
    if (!/^[A-Z]{3}$/.test(code) || ["TRY", "XAU", "XAG", "XPT", "XPD", "BTC"].includes(code) || row?.["Tür"] !== "Döviz") continue;
    const value = quote(row, code);
    if (value) { currencyRates[code] = value.bid; quotes.set(code, value); }
  }
  const rates = { ...currencyRates };
  for (const [asset, symbol] of Object.entries(GOLD_SYMBOLS)) {
    const value = quote(data[symbol], asset);
    if (value) { rates[asset] = value.bid; quotes.set(asset, value); }
  }
  const ounce = quote(data.ons, "XAUUSD", "USD");
  if (ounce) quotes.set("XAUUSD", ounce);
  // Reject incomplete payloads instead of replacing a usable snapshot with them.
  if (!rates.USD || !rates.EUR || !rates.GRA) return null;
  return {
    rates, currency_rates: currencyRates,
    market_quotes: ["XAUUSD", "USD", "EUR", "GBP", "CHF", ...Object.keys(GOLD_SYMBOLS)].flatMap(symbol => quotes.has(symbol) ? [quotes.get(symbol)] : []),
    as_of: new Date(timestamp).toISOString(),
    source: "Trunçgil Finans", source_url: "https://finans.truncgil.com/", valuation_side: "bid",
  };
}
module.exports = { parseMarketRates };
