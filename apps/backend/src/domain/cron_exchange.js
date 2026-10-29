const { cronAdd, httpClient, repository } = require("../runtime.cjs");
// Fetch once with the installation's key, normalize for each account's main currency.
cronAdd("updateExchange", "0 0,12 * * *", async () => {
  const config = require("../server-config.cjs").exchange(repository);
  if (!config.enabled || !String(config.api_key || "").trim()) return;
  try {
    await require("../exchange-service.cjs").updateRates(
      repository,
      httpClient,
    );
  } catch {
    console.error("[Monline] Scheduled exchange rate update failed");
  }
});
