const {
  ForbiddenError,
  httpClient,
  repository,
  routerAdd,
} = require("../runtime.cjs");
routerAdd("POST", "/api/fixer/update", async (e) => {
  if (!e.auth) throw new ForbiddenError("Authentication required");
  const result = await require("../exchange-service.cjs").updateRates(
    repository,
    httpClient,
    {
      userId: e.auth.id,
      currencyId: e.requestInfo().body.currencyId,
    },
  );
  return e.json(200, result);
});
