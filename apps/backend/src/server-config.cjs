// Administrators manage shared connections; accounts own switches and reminder schedules.
const channelFields = {
  email: [],
  discord: ["discord_webhook_url"],
  telegram: ["telegram_bot_token", "telegram_chat_id"],
  gotify: ["gotify_url", "gotify_token"],
  pushover: ["pushover_user_key", "pushover_api_token"],
  ntfy: ["ntfy_topic"],
  pushplus: ["pushplus_token"],
  mattermost: ["mattermost_webhook_url"],
  webhook: ["webhook_url"],
  serverchan: ["serverchan_send_key"],
};
const credentialFields = [
  ...new Set(Object.values(channelFields).flat()),
  "ntfy_url",
  "ntfy_username",
  "ntfy_password",
  "ntfy_auth_token",
];
function save(repository, key, value) {
  repository.connection
    .prepare("INSERT OR REPLACE INTO monline_meta (key,value) VALUES (?,?)")
    .run(key, JSON.stringify(value));
  return value;
}
function load(repository, key, collection, fields, defaults) {
  const stored = repository.connection
    .prepare("SELECT value FROM monline_meta WHERE key=?")
    .get(key);
  if (stored) return { ...defaults, ...JSON.parse(stored.value) };
  const admin = repository.findRecordsByFilter("users", "", "created,id", 1)[0];
  if (!admin) return { ...defaults };
  const legacy = repository.findRecordsByFilter(
    collection,
    "user = {:user}",
    "id",
    1,
    0,
    { user: admin.id },
  )[0];
  const migrated = { ...defaults };
  if (legacy) for (const field of fields) migrated[field] = legacy.get(field);
  return save(repository, key, migrated);
}
function channels(repository) {
  const value = load(
    repository,
    "server_notification_channels",
    "notifications_config",
    [...credentialFields, "reminders"],
    { reminders: [{ days: 3, hour: 8 }] },
  );
  // Bind previously saved, single-language templates once, before the admin changes language.
  if (
    value.templates &&
    Object.keys(value.templates).length &&
    !value.template_language
  ) {
    const admin = repository.findRecordsByFilter(
      "users",
      "",
      "created,id",
      1,
    )[0];
    value.template_language =
      require("./notification-language.cjs").resolveLanguage(
        admin?.getString("language"),
      );
    save(repository, "server_notification_channels", value);
  }
  return value;
}
const exchange = (repository) =>
  load(
    repository,
    "server_exchange",
    "fixer_settings",
    ["api_key", "provider", "enabled"],
    { api_key: "", provider: "fixer", enabled: false },
  );
function enabledChannels(repository) {
  const config = channels(repository);
  return Object.fromEntries(
    Object.entries(channelFields).map(([id, fields]) => [
      id,
      id === "email"
        ? !!repository.settings().smtp.enabled
        : typeof config.enabled_channels?.[id] === "boolean"
          ? config.enabled_channels[id]
          : fields.every((field) => !!String(config[field] || "").trim()),
    ]),
  );
}
function availability(repository) {
  const config = channels(repository);
  const enabled = enabledChannels(repository);
  return Object.fromEntries(
    Object.entries(channelFields).map(([id, fields]) => [
      id,
      id === "email"
        ? !!repository.settings().smtp.enabled
        : enabled[id] && fields.every((field) => !!String(config[field] || "").trim()),
    ]),
  );
}
function effectiveNotificationConfig(repository, userId, preferences) {
  return require("./personal-notifications.cjs").effective(repository, userId, preferences);
}
module.exports = {
  channels,
  exchange,
  save,
  availability,
  enabledChannels,
  effectiveNotificationConfig,
  channelFields,
  credentialFields,
};
