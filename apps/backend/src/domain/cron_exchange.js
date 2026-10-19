const { Record, cronAdd, httpClient, repository } = require("../runtime.cjs");
const domainPath = __dirname;
// ================================================================
// CRON 2: Update Exchange Rates (twice daily at 00:00 and 12:00)
//
// Free plans on Fixer.io and APILayer only support EUR as the base.
// We always fetch EUR-based rates and normalize them to each user's
// main currency:  stored_rate[X] = eurRates[X] / eurRates[mainCode]
// ================================================================
cronAdd("updateExchange", "0 0,12 * * *", async () => {
  // Fetch settings first and validate the persisted secret in JavaScript rather
  // than filtering on the secret itself.
  const fixerRecords = repository.findRecordsByFilter(
    "fixer_settings",
    "1=1",
    "",
    0,
    0,
  );
  for (const fixer of fixerRecords) {
    const apiKey = fixer.get("api_key");
    // Skip records where no API key has been stored yet
    if (!String(apiKey || "").trim()) continue;
    const provider = fixer.get("provider") || "fixer";
    const userId = fixer.get("user");

    // Use is_main flag as authoritative source — user.main_currency may be stale
    const mainCurrencies = repository.findRecordsByFilter(
      "currencies",
      "user = {:u} && is_main = true",
      "",
      1,
      0,
      {
        u: userId,
      },
    );
    if (mainCurrencies.length === 0) continue;
    const mainCode = mainCurrencies[0].get("code");

    // Always fetch with EUR as base — use HTTPS for Docker/proxy compatibility
    let url, headers;
    if (provider === "apilayer") {
      url = "https://api.apilayer.com/fixer/latest?base=EUR";
      headers = {
        apikey: apiKey,
      };
    } else {
      url = "https://data.fixer.io/api/latest?access_key=" + apiKey;
      headers = {};
    }
    try {
      const res = await httpClient.send({
        url: url,
        method: "GET",
        headers: headers,
      });
      if (res.statusCode === 200 && res.json && res.json.rates) {
        const eurRates = res.json.rates;
        eurRates["EUR"] = 1;
        const mainEurRate = eurRates[mainCode];
        if (!mainEurRate) {
          console.log(
            "[Monline] updateExchange: unknown main currency '" +
              mainCode +
              "' for user " +
              userId,
          );
          continue;
        }
        const currencies = repository.findRecordsByFilter(
          "currencies",
          "user = {:u}",
          "",
          0,
          0,
          {
            u: userId,
          },
        );
        for (const cur of currencies) {
          const code = cur.get("code");
          if (code === mainCode) {
            cur.set("rate", 1);
            repository.save(cur);
          } else if (eurRates[code] !== undefined) {
            cur.set("rate", eurRates[code] / mainEurRate);
            repository.save(cur);
          }
        }
        try {
          const logs = repository.findRecordsByFilter(
            "exchange_log",
            "",
            "",
            1,
            0,
          );
          if (logs.length > 0) {
            logs[0].set("last_update", new Date().toISOString());
            repository.save(logs[0]);
          } else {
            const logCol = repository.findCollectionByNameOrId("exchange_log");
            const logRecord = new Record(logCol);
            logRecord.set("last_update", new Date().toISOString());
            repository.save(logRecord);
          }
        } catch (_) {}
        console.log(
          "[Monline] updateExchange: updated rates for user " +
            userId +
            " (base: " +
            mainCode +
            ")",
        );
      }
    } catch (err) {
      console.log("[Monline] updateExchange error:", err);
    }
  }
});
