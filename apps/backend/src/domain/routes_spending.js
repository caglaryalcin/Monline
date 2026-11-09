const {
  repository,
  routerAdd,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} = require("../runtime.cjs");
const { spendingData } = require("./lib/pure/spending.js");
const { loadSpendingData } = require("./lib/spending-data.js");
const { amount: validAmount } = require("./lib/pure/finance.js");
const { loanKey, isLoanRow } = require("./lib/pure/loans.js");

routerAdd("PUT", "/api/loans/{id}/principal", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  const amount = e.requestInfo().body?.amount;
  if (amount !== null && !validAmount(amount, false))
    throw new BadRequestError("loans_principal_invalid");
  const principal = amount === null ? null : Math.round(amount * 100) / 100;
  repository.runInTransaction((tx) => {
    const rows = tx.findRecordsByFilter(
      "finance_rows",
      "user = {:user}",
      "",
      0,
      0,
      { user: e.auth.id },
    );
    const row = rows.find((record) => record.id === e.request.pathValue("id"));
    if (!row || !isLoanRow(row.publicExport())) throw new NotFoundError();
    const key = loanKey(row.getString("name"));
    for (const record of rows) {
      if (
        isLoanRow(record.publicExport(), true) &&
        loanKey(record.getString("name")) === key
      ) {
        record.set("loan_principal", principal ?? 0);
        tx.save(record);
      }
    }
  });
  return e.json(200, { principal_amount: principal });
});

routerAdd("GET", "/api/spreadsheet-export", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  const snapshot = repository.runInTransaction((tx) =>
    require("./lib/spreadsheet-export.js").spreadsheetSnapshot(tx, e.auth.id),
  );
  return e.json(200, snapshot);
});

routerAdd("GET", "/api/spending", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  let result;
  repository.runInTransaction((tx) => {
    result = spendingData(loadSpendingData(tx, e.auth.id), {
      trackingOnly: true,
    });
  });
  return e.json(200, result);
});
