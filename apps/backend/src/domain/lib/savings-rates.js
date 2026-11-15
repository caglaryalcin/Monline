const { repository, httpClient } = require("../../runtime.cjs");
const exchange = require("../../exchange-service.cjs");
const { parseRates } = require("./pure/savings.js");
let retryAfter = 0;
let refreshPromise = null;

function refreshRates(force) {
  if (!refreshPromise) {
    refreshPromise = exchange.fetchLatestRates(repository, httpClient, { force })
      .catch(() => { retryAfter = Date.now() + 60000; })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function latest({ force = false } = {}) {
  const settings = require("../../server-config.cjs").exchange(repository);
  const configured = !!settings.enabled && !!String(settings.api_key || "").trim();
  const cached = exchange.cachedLatestRates(repository);
  if (configured && Date.now() >= retryAfter) {
    // Display a usable saved quote immediately while an expired snapshot refreshes.
    // Only first-time loading and an explicit refresh wait for the provider.
    const age = cached ? Date.now() - Date.parse(cached.fetched_at) : Infinity;
    const refresh = force && age >= 60000;
    if (refresh || age >= exchange.RATE_CACHE_TTL) {
      const pending = refreshRates(refresh);
      if (force || !cached || !parseRates(cached)) await pending;
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
    refreshing: stillConfigured && !!refreshPromise,
    stale: !value || Date.now() < retryAfter ||
      Date.now() - Date.parse(snapshot.fetched_at) >= exchange.RATE_CACHE_TTL ||
      Date.now() - Date.parse(value.as_of) > 24 * 60 * 60 * 1000,
  };
}

module.exports = { latest };
