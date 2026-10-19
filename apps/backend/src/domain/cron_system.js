const { cronAdd, repository } = require("../runtime.cjs");
const domainPath = __dirname;
cronAdd("checkForUpdates", "0 * * * *", async () => {
  await require(domainPath + "/lib/project.js").checkUpdates(repository);
});
