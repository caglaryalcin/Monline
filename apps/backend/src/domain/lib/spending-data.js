function loadSpendingData(tx, owner) {
  return Object.fromEntries(
    [
      "bank_statements",
      "finance_rows",
      "finance_entries",
      "finance_card_transactions",
      "finance_statement_links",
      "manual_bills",
      "budget_matches",
      "calendar_moves",
      "subscriptions",
      "payment_records",
      "currencies",
      "payment_methods",
    ].map((name) => [
      name,
      tx
        .findRecordsByFilter(name, "user = {:owner}", "", 0, 0, { owner })
        .map((record) => record.publicExport()),
    ]),
  );
}
module.exports = { loadSpendingData };
