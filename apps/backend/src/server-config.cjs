// Installation-wide integrations. User records contain delivery preferences only.
const {
  normalizeReminderSlots,
} = require("./domain/lib/pure/reminder-slots.js");
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
const channels = (repository) =>
  load(
    repository,
    "server_notification_channels",
    "notifications_config",
    [...credentialFields, "reminders"],
    { reminders: [{ days: 3, hour: 8 }] },
  );
const exchange = (repository) =>
  load(
    repository,
    "server_exchange",
    "fixer_settings",
    ["api_key", "provider", "enabled"],
    { api_key: "", provider: "fixer", enabled: false },
  );
function availability(repository) {
  const config = channels(repository);
  return Object.fromEntries(
    Object.entries(channelFields).map(([id, fields]) => [
      id,
      id === "email"
        ? !!repository.settings().smtp.enabled
        : fields.every((field) => !!String(config[field] || "").trim()),
    ]),
  );
}
function effectiveNotificationConfig(repository, userId, preferences) {
  const config = channels(repository);
  const available = availability(repository);
  const user = repository.findRecordById("users", userId);
  const get = (key) => {
    if (key === "email_to") return user.getString("email");
    if (key === "reminders") return normalizeReminderSlots(config.reminders);
    if (key.endsWith("_enabled"))
      return !!available[key.slice(0, -8)] && !!preferences?.getBool(key);
    return config[key];
  };
  return {
    get,
    getString: (key) => String(get(key) ?? ""),
    getBool: (key) => !!get(key),
  };
}
module.exports = {
  channels,
  exchange,
  save,
  availability,
  effectiveNotificationConfig,
  channelFields,
  credentialFields,
};
