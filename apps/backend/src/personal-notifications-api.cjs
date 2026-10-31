function registerPersonalNotificationsApi(app, repository, auth) {
  const settings = require("./personal-notifications.cjs");
  app.get("/api/notifications/channels", (req, res) =>
    res.json(settings.output(repository, auth.requireUser(req).id)));
  app.patch("/api/notifications/channels", (req, res) =>
    res.json(repository.runInTransaction(() => settings.update(repository, auth.requireUser(req).id, req.body))));
}
module.exports = { registerPersonalNotificationsApi };
