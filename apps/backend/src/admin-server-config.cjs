const { BadRequestError, ForbiddenError } = require("./errors.cjs");
const config = require("./server-config.cjs");
const { toggleFields } = require("./managed-config.cjs");
function registerServerConfigApi(app, repository, auth) {
  const admin = (req) => {
    auth.requireUser(req);
    if (!auth.isAdmin(req.user))
      throw new ForbiddenError("admin_config_required");
  };
  const channelOutput = () => ({
    id: "global",
    ...config.channels(repository),
    available_channels: config.availability(repository),
  });
  app.get("/api/admin/channels", (req, res) => {
    admin(req);
    res.json(channelOutput());
  });
  app.patch("/api/admin/channels", (req, res) => {
    admin(req);
    const data = { ...config.channels(repository) };
    for (const [key, value] of Object.entries(req.body || {})) {
      if (key === "reminders") {
        if (
          !Array.isArray(value) ||
          !value.length ||
          value.length > 50 ||
          value.some(
            (slot) =>
              !slot ||
              !Number.isInteger(slot.days) ||
              slot.days < 0 ||
              slot.days > 365 ||
              !Number.isInteger(slot.hour) ||
              slot.hour < 0 ||
              slot.hour > 23,
          )
        )
          throw new BadRequestError("Invalid reminder schedule");
        data.reminders = value.map(({ days, hour }) => ({ days, hour }));
      } else {
        if (
          !config.credentialFields.includes(key) ||
          typeof value !== "string" ||
          value.length > 8192
        )
          throw new BadRequestError("Invalid channel configuration");
        data[key] = value.trim();
      }
    }
    config.save(repository, "server_notification_channels", data);
    res.json(channelOutput());
  });
  const exchangeOutput = () => {
    const { api_key, ...data } = config.exchange(repository);
    return {
      ...data,
      id: "global",
      api_key_configured: !!String(api_key || "").trim(),
    };
  };
  app.get("/api/admin/exchange", (req, res) => {
    admin(req);
    res.json(exchangeOutput());
  });
  app.get("/api/exchange/status", (req, res) => {
    auth.requireUser(req);
    const data = exchangeOutput();
    res.json({
      enabled: data.enabled,
      api_key_configured: data.api_key_configured,
    });
  });
  app.patch("/api/admin/exchange", (req, res) => {
    admin(req);
    const data = { ...config.exchange(repository) };
    for (const [key, value] of Object.entries(req.body || {})) {
      if (
        key === "api_key" &&
        typeof value === "string" &&
        value.length <= 8192
      )
        data.api_key = value.trim();
      else if (key === "provider" && ["fixer", "apilayer"].includes(value))
        data.provider = value;
      else if (key === "enabled" && typeof value === "boolean")
        data.enabled = value;
      else throw new BadRequestError("Invalid exchange configuration");
    }
    config.save(repository, "server_exchange", data);
    res.json(exchangeOutput());
  });
  app.post("/api/admin/exchange/update", async (req, res) => {
    admin(req);
    res.json(
      await require("./exchange-service.cjs").updateRates(
        repository,
        require("./runtime.cjs").httpClient,
      ),
    );
  });
  app.get("/api/notifications/preferences", (req, res) => {
    auth.requireUser(req);
    const record = repository.findRecordsByFilter(
      "notifications_config",
      "user = {:user}",
      "",
      1,
      0,
      { user: req.user.id },
    )[0];
    res.json({
      id: record?.id || "",
      user: req.user.id,
      ...Object.fromEntries(
        [...toggleFields].map((key) => [key, !!record?.getBool(key)]),
      ),
      available_channels: config.availability(repository),
    });
  });
}
module.exports = { registerServerConfigApi };
