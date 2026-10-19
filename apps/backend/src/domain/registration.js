const {
  ForbiddenError,
  onRecordCreateRequest,
  repository,
  routerAdd,
} = require("../runtime.cjs");
const domainPath = __dirname;

// ================================================================
// ROUTE: GET /api/auth/registration-status — public.
// Reveals only whether a signup would be accepted. The thresholds
// themselves stay admin-only; a caller learns nothing it could not
// already discover by attempting to register.
// ================================================================
routerAdd("GET", "/api/auth/registration-status", (e) => {
  const policy = require(domainPath + "/lib/pure/registration-policy.js");
  e.response
    .header()
    .set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  e.response.header().set("Pragma", "no-cache");
  e.response.header().set("Expires", "0");
  let settings = {
    openRegistrations: false,
    maxUsers: 0,
    disableLogin: false,
  };
  try {
    const rows = repository.findRecordsByFilter("admin_settings", "", "", 1, 0);
    if (rows.length > 0) {
      settings = {
        openRegistrations: rows[0].getBool("open_registrations"),
        maxUsers: rows[0].getFloat("max_users"),
        disableLogin: rows[0].getBool("disable_login"),
      };
    }
  } catch (_) {}
  let userCount = 0;
  try {
    userCount = repository.countRecords("users");
  } catch (_) {}
  return e.json(200, {
    open: policy.isRegistrationOpen(settings, userCount),
  });
});

// ================================================================
// GUARD: users create requests.
//
// Both self-registration and the admin "add user" modal post to
// pb.collection("users").create(), so the guard has to tell them apart:
// an authenticated request from the first registered user is an admin
// adding someone deliberately and is always allowed. Everything else is
// a public signup and answers to the policy.
// ================================================================
onRecordCreateRequest((e) => {
  const policy = require(domainPath + "/lib/pure/registration-policy.js");
  let userCount = 0;
  try {
    userCount = repository.countRecords("users");
  } catch (_) {}
  if (policy.isBootstrap(userCount)) return e.next();
  if (e.auth) {
    const admins = repository.findRecordsByFilter(
      "users",
      "",
      "+created",
      1,
      0,
    );
    if (admins.length > 0 && admins[0].id === e.auth.id) return e.next();
  }
  let settings = {
    openRegistrations: false,
    maxUsers: 0,
    disableLogin: false,
  };
  try {
    const rows = repository.findRecordsByFilter("admin_settings", "", "", 1, 0);
    if (rows.length > 0) {
      settings = {
        openRegistrations: rows[0].getBool("open_registrations"),
        maxUsers: rows[0].getFloat("max_users"),
        disableLogin: rows[0].getBool("disable_login"),
      };
    }
  } catch (_) {}
  const rejection = policy.registrationRejection(settings, userCount);
  if (rejection) throw new ForbiddenError(rejection);
  return e.next();
}, "users");
