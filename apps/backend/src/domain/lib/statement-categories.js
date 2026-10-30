const { DataRecord } = require("../../storage.cjs");
const { unitemizedFees } = require("./statement-checks.js");
const LABELS = {
  digital: [
    "Digital / Subscriptions",
    "Dijital / Abonelik",
    "Digital / Abonnements",
  ],
  online: ["Online shopping", "Online Alışveriş", "Online-Einkäufe"],
  bills: ["Bills / Services", "Fatura / Hizmet", "Rechnungen / Dienste"],
  shopping: ["Clothing / Shopping", "Giyim / Alışveriş", "Kleidung / Einkäufe"],
  health: ["Health", "Sağlık", "Gesundheit"],
  groceries: ["Groceries", "Market / Gıda", "Lebensmittel"],
  dining: ["Dining / Restaurants", "Yemek / Restoran", "Essen / Restaurants"],
  coffee: ["Coffee", "Kahve", "Kaffee"],
  travel: ["Travel", "Seyahat", "Reisen"],
  transport: ["Transport", "Ulaşım", "Verkehr"],
  toys: ["Toys", "Oyuncak", "Spielzeug"],
  foreign: ["Foreign purchases", "Yurtdışı Harcamalar", "Auslandseinkäufe"],
  other: ["Other", "Diğer", "Sonstiges"],
  fees: ["Interest / Taxes", "Faiz / Vergi", "Zinsen / Steuern"],
};
const normalize = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Called inside the statement-save transaction. Never touch another owner's
// categories, rename an existing category or create unused statement groups.
function ensureStatementCategories(tx, owner, statement) {
  const used = new Set(
    statement.transactions
      .filter((row) => row.kind !== "repayment" && LABELS[row.category])
      .map((row) => row.category),
  );
  if (
    unitemizedFees(
      statement.transactions,
      statement.summary,
      statement.excluded_transactions,
    ) > 0 ||
    statement.transactions.some(
      (row) =>
        row.financing &&
        ["interest", "kkdf", "bsmv"].some((key) => row.financing[key] > 0),
    )
  )
    used.add("fees");
  const existing = tx.findRecordsByFilter(
    "categories",
    "user = {:owner}",
    "id",
    0,
    0,
    { owner },
  );
  let created = 0;
  for (const key of used) {
    const labels = LABELS[key].map(normalize);
    if (
      existing.some(
        (record) =>
          record.getString("translation_key") === `statement_${key}` ||
          labels.includes(normalize(record.getString("name"))),
      )
    )
      continue;
    const record = new DataRecord(tx.findCollectionByNameOrId("categories"));
    record.set("user", owner);
    record.set("name", LABELS[key][0]);
    record.set("translation_key", `statement_${key}`);
    tx.save(record);
    existing.push(record);
    created++;
  }
  return created;
}
module.exports = { ensureStatementCategories, LABELS };
