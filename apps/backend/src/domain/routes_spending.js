const { repository, routerAdd, UnauthorizedError } = require("../runtime.cjs");
const { spendingData } = require("./lib/pure/spending.js");
const { loadSpendingData } = require("./lib/spending-data.js");

routerAdd("GET", "/api/spreadsheet-export", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  const snapshot = repository.runInTransaction((tx) =>
    require("./lib/spreadsheet-export.js").spreadsheetSnapshot(tx, e.auth.id));
  return e.json(200, snapshot);
});

routerAdd("GET", "/api/spending", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  let result;
  repository.runInTransaction((tx) => {
    result = spendingData(loadSpendingData(tx, e.auth.id), { trackingOnly: true });
  });
  return e.json(200, result);
});
