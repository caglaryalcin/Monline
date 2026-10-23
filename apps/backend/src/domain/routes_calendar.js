const {
  ForbiddenError,
  UnauthorizedError,
  apiLimits,
  repository,
  routerAdd,
  security,
} = require("../runtime.cjs");
const domainPath = __dirname;
// ================================================================
// ROUTE: Calendar iCal Feed
// GET /api/calendar/ical?key=wk_xxx  (requires calendar:read permission)
routerAdd("GET", "/api/calendar/ical", function (e) {
  var authHeaders = require(domainPath + "/lib/pure/auth-headers.js");
  var calendarUtils = require(domainPath + "/lib/pure/calendar-utils.js");
  var recordTypes = require(domainPath + "/lib/pure/record-types.js");
  var userId = e.auth ? e.auth.id : null;
  var rawKey =
    e.request.url.query().get("key") ||
    authHeaders.extractBearerToken(e.request.header.get("Authorization"));
  if (!userId && !rawKey) {
    return e.json(401, {
      error: "Missing API key",
    });
  }

  // Resolve via the new multi-key system (inlined — Node.js scoping)
  if (!userId) {
    try {
      var keyHash = security.sha256(rawKey);
      var apiKeys = repository.findRecordsByFilter(
        "api_keys",
        "key_hash = {:hash}",
        "",
        1,
        0,
        {
          hash: keyHash,
        },
      );
      if (apiKeys && apiKeys.length > 0) {
        var keyRecord = apiKeys[0];
        var perms = [];
        try {
          perms = JSON.parse(keyRecord.get("permissions") || "[]");
        } catch (_) {}
        for (var pi = 0; pi < perms.length; pi++) {
          if (perms[pi] === "calendar:read") {
            userId = keyRecord.get("user");
            break;
          }
        }
        if (userId) {
          keyRecord.set("last_used_at", new Date().toISOString());
          try {
            repository.save(keyRecord);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // Legacy fallback: support the old single api_key field on users
  if (!userId) {
    try {
      var legacyUsers = repository.findRecordsByFilter(
        "users",
        "api_key = {:apiKey}",
        "",
        1,
        0,
        {
          apiKey: rawKey,
        },
      );
      if (legacyUsers.length > 0) userId = legacyUsers[0].id;
    } catch (_) {}
  }
  if (!userId) {
    return e.json(401, {
      error: "Invalid API key",
    });
  }
  const subs = repository.findRecordsByFilter(
    "subscriptions",
    "user = {:userId} && calendar_projection_hidden = false && inactive = false",
    "",
    0,
    0,
    {
      userId: userId,
    },
  );

  // Build iCalendar output
  let ical = "BEGIN:VCALENDAR\r\n";
  ical += "VERSION:2.0\r\n";
  ical += "PRODID:-//Monline//Subscription Tracker//EN\r\n";
  ical += "CALSCALE:GREGORIAN\r\n";
  ical += "METHOD:PUBLISH\r\n";
  ical += "X-WR-CALNAME:Monline Subscriptions\r\n";
  for (const sub of subs) {
    const nextPayment = sub.get("next_payment");
    if (!nextPayment) continue;
    let currencySymbol = "$";
    try {
      const cur = repository.findRecordById("currencies", sub.get("currency"));
      currencySymbol = cur.get("symbol");
    } catch (_) {}
    ical += calendarUtils.buildIcalEvent({
      id: sub.id,
      name: sub.get("name"),
      record_type: recordTypes.normalizeRecordType(sub.get("record_type")),
      price: sub.get("price"),
      currencySymbol: currencySymbol,
      nextPayment: nextPayment,
    });
  }
  ical += "END:VCALENDAR\r\n";
  e.response.header().set("Content-Type", "text/calendar; charset=utf-8");
  e.response
    .header()
    .set("Content-Disposition", "attachment; filename=monline.ics");
  return e.string(200, ical);
});

// ================================================================
// ROUTE: Calendar Monthly Data
// ================================================================
routerAdd("GET", "/api/calendar/data", (e) => {
  const calendarUtils = require(domainPath + "/lib/pure/calendar-utils.js");
  if (!e.auth) throw new ForbiddenError("Authentication required");
  const userId = e.auth.id;
  const month =
    parseInt(e.request.url.query().get("month")) || new Date().getMonth() + 1;
  const year =
    parseInt(e.request.url.query().get("year")) || new Date().getFullYear();

  // Calculate date range for the month
  const range = calendarUtils.buildMonthRange(month, year);
  const subs = repository.findRecordsByFilter(
    "subscriptions",
    "user = {:userId} && calendar_projection_hidden = false && inactive = false && next_payment >= {:startDate} && next_payment < {:endDate}",
    "next_payment",
    0,
    0,
    {
      userId: userId,
      startDate: range.startDate,
      endDate: range.endDate,
    },
  );
  const events = [];
  for (const sub of subs) {
    let currencySymbol = "$";
    try {
      const cur = repository.findRecordById("currencies", sub.get("currency"));
      currencySymbol = cur.get("symbol");
    } catch (_) {}
    events.push({
      id: sub.id,
      name: sub.get("name"),
      price: sub.get("price"),
      currency: currencySymbol,
      date: sub.get("next_payment"),
      logo: sub.get("logo"),
    });
  }
  return e.json(200, {
    events: events,
    month: month,
    year: year,
  });
});

routerAdd(
  "POST",
  "/api/calendar/clear",
  (e) => {
    if (!e.auth || e.auth.collection().name !== "users")
      throw new UnauthorizedError();
    const body = e.requestInfo().body || {};
    if (body.confirmed !== true || body.scope !== "payments")
      return e.json(400, { error: "calendar_clear_invalid" });
    const result = repository.runInTransaction((tx) => {
      const payments = tx.findRecordsByFilter(
        "payment_records",
        "user = {:owner}",
        "",
        0,
        0,
        { owner: e.auth.id },
      );
      tx.connection
        .prepare(
          "UPDATE subscriptions SET calendar_projection_hidden = 1, calendar_history_recovery_passes = 2 WHERE user = ?",
        )
        .run(e.auth.id);
      for (const record of payments) tx.delete(record);
      return { subscriptions_deleted: 0, payments_deleted: payments.length };
    });
    return e.json(200, result);
  },
  apiLimits.bodyLimit(2048),
);
