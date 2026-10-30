const {
  UnauthorizedError,
  BadRequestError,
  apiLimits,
  repository,
  routerAdd,
} = require("../runtime.cjs");
const { moveCalendarPayment } = require("./lib/calendar-move.js");
const { moveSourceCalendar } = require("./lib/calendar-placement.js");
routerAdd(
  "POST",
  "/api/calendar/move-payment",
  (e) => {
    if (!e.auth || e.auth.collection().name !== "users")
      throw new UnauthorizedError();
    const body = e.requestInfo().body;
    if (
      (body.mode !== undefined &&
        !["calendar", "ledger"].includes(body.mode)) ||
      (body.mode === "ledger" && body.source !== "ledger")
    )
      throw new BadRequestError("calendar_move_invalid");
    return e.json(
      200,
      body.source
        ? moveSourceCalendar(repository, e.auth.id, body)
        : moveCalendarPayment(repository, e.auth.id, body),
    );
  },
  apiLimits.bodyLimit(4096),
);
