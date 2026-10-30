const { loadSpendingData } = require("./spending-data.js");
const { spendingData } = require("./pure/spending.js");
const { COLLECTIONS } = require("./pure/finance.js");

// A single read-only account snapshot. Credentials, files and server settings
// are deliberately outside this financial document's collection allowlist.
function spreadsheetSnapshot(tx, owner, now = new Date()) {
  const owned = (name) => tx.findRecordsByFilter(name, "user = {:owner}", "", 0, 0, { owner })
    .map((record) => {
      const { user, collectionId, collectionName, expand, ...values } = record.publicExport();
      return values;
    });
  const source = loadSpendingData(tx, owner);
  const finance = Object.fromEntries(COLLECTIONS.map((name) => [name, source[name] || owned(name)]));
  const collections = Object.fromEntries([
    "subscriptions", "payment_records", "subscription_history", "yearly_costs",
    "manual_bills", "merchant_logos", "categories", "currencies", "payment_methods", "household",
    "calendar_moves",
  ].map((name) => [name, owned(name)]));
  return {
    version: 1,
    exported_at: now.toISOString(),
    today: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(now),
    finance,
    spending: spendingData(source, { trackingOnly: true }),
    statements: owned("bank_statements"),
    collections,
    cycles: tx.findRecordsByFilter("cycles").map((record) => ({ id: record.id, name: record.getString("name") })),
  };
}

module.exports = { spreadsheetSnapshot };
