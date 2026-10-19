const {
  onRecordCreate,
  onRecordUpdate,
  onRecordDelete,
} = require("../runtime.cjs");

function ensureMain(e) {
  const user = e.record.getString("user");
  const otherMain = e.app.countRecords(
    "household",
    "user = {:user} && is_main = true && id != {:id}",
    { user, id: e.record.id },
  );
  if (e.record.getBool("is_main") || !otherMain) {
    e.record.set("is_main", true);
    e.app.connection
      .prepare("UPDATE household SET is_main=0 WHERE user=? AND id!=?")
      .run(user, e.record.id);
  }
  e.next();
}
onRecordCreate(ensureMain, "household");
onRecordUpdate(ensureMain, "household");
onRecordDelete((e) => {
  const wasMain = e.record.getBool("is_main");
  const user = e.record.getString("user");
  e.next();
  if (wasMain) {
    const next = e.app.findRecordsByFilter(
      "household",
      "user = {:user}",
      "name,id",
      1,
      0,
      { user },
    )[0];
    if (next) {
      next.set("is_main", true);
      e.app.save(next);
    }
  }
}, "household");
