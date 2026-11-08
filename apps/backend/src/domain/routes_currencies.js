const { repository, routerAdd, UnauthorizedError } = require("../runtime.cjs");
const { setMainCurrency } = require("./lib/currencies.js");

routerAdd("PUT", "/api/currencies/{id}/main", (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  return e.json(
    200,
    setMainCurrency(repository, e.auth.id, e.request.pathValue("id")),
  );
});
