const { repository, httpClient } = require("../../runtime.cjs");
const { parseMarketRates } = require("./pure/market-rates.js");
const CACHE_KEY = "savings_market_rates_v1";
const CACHE_TTL = 60000;
const SOURCE_MAX_AGE = 10 * 60000;
let pending = null;
let retryAfter = 0;
let failed = false;

function cached() {
  try {
    const saved = JSON.parse(repository.connection.prepare("SELECT value FROM monline_meta WHERE key=?").get(CACHE_KEY)?.value || "null");
    if (!saved || !Number.isFinite(Date.parse(saved.fetched_at)) || Date.parse(saved.fetched_at) > Date.now()) return null;
    const parsed = parseMarketRates(saved.payload);
    return parsed ? { ...parsed, fetched_at: saved.fetched_at } : null;
  } catch { return null; }
}
function refresh() {
  if (!pending) pending = (async () => {
    try {
      const response = await httpClient.send({
        url: "https://finans.truncgil.com/today.json", method: "GET", timeout: 10, maxBytes: 1024 * 1024,
      });
      if (response.statusCode !== 200 || !parseMarketRates(response.json)) throw new Error("market_rates_unavailable");
      const value = { payload: response.json, fetched_at: new Date().toISOString() };
      repository.connection.prepare("INSERT INTO monline_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(CACHE_KEY, JSON.stringify(value));
      failed = false; retryAfter = 0;
    } catch {
      failed = true; retryAfter = Date.now() + CACHE_TTL;
    } finally { pending = null; }
  })();
  return pending;
}
async function latest() {
  const previous = cached();
  if (Date.now() >= retryAfter && (!previous || Date.now() - Date.parse(previous.fetched_at) >= CACHE_TTL)) {
    const request = refresh();
    if (!previous) await request;
  }
  const value = cached();
  if (!value) return null;
  return { ...value, status: null, refreshing: !!pending,
    stale: failed || Date.now() - Date.parse(value.as_of) > SOURCE_MAX_AGE ||
      Date.now() - Date.parse(value.fetched_at) > 2 * CACHE_TTL,
  };
}
module.exports = { latest };
