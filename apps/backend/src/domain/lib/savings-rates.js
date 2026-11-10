const { repository, httpClient } = require("../../runtime.cjs");
const exchange = require("../../exchange-service.cjs");
const { parseRates } = require("./pure/savings.js");
let retryAfter = 0;

async function latest({ force = false } = {}) {
  const settings = require("../../server-config.cjs").exchange(repository);
  const configured = !!settings.enabled && !!String(settings.api_key || "").trim();
  const cached = exchange.cachedLatestRates(repository);
  let failed = false;
  if (configured && Date.now() >= retryAfter) {
    try {
      // Ordinary polls reuse the installation's shared 12-hour snapshot.
      // Repeated manual clicks reuse the current minute's result.
      const refresh = force && (!cached || Date.now() - Date.parse(cached.fetched_at) >= 60000);
      await exchange.fetchLatestRates(repository, httpClient, { force: refresh });
    } catch {
      failed = true;
      retryAfter = Date.now() + 60000;
    }
  }
  const configNow = require("../../server-config.cjs").exchange(repository);
  const stillConfigured = !!configNow.enabled && !!String(configNow.api_key || "").trim();
  // Reading again also handles connection changes during an awaited request.
  const snapshot = stillConfigured ? exchange.cachedLatestRates(repository) : null;
  const value = snapshot ? parseRates(snapshot) : null;
  return {
    rates: value?.rates || {},
    currency_rates: value?.currency_rates || { TRY: 1 },
    as_of: value?.as_of || null,
    fetched_at: value ? snapshot.fetched_at : null,
    source: "Fixer.io",
    source_url: "https://fixer.io/",
    status: !stillConfigured ? "not_configured" : !value ? "unavailable" : !value.rates.GRA ? "gold_unavailable" : null,
    stale: !value || failed || Date.now() < retryAfter ||
      Date.now() - Date.parse(snapshot.fetched_at) >= exchange.RATE_CACHE_TTL ||
      Date.now() - Date.parse(value.as_of) > 24 * 60 * 60 * 1000,
  };
}

module.exports = { latest };
