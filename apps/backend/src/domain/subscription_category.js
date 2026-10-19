const {
  onRecordCreate,
  onRecordUpdate,
  onRecordUpdateRequest,
} = require("../runtime.cjs");
const {
  requireSubscriptionCategory,
} = require("./lib/subscription-category.js");

onRecordCreate((event) => {
  // Restore historical backups faithfully, including older uncategorized records.
  if (event.record.get("__monline_restore") !== true)
    requireSubscriptionCategory(event.app, event.record);
  event.next();
}, "subscriptions");

onRecordUpdateRequest((event) => {
  requireSubscriptionCategory(event.app, event.record);
  event.next();
}, "subscriptions");

onRecordUpdate((event) => {
  // Background payment/schedule updates must continue for legacy records.
  if (
    event.record.get("__monline_restore") !== true &&
    event.record.original().getString("category") &&
    !event.record.getString("category")
  )
    requireSubscriptionCategory(event.app, event.record);
  event.next();
}, "subscriptions");
