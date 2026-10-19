const { onRecordCreate } = require("../runtime.cjs");
const { automaticStartDate } = require("./lib/pure/subscription-start.js");

onRecordCreate((e) => {
  if (
    e.record.get("__monline_restore") !== true &&
    !e.record.getString("start_date")
  ) {
    const [cycle] = e.app.findRecordsByFilter(
      "cycles",
      "id = {:id}",
      "",
      1,
      0,
      { id: e.record.getString("cycle") },
    );
    if (cycle)
      e.record.set(
        "start_date",
        automaticStartDate(
          e.record.getString("next_payment").slice(0, 10),
          cycle.getString("name"),
          Number(e.record.get("frequency")) || 1,
        ),
      );
  }
  e.next();
}, "subscriptions");
