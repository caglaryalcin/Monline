const { onRecordCreate, onRecordUpdate } = require("../runtime.cjs");
const domainPath = __dirname;
// These features are now standard behavior rather than display preferences.
// Apply to all writes, including account imports and administrator updates.
onRecordCreate((e) => {
  for (const field of [
    "payment_tracking",
    "convert_currency",
    "subscription_progress",
    "disabled_to_bottom",
    "show_original_price",
  ]) {
    e.record.set(field, true);
  }
  e.record.set("remove_background", false);
  e.next();
}, "users");
onRecordUpdate((e) => {
  for (const field of [
    "payment_tracking",
    "convert_currency",
    "subscription_progress",
    "disabled_to_bottom",
    "show_original_price",
  ]) {
    e.record.set(field, true);
  }
  e.record.set("remove_background", false);
  e.next();
}, "users");
