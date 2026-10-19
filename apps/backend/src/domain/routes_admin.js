const {
  ForbiddenError,
  MailerMessage,
  Record,
  repository,
  routerAdd,
} = require("../runtime.cjs");
const domainPath = __dirname;
const { smtpTestMessage } = require("../email-templates.cjs");
// ================================================================
// ROUTE: Admin — SMTP Settings (GET)
// ================================================================
routerAdd("GET", "/api/admin/smtp", (e) => {
  if (!e.auth) throw new ForbiddenError("Authentication required");
  const allUsers = repository.findRecordsByFilter(
    "users",
    "",
    "+created",
    1,
    0,
  );
  if (allUsers.length === 0 || allUsers[0].id !== e.auth.id) {
    throw new ForbiddenError("Admin access required");
  }
  const s = repository.settings();
  return e.json(200, {
    enabled: s.smtp.enabled,
    host: s.smtp.host,
    port: s.smtp.port,
    username: s.smtp.username,
    tls: s.smtp.tls,
    authMethod: s.smtp.authMethod || "PLAIN",
    localName: s.smtp.localName || "",
    senderAddress: s.meta.senderAddress || "",
    senderName: s.meta.senderName || "",
    // Never expose the password — let the frontend know if one is set
    hasPassword: s.smtp.password !== "",
  });
});

// ================================================================
// ROUTE: Admin — SMTP Settings (POST)
// ================================================================
routerAdd("POST", "/api/admin/smtp", (e) => {
  if (!e.auth) throw new ForbiddenError("Authentication required");
  const allUsers = repository.findRecordsByFilter(
    "users",
    "",
    "+created",
    1,
    0,
  );
  if (allUsers.length === 0 || allUsers[0].id !== e.auth.id) {
    throw new ForbiddenError("Admin access required");
  }
  const data = e.requestInfo().body;
  const s = repository.settings();
  if (data.enabled !== undefined) s.smtp.enabled = !!data.enabled;
  if (data.host !== undefined) s.smtp.host = String(data.host || "");
  if (data.port !== undefined) s.smtp.port = parseInt(data.port) || 587;
  if (data.username !== undefined)
    s.smtp.username = String(data.username || "");
  if (data.password && String(data.password).trim() !== "") {
    s.smtp.password = String(data.password);
  }
  if (data.tls !== undefined) s.smtp.tls = !!data.tls;
  if (data.authMethod !== undefined)
    s.smtp.authMethod = String(data.authMethod || "PLAIN");
  if (data.localName !== undefined)
    s.smtp.localName = String(data.localName || "");
  if (data.senderAddress !== undefined)
    s.meta.senderAddress = String(data.senderAddress || "");
  if (data.senderName !== undefined)
    s.meta.senderName = String(data.senderName || "");
  try {
    repository.save(s);
    return e.json(200, {
      message: "SMTP settings saved",
    });
  } catch (err) {
    return e.json(500, {
      error: "Failed to save SMTP settings: " + err,
    });
  }
});

// ================================================================
// ROUTE: Admin — SMTP Test
// ================================================================
routerAdd("POST", "/api/admin/smtp/test", async (e) => {
  if (!e.auth) throw new ForbiddenError("Authentication required");
  const allUsers = repository.findRecordsByFilter(
    "users",
    "",
    "+created",
    1,
    0,
  );
  if (allUsers.length === 0 || allUsers[0].id !== e.auth.id) {
    throw new ForbiddenError("Admin access required");
  }
  try {
    const user = repository.findRecordById("users", e.auth.id);
    const toEmail = user.get("email");
    const s = repository.settings();
    const message = new MailerMessage(
      smtpTestMessage({
        language: user.getString("language"),
        from: {
          address: s.meta.senderAddress || "noreply@monline.app",
          name: s.meta.senderName || "Monline",
        },
        to: [
          {
            address: toEmail,
          },
        ],
      }),
    );
    await repository.newMailClient().send(message);
    return e.json(200, {
      message: "Test email sent to " + toEmail,
    });
  } catch (err) {
    return e.json(500, {
      error: "Failed to send test email: " + err,
    });
  }
});

