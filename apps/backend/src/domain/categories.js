const { onRecordUpdate } = require("../runtime.cjs");
const domainPath = __dirname;
// Renaming a seeded category through any write path makes it a literal user name.
onRecordUpdate((e) => {
  if (e.record.getString("name") !== e.record.original().getString("name")) {
    e.record.set("translation_key", "");
  }
  e.next();
}, "categories");
