const bcrypt = require("bcryptjs");
const { DataRecord } = require("./storage.cjs");
const { validatePassword } = require("./auth.cjs");
const { BadRequestError, HttpError } = require("./errors.cjs");
const { smtpTestMessage } = require("./email-templates.cjs");
const { isValidEmail } = require("./email.cjs");

const LANGUAGES = new Set([
  "en",
  "tr",
  "de",
  "pt_BR",
  "es",
  "fr",
  "it",
  "nl",
  "pl",
  "ru",
  "zh_CN",
  "ja",
  "ko",
  "uk",
  "cs",
  "da",
  "bg",
]);
const CURRENCIES = new Set([
  "TRY",
  "USD",
  "EUR",
  "GBP",
  "BRL",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "HKD",
]);

function invalid(field) {
  throw new BadRequestError("setup_invalid", {
    [field]: { message: "Invalid value" },
  });
}

function validateSmtp(smtp) {
  if (!smtp || typeof smtp.enabled !== "boolean") invalid("smtpEnabled");
  if (!smtp.enabled) return;
  if (
    typeof smtp.host !== "string" ||
    !smtp.host.trim() ||
    smtp.host.length > 253 ||
    /[\s/\\\x00-\x1f]/.test(smtp.host)
  )
    invalid("smtpHost");
  if (!Number.isInteger(smtp.port) || smtp.port < 1 || smtp.port > 65535)
    invalid("smtpPort");
  for (const field of ["username", "password", "senderName", "senderAddress"])
    if (
      typeof smtp[field] !== "string" ||
      smtp[field].length > 1024 ||
      /[\x00\r\n]/.test(smtp[field])
    )
      invalid("smtp" + field[0].toUpperCase() + field.slice(1));
  if (!isValidEmail(smtp.senderAddress) || typeof smtp.tls !== "boolean")
    invalid("smtpSenderAddress");
}

