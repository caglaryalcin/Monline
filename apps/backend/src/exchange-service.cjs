const { BadRequestError, NotFoundError, HttpError } = require("./errors.cjs");
const { DataRecord } = require("./storage.cjs");
const {
  normalizeRatesByMainCurrency,
} = require("./domain/lib/pure/exchange-rates.js");
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
  const settings = require("./server-config.cjs").exchange(repository);
  const apiKey = String(settings.api_key || "").trim();
  if (!apiKey || !settings.enabled)
    throw new BadRequestError("No exchange rate API key configured.");
  const provider = settings.provider || "fixer";
  const response = await httpClient.send({
    url:
      provider === "apilayer"
        ? "https://api.apilayer.com/fixer/latest?base=EUR"
        : "https://data.fixer.io/api/latest?access_key=" +
          encodeURIComponent(apiKey),
    method: "GET",
    headers: provider === "apilayer" ? { apikey: apiKey } : {},
  });
  if (
    response.statusCode !== 200 ||
    !response.json?.rates ||
    response.json.success === false
  ) {
    const error = new Error("Exchange rate API request failed.");
    error.status = 502;
    throw error;
  }
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
          response.json.rates,
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
module.exports = { updateRates };
