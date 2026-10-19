const { UnauthorizedError, repository, routerAdd } = require("../runtime.cjs");
const domainPath = __dirname;
routerAdd("GET", "/api/update-check", async (e) => {
  if (!e.auth || e.auth.collection().name !== "users")
    throw new UnauthorizedError();
  e.response.header().set("Cache-Control", "private, no-store");
  e.response.header().set("X-Content-Type-Options", "nosniff");
  return e.json(
    200,
    await require(domainPath + "/lib/project.js").checkUpdates(repository),
  );
});