function validate(body) {
  if (!body || typeof body !== "object") invalid("username");
  for (const field of [
    "username",
    "email",
    "password",
    "passwordConfirm",
    "language",
    "currency",
    "serverUrl",
  ])
    if (typeof body[field] !== "string") invalid(field);
  const username = body.username.trim();
  const email = body.email.trim().toLowerCase();
  if (
    username.length < 3 ||
    username.length > 50 ||
    /[\x00-\x1f]/.test(username)
  )
    invalid("username");
  if (!isValidEmail(email)) invalid("email");
  validatePassword(body.password);
  if (body.password !== body.passwordConfirm) invalid("passwordConfirm");
  if (!LANGUAGES.has(body.language)) invalid("language");
  if (!CURRENCIES.has(body.currency)) invalid("currency");
  if (
    typeof body.budget !== "number" ||
    !Number.isFinite(body.budget) ||
    body.budget < 0 ||
    body.budget > 1e12
  )
    invalid("budget");
  if (![0, 1, 2].includes(body.darkThemeMode)) invalid("darkThemeMode");
  if (typeof body.openRegistrations !== "boolean") invalid("openRegistrations");
  let url;
  try {
    url = new URL(body.serverUrl);
  } catch {
    invalid("serverUrl");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    invalid("serverUrl");
  validateSmtp(body.smtp);
  return { ...body, username, email, serverUrl: url.origin };
}

function registerSetupApi(app, repository, auth) {
  let smtpTesting = false;
  let smtpAttempts = [];
  app.post("/api/auth/setup/smtp-test", async (req, res) => {
    if (repository.countRecords("users") > 0)
      throw new HttpError(409, "setup_already_complete");
    if (repository.databaseOperation)
      throw new HttpError(409, "setup_restore_busy");
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!isValidEmail(email)) invalid("email");
    if (req.body.language !== undefined && !LANGUAGES.has(req.body.language))
      invalid("language");
    validateSmtp(req.body?.smtp);
    if (!req.body.smtp.enabled) invalid("smtpEnabled");
    const now = Date.now();
    smtpAttempts = smtpAttempts.filter((time) => now - time < 60_000);
    if (smtpTesting || smtpAttempts.length >= 5) {
      res.set("Retry-After", "60");
      throw new HttpError(429, "setup_smtp_test_rate_limit");
    }
    smtpAttempts.push(now);
    smtpTesting = true;
    const smtp = req.body.smtp;
    try {
      // Use the form values without persisting credentials or creating an account.
      await repository
        .newMailClient({
          enabled: true,
          host: smtp.host.trim(),
          port: smtp.port,
          username: smtp.username,
          password: smtp.password,
          tls: smtp.tls,
          authMethod: "PLAIN",
        })
        .send(
          smtpTestMessage({
            from: {
              address: smtp.senderAddress,
              name: smtp.senderName.trim() || "Monline",
            },
            to: [{ address: email }],
            language: req.body.language,
          }),
        );
      res.json({ message: "setup_smtp_test_success" });
    } catch (error) {
      // Never return provider responses: they can include credentials or private hosts.
      const message =
        error.code === "EAUTH"
          ? "setup_smtp_test_auth_failed"
          : ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS"].includes(error.code)
            ? "setup_smtp_test_connection_failed"
            : "setup_smtp_test_failed";
      throw new HttpError(502, message);
    } finally {
      smtpTesting = false;
    }
  });
  app.post("/api/auth/setup", async (req, res) => {
    if (repository.countRecords("users") > 0)
      throw new HttpError(409, "setup_already_complete");
    if (repository.databaseOperation)
      throw new HttpError(409, "setup_restore_busy");
    const data = validate(req.body);
    const password = await bcrypt.hash(data.password, 12);
    let token;
    const id = repository.runInTransaction(() => {
      // Hashing yields; recheck inside the transaction so only one request can
      // create the initial account and commit its configuration.
      if (repository.countRecords("users") > 0)
        throw new HttpError(409, "setup_already_complete");
      if (repository.databaseOperation)
        throw new HttpError(409, "setup_restore_busy");
      const user = new DataRecord(repository.findCollectionByNameOrId("users"));
      for (const [key, value] of Object.entries({
        username: data.username,
        name: data.username,
        email: data.email,
        password,
        verified: true,
        language: data.language,
        budget: data.budget,
        color_theme: "monline",
        dark_theme_mode: data.darkThemeMode,
        sort_order: "name",
        sort_direction: "asc",
        remove_background: false,
      }))
        user.set(key, value);
      for (const flag of [
        "show_logo_on_card",
        "show_price_on_card",
        "show_cycle_on_card",
        "show_payment_method_on_card",
        "show_category_on_card",
        "show_payer_on_card",
        "show_next_payment_on_card",
        "monthly_price",
        "payment_tracking",
        "convert_currency",
        "subscription_progress",
        "disabled_to_bottom",
        "show_original_price",
      ])
        user.set(flag, true);
      repository.save(user);
      const currencies = repository.findRecordsByFilter(
        "currencies",
        "user = {:u}",
        "",
        0,
        0,
        { u: user.id },
      );
      let main;
      for (const currency of currencies) {
        const selected = currency.getString("code") === data.currency;
        currency.set("is_main", selected);
        repository.save(currency);
        if (selected) main = currency.id;
      }
      if (!main) throw new BadRequestError("setup_invalid");
      // The account creation hook updates this record with its normal defaults.
      const savedUser = repository.findRecordById("users", user.id);
      savedUser.set("main_currency", main);
      repository.save(savedUser);
      const settings = repository.findRecordsByFilter(
        "admin_settings",
        "",
        "",
        1,
      )[0];
      settings.set("open_registrations", data.openRegistrations);
      settings.set("disable_login", false);
      settings.set("server_url", data.serverUrl);
      settings.set("require_email_validation", false);
      repository.save(settings);
      const configuration = repository.settings();
      configuration.smtp.enabled = data.smtp.enabled;
      if (data.smtp.enabled) {
        configuration.smtp = {
          enabled: true,
          host: data.smtp.host.trim(),
          port: data.smtp.port,
          username: data.smtp.username,
          password: data.smtp.password,
          tls: data.smtp.tls,
          authMethod: "PLAIN",
          localName: "",
        };
        configuration.meta.senderAddress = data.smtp.senderAddress.trim();
        configuration.meta.senderName =
          data.smtp.senderName.trim() || "Monline";
        const notification = new DataRecord(
          repository.findCollectionByNameOrId("notifications_config"),
        );
        for (const [key, value] of Object.entries({
          user: user.id,
          email_enabled: true,
          email_to: data.email,
          reminders: [{ days: 3, hour: 8 }],
        }))
          notification.set(key, value);
        repository.save(notification);
      }
      repository.save(configuration);
      token = auth.issue(user.id);
      return user.id;
    });
    auth.setSessionCookie(req, res, token);
    res.status(201).json({
      token,
      record: repository.findRecordById("users", id).publicExport(),
    });
  });
}

module.exports = { registerSetupApi };
