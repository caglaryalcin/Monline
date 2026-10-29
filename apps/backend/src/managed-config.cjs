const { BadRequestError, ForbiddenError } = require("./errors.cjs");
const managedCollections = new Set(["notifications_config"]);
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
const toggleFields = new Set(
  Object.keys(channelFields).map((id) => id + "_enabled"),
);
function isAdmin(repository, user) {
  return (
    !!user &&
    repository.findRecordsByFilter("users", "", "created,id", 1)[0]?.id ===
      user.id
  );
}
function ownerId(repository, user, candidate) {
  const id = candidate === undefined ? user.id : candidate;
  if (typeof id !== "string" || !/^[a-z0-9]{15}$/.test(id))
    throw new BadRequestError("admin_config_invalid_owner");
  if (id !== user.id && !isAdmin(repository, user))
    throw new ForbiddenError("admin_config_required");
  repository.findRecordById("users", id);
  return id;
}
function availability(repository) {
  return require("./server-config.cjs").availability(repository);
}
function guardWrite(repository, user, record, body) {
  if (
    record.collection().name === "notifications_config" &&
    record.getString("user") !== user.id &&
    Object.keys(body).some((key) => toggleFields.has(key))
  )
    throw new ForbiddenError("admin_channels_preference_owner_only");

  if (record.collection().name === "fixer_settings")
    throw new ForbiddenError("admin_config_required");
  if (Object.keys(body).some((key) => key !== "user" && !toggleFields.has(key)))
    throw new ForbiddenError("admin_channels_toggle_only");
  const available = availability(repository);
  for (const [key, value] of Object.entries(body)) {
    if (
      toggleFields.has(key) &&
      [true, "true", 1, "1"].includes(value) &&
      !available[key.slice(0, -8)]
    )
      throw new BadRequestError("admin_channel_not_configured");
  }
}
module.exports = {
  managedCollections,
  toggleFields,
  isAdmin,
  ownerId,
  availability,
  guardWrite,
};
