const { onRecordUpdate } = require("../runtime.cjs");
const { formatLocalDate } = require("./lib/date-helpers.js");
const { restoreReactivatedMonth } = require("./lib/subscription-reactivation.js");

onRecordUpdate((event) => {
  const reactivated = event.record.get("__monline_restore") !== true &&
    event.record.original().getBool("inactive") && !event.record.getBool("inactive");
  event.next();
  if (reactivated)
    restoreReactivatedMonth(event.app, event.record, formatLocalDate(new Date()));
}, "subscriptions");
