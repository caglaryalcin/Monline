const {
  UnauthorizedError,
  apiLimits,
  repository,
  routerAdd,
} = require("../runtime.cjs");
const { moveCalendarPayment } = require("./lib/calendar-move.js");

routerAdd(
  "POST",
  "/api/calendar/move-payment",
  (e) => {
    if (!e.auth || e.auth.collection().name !== "users")
      throw new UnauthorizedError();
    return e.json(
      200,
      moveCalendarPayment(repository, e.auth.id, e.requestInfo().body),
    );
  },
  apiLimits.bodyLimit(4096),
);
