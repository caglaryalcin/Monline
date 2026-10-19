const {
  onRecordCreate,
  onRecordUpdate,
  onRecordDelete,
} = require("../runtime.cjs");

function ensureMain(e) {
  const user = e.record.getString("user");
  const otherMain = e.app.countRecords(
    "payment_methods",
    "user = {:user} && is_main = true && id != {:id}",
    { user, id: e.record.id },
  );
  if (e.record.getBool("is_main") || !otherMain) {
    e.record.set("is_main", true);
    // Runs inside the record transaction; selecting a main method cannot leave two mains.
    e.app.connection
      .prepare("UPDATE payment_methods SET is_main=0 WHERE user=? AND id!=?")
      .run(user, e.record.id);
  }
  e.next();
}
onRecordCreate(ensureMain, "payment_methods");
onRecordUpdate(ensureMain, "payment_methods");
onRecordDelete((e) => {
  const wasMain = e.record.getBool("is_main");
  const user = e.record.getString("user");
  e.next();
  if (wasMain) {
    const next = e.app.findRecordsByFilter(
      "payment_methods",
      "user = {:user}",
      "order,name,id",
      1,
      0,
      { user },
    )[0];
    if (next) {
      next.set("is_main", true);
      e.app.save(next);
    }
  }
}, "payment_methods");
