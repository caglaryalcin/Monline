const { Record, repository, routerAdd } = require("../runtime.cjs");
const domainPath = __dirname;
// ================================================================
// ROUTE: POST /api/costs/snapshot — calculate & upsert current month cost
// Called by the dashboard when the current month's subscription total changes.
routerAdd("POST", "/api/costs/snapshot", (e) => {
  const dateHelpers = require(domainPath + "/lib/date-helpers.js");
  const recordTypes = require(domainPath + "/lib/pure/record-types.js");
  if (!e.auth || e.auth.collection().name !== "users")
    return e.json(401, {
      error: "Authentication required",
    });
  const userId = e.auth.id;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let totalMonthlyCost = 0;
  try {
    const subs = repository.findRecordsByFilter(
      "subscriptions",
      "user = {:userId} && inactive = false",
      "",
      0,
      0,
      {
        userId: userId,
      },
    );
    const cycleNames = {};
    const currencyRates = {};
    for (const sub of subs) {
      if (!recordTypes.isExpense(sub.get("record_type"))) continue;
      const price = sub.get("price") || 0;
      const frequency = sub.get("frequency") || 1;
      const cycleId = sub.getString("cycle");
      if (!Object.prototype.hasOwnProperty.call(cycleNames, cycleId)) {
        cycleNames[cycleId] = "Monthly";
        try {
          cycleNames[cycleId] = repository
            .findRecordById("cycles", cycleId)
            .getString("name");
        } catch (_) {}
      }
      const cycleName = cycleNames[cycleId];
      const currencyId = sub.getString("currency");
      if (!Object.prototype.hasOwnProperty.call(currencyRates, currencyId)) {
        currencyRates[currencyId] = 1;
        try {
          currencyRates[currencyId] =
            repository.findRecordById("currencies", currencyId).get("rate") ||
            1;
        } catch (_) {}
      }
      const rate = currencyRates[currencyId];
      totalMonthlyCost += dateHelpers.getPricePerMonth(
        price,
        cycleName,
        frequency,
        rate,
      );
    }
  } catch (err) {
    return e.json(500, {
      error: "Failed to calculate costs: " + String(err),
    });
  }
  const rounded = Math.round(totalMonthlyCost * 100) / 100;
  try {
    repository.runInTransaction((tx) => {
      const col = tx.findCollectionByNameOrId("yearly_costs");
      const existing = tx.findRecordsByFilter(
        "yearly_costs",
        "user = {:userId} && year = {:year} && month = {:month}",
        "",
        1,
        0,
        {
          userId: userId,
          year: year,
          month: month,
        },
      );
      if (existing.length > 0) {
        // Avoid a database write on every unchanged dashboard visit.
        if (existing[0].get("total") !== rounded) {
          existing[0].set("total", rounded);
          tx.save(existing[0]);
        }
      } else {
        const record = new Record(col);
        record.set("user", userId);
        record.set("year", year);
        record.set("month", month);
        record.set("total", rounded);
        tx.save(record);
      }
    });
  } catch (err) {
    return e.json(500, {
      error: "Failed to save snapshot: " + String(err),
    });
  }
  return e.json(200, {
    year,
    month,
    total: rounded,
  });
});