// ================================================================
// ROUTE: Admin — Delete Unused Logos
// ================================================================
routerAdd("POST", "/api/admin/deleteunusedlogos", (e) => {
  if (!e.auth) throw new ForbiddenError("Authentication required");

  // Only first registered user is admin
  const allUsers = repository.findRecordsByFilter(
    "users",
    "",
    "+created",
    1,
    0,
  );
  if (allUsers.length === 0 || allUsers[0].id !== e.auth.id) {
    throw new ForbiddenError("Admin access required");
  }

  return e.json(200, {
    message: "Cleanup completed",
    deleted: repository.cleanupFiles(),
  });
});

// ================================================================
// ROUTE: Admin Settings — GET
// ================================================================
routerAdd("GET", "/api/admin/settings", (e) => {
  if (!e.auth) throw new ForbiddenError("Authentication required");
  const _adm = repository.findRecordsByFilter("users", "", "+created", 1, 0);
  if (_adm.length === 0 || _adm[0].id !== e.auth.id)
    throw new ForbiddenError("Admin access required");
  let record = null;
  try {
    const all = repository.findRecordsByFilter("admin_settings", "", "", 1, 0);
    if (all.length > 0) record = all[0];
  } catch (_) {}
  if (!record) return e.json(200, {});
  return e.json(200, {
    id: record.id,
    open_registrations: record.getBool("open_registrations"),
    disable_login: record.getBool("disable_login"),
    update_notification: record.getBool("update_notification"),
    require_email_validation: record.getBool("require_email_validation"),
    max_users: record.getFloat("max_users"),
    server_url: record.getString("server_url"),
    oidc_enabled: record.getBool("oidc_enabled"),
    oidc_provider_name: record.getString("oidc_provider_name"),
    oidc_client_id: record.getString("oidc_client_id"),
    oidc_client_secret_configured:
      record.getString("oidc_client_secret") !== "",
    oidc_issuer_url: record.getString("oidc_issuer_url"),
    oidc_redirect_url: record.getString("oidc_redirect_url"),
    oidc_scopes: record.getString("oidc_scopes"),
    latest_version: record.getString("latest_version"),
  });
});

// ================================================================
// ROUTE: Admin Settings — PATCH
// ================================================================
routerAdd("PATCH", "/api/admin/settings", (e) => {
  if (!e.auth) throw new ForbiddenError("Authentication required");
  const _adm = repository.findRecordsByFilter("users", "", "+created", 1, 0);
  if (_adm.length === 0 || _adm[0].id !== e.auth.id)
    throw new ForbiddenError("Admin access required");
  const data = e.requestInfo().body;
  let record = null;
  try {
    const all = repository.findRecordsByFilter("admin_settings", "", "", 1, 0);
    if (all.length > 0) record = all[0];
  } catch (_) {}
  if (!record) {
    const col = repository.findCollectionByNameOrId("admin_settings");
    record = new Record(col);
  }
  const boolFields = [
    "open_registrations",
    "disable_login",
    "update_notification",
    "require_email_validation",
    "oidc_enabled",
  ];
  for (const f of boolFields) {
    if (data[f] !== undefined) record.set(f, !!data[f]);
  }
  const textFields = [
    "server_url",
    "oidc_provider_name",
    "oidc_client_id",
    "oidc_issuer_url",
    "oidc_redirect_url",
    "oidc_scopes",
    "latest_version",
  ];
  for (const f of textFields) {
    if (data[f] !== undefined) record.set(f, String(data[f] || ""));
  }
  if (data.oidc_client_secret !== undefined) {
    const nextSecret = String(data.oidc_client_secret || "");
    if (nextSecret !== "" || data.oidc_client_secret_configured === false) {
      record.set("oidc_client_secret", nextSecret);
    }
  }
  if (data.max_users !== undefined)
    record.set("max_users", Number(data.max_users) || 0);
  repository.save(record);
  return e.json(200, {
    message: "Settings saved",
  });
});
