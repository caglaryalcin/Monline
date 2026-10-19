const { Record, cronAdd, repository } = require("../runtime.cjs");
const domainPath = __dirname;
// ================================================================
// CRON 3: Store Yearly/Monthly Cost Snapshot
cronAdd("storeYearlyCost", "0 3 1 * *", () => {
  const dateHelpers = require(domainPath + "/lib/date-helpers.js");
  const recordTypes = require(domainPath + "/lib/pure/record-types.js");
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Get all distinct users with active subscriptions
  const users = repository.findRecordsByFilter("users", "", "", 0, 0);
  for (const user of users) {
    const userId = user.id;
    let totalMonthlyCost = 0;
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
    for (const sub of subs) {
      if (!recordTypes.isExpense(sub.get("record_type"))) continue;
      const price = sub.get("price") || 0;
      const frequency = sub.get("frequency") || 1;
      let cycleName = "Monthly";
      try {
        const cycleRecord = repository.findRecordById(
          "cycles",
          sub.get("cycle"),
        );
        cycleName = cycleRecord.get("name");
      } catch (_) {}
      let exchangeRate = 1;
      try {
        const currency = repository.findRecordById(
          "currencies",
          sub.get("currency"),
        );
        exchangeRate = currency.get("rate") || 1;
      } catch (_) {}
      totalMonthlyCost += dateHelpers.getPricePerMonth(
        price,
        cycleName,
        frequency,
        exchangeRate,
      );
    }

    // Upsert yearly_costs record
    const yearlyCostsCol = repository.findCollectionByNameOrId("yearly_costs");
    let existing = [];
    try {
      existing = repository.findRecordsByFilter(
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
    } catch (_) {}
    const rounded = Math.round(totalMonthlyCost * 100) / 100;
    if (existing.length > 0) {
      existing[0].set("total", rounded);
      repository.save(existing[0]);
    } else {
      const record = new Record(yearlyCostsCol);
      record.set("user", userId);
      record.set("year", year);
      record.set("month", month);
      record.set("total", rounded);
      repository.save(record);
    }
  }
  console.log(
    "[Monline] storeYearlyCost: snapshot saved for " + year + "/" + month,
  );
});
