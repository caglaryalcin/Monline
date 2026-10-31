const { DataRecord } = require("./storage.cjs");
const { BadRequestError } = require("./errors.cjs");
const config = require("./server-config.cjs");
const { normalizeReminderSlots } = require("./domain/lib/pure/reminder-slots.js");
const toggles = Object.keys(config.channelFields).map(id => id + "_enabled");
function recordFor(repository, owner) {
  let record = repository.findRecordsByFilter("notifications_config", "user = {:owner}", "", 1, 0, { owner })[0];
  if (!record) {
    record = new DataRecord(repository.findCollectionByNameOrId("notifications_config"));
    record.set("user", owner);
  }
  // Freeze the previous default once; subsequent changes belong to this account.
  if (!record.get("delivery_settings")?.reminders_personal) {
    const existing = record.get("reminders");
    record.set("reminders", normalizeReminderSlots(Array.isArray(existing) && existing.length
      ? existing : config.channels(repository).reminders));
    record.set("delivery_settings", { ...record.get("delivery_settings"), reminders_personal: true });
    repository.save(record);
  }
  return record;
}
function output(repository, owner) {
  const record = recordFor(repository, owner);
  return { id: record.id, user: owner,
    ...Object.fromEntries(toggles.map(key => [key, record.getBool(key)])),
    reminders: normalizeReminderSlots(record.get("reminders")),
    available_channels: config.availability(repository) };
}
function update(repository, owner, body) {
  const record = recordFor(repository, owner);
  for (const [key, value] of Object.entries(body || {})) {
    if (toggles.includes(key)) {
      if (typeof value !== "boolean") throw new BadRequestError("Invalid channel preference");
      if (value && !config.availability(repository)[key.slice(0, -8)])
        throw new BadRequestError("admin_channel_not_configured");
      record.set(key, value);
    } else if (key === "reminders") {
      if (!Array.isArray(value) || !value.length || value.length > 50 || value.some(slot =>
        !slot || !Number.isInteger(slot.days) || slot.days < 0 || slot.days > 365 ||
        !Number.isInteger(slot.hour) || slot.hour < 0 || slot.hour > 23))
        throw new BadRequestError("Invalid reminder schedule");
      record.set(key, value.map(({ days, hour }) => ({ days, hour })));
    } else throw new BadRequestError("Invalid channel preference");
  }
  repository.save(record);
  return output(repository, owner);
}
function effective(repository, owner, preferences) {
  const record = recordFor(repository, owner), shared = config.channels(repository);
  const user = repository.findRecordById("users", owner), available = config.availability(repository);
  const own = preferences?.getString?.("user") === owner ? preferences : record;
  const get = key => {
    if (["email_to", "user_email"].includes(key)) return user.getString("email");
    if (key === "user_name") return user.getString("name");
    if (key === "language") return user.getString("language") || "en";
    if (key === "smtp") return { ...repository.settings().smtp,
      senderAddress: repository.settings().meta.senderAddress || "noreply@monline.app",
      senderName: repository.settings().meta.senderName || "Monline" };
    if (key === "reminders") return normalizeReminderSlots(record.get("reminders"));
    if (key.endsWith("_enabled")) return !!available[key.slice(0, -8)] && own.getBool(key);
    return shared[key];
  };
  return { get, getString: key => String(get(key) ?? ""), getBool: key => !!get(key) };
}
module.exports = { recordFor, output, update, effective };
