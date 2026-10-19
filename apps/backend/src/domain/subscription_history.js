const {
  onRecordCreate,
  onRecordDelete,
  onRecordUpdate,
} = require("../runtime.cjs");
const domainPath = __dirname;

onRecordCreate((e) => {
  const history = require(domainPath + "/lib/subscription-history.js");
  e.next();
  if (e.record.get("__monline_restore") !== true)
    history.logCreated(e.app, e.record);
}, "subscriptions");
onRecordUpdate((e) => {
  const history = require(domainPath + "/lib/subscription-history.js");
  const before = history.snapshotFromRecord(e.app, e.record.original());
  e.next();
  if (e.record.get("__monline_restore") !== true)
    history.logChanges(e.app, e.record, before);
}, "subscriptions");
onRecordDelete((e) => {
  const history = require(domainPath + "/lib/subscription-history.js");
  e.next();
  history.deleteForSubscription(e.app, e.record.id);
}, "subscriptions");
