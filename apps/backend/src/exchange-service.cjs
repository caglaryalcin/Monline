const { createHash } = require("node:crypto");
const { BadRequestError, NotFoundError, HttpError } = require("./errors.cjs");
const { DataRecord } = require("./storage.cjs");
const {
  normalizeRatesByMainCurrency,
} = require("./domain/lib/pure/exchange-rates.js");
const CACHE_KEY = "fixer_latest_rates";
const RATE_CACHE_TTL = 12 * 60 * 60 * 1000;
const pendingRequests = new WeakMap();

function configuration(repository) {
  const settings = require("./server-config.cjs").exchange(repository);
  const apiKey = String(settings.api_key || "").trim();
  const provider = settings.provider === "apilayer" ? "apilayer" : "fixer";
  return {
    apiKey,
    provider,
    enabled: !!settings.enabled && !!apiKey,
    fingerprint: createHash("sha256").update(provider + "\0" + apiKey).digest("hex"),
  };
}

// Shared public quotes are bound to the configured connection so changing
// credentials cannot retain a previous connection's data.
function cachedLatestRates(repository) {
  const config = configuration(repository);
  if (!config.enabled) return null;
  try {
    const cached = JSON.parse(repository.connection.prepare("SELECT value FROM monline_meta WHERE key=?").get(CACHE_KEY)?.value || "null");
    const value = cached?.data;
    if (cached?.fingerprint !== config.fingerprint || !value?.rates ||
      typeof value.rates !== "object" || Array.isArray(value.rates) ||
      !Number.isFinite(Date.parse(value.fetched_at)) || Date.parse(value.fetched_at) > Date.now()) return null;
    return value;
  } catch {
    return null;
  }
}

async function fetchLatestRates(repository, httpClient, { force = false } = {}) {
  const config = configuration(repository);
  if (!config.enabled) throw new BadRequestError("No exchange rate API key configured.");
  const cached = cachedLatestRates(repository);
  if (!force && cached && Date.now() - Date.parse(cached.fetched_at) < RATE_CACHE_TTL) return cached;
  const pending = pendingRequests.get(repository);
  if (pending?.fingerprint === config.fingerprint) return pending.promise;
  const entry = { fingerprint: config.fingerprint };
  entry.promise = (async () => {
    const response = await httpClient.send({
      url: config.provider === "apilayer"
        ? "https://api.apilayer.com/fixer/latest?base=EUR"
        : "https://data.fixer.io/api/latest?access_key=" + encodeURIComponent(config.apiKey),
      method: "GET",
      headers: config.provider === "apilayer" ? { apikey: config.apiKey } : {},
    });
    if (response.statusCode !== 200 || !response.json?.rates ||
      typeof response.json.rates !== "object" || Array.isArray(response.json.rates) ||
      response.json.success === false || (response.json.base && response.json.base !== "EUR"))
      throw new HttpError(502, "Exchange rate API request failed.");
    const current = configuration(repository);
    if (!current.enabled || current.fingerprint !== config.fingerprint)
      throw new HttpError(502, "Exchange rate settings changed. Please try again.");
    const value = {
      base: "EUR",
      rates: response.json.rates,
      timestamp: response.json.timestamp,
      fetched_at: new Date().toISOString(),
    };
    repository.connection.prepare("INSERT INTO monline_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(CACHE_KEY, JSON.stringify({ fingerprint: config.fingerprint, data: value }));
    return value;
  })().finally(() => {
    if (pendingRequests.get(repository) === entry) pendingRequests.delete(repository);
  });
  pendingRequests.set(repository, entry);
  return entry.promise;
}

async function updateRates(
  repository,
  httpClient,
  { userId, currencyId } = {},
) {
  if (
    currencyId !== undefined &&
    (typeof currencyId !== "string" || !currencyId.trim())
  )
    throw new BadRequestError("Invalid currency ID.");
  const currencies = repository.findRecordsByFilter(
    "currencies",
    userId ? "user = {:user}" : "",
    "",
    0,
    0,
    { user: userId },
  );
  const selected =
    currencyId === undefined
      ? null
      : currencies.find((record) => record.id === currencyId);
  if (currencyId !== undefined && !selected)
    throw new NotFoundError("Currency not found.");
  const mainCurrencies = currencies.filter((record) =>
    record.getBool("is_main"),
  );
  if (userId && !mainCurrencies.length)
    throw new BadRequestError("No main currency set.");
  if (selected?.getBool("is_main"))
    return { updated: 0, base: selected.getString("code") };
  const quotes = await fetchLatestRates(repository, httpClient, { force: true });
  const provider = configuration(repository).provider;
  let updated = 0;
  repository.runInTransaction(() => {
    for (const main of mainCurrencies) {
      const owned = currencies.filter(
        (record) =>
          record.getString("user") === main.getString("user") &&
          (!selected || record.id === selected.id),
      );
      let normalized;
      try {
        normalized = normalizeRatesByMainCurrency(
          quotes.rates,
          main.getString("code"),
          owned.map((record) => record.getString("code")),
        );
      } catch {
        if (userId)
          throw new BadRequestError(
            "Main currency was not found in the API response.",
          );
        else continue;
      }
      if (
        selected &&
        (!Number.isFinite(normalized[selected.getString("code")]) ||
          normalized[selected.getString("code")] <= 0)
      )
        throw new HttpError(
          502,
          "Selected currency rate is missing in the API response.",
        );
      for (const record of owned) {
        const rate = normalized[record.getString("code")];
        if (Number.isFinite(rate) && rate > 0) {
          record.set("rate", rate);
          repository.save(record);
          updated++;
        }
      }
    }
    const log =
      repository.findRecordsByFilter("exchange_log", "", "", 1)[0] ||
      new DataRecord(repository.findCollectionByNameOrId("exchange_log"));
    log.set("last_update", new Date().toISOString());
    log.set("provider", provider);
    log.set("status", "success");
    repository.save(log);
  });
  return {
    updated,
    base: userId ? mainCurrencies[0].getString("code") : "EUR",
  };
}
module.exports = { updateRates, fetchLatestRates, cachedLatestRates, RATE_CACHE_TTL };
