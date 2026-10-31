const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const path = require("node:path");
const { BadRequestError, ForbiddenError, HttpError } = require("./errors.cjs");
const { publicUrl } = require("./public-url.cjs");
const drive = require("./google-drive-export.cjs");
const smb = require("./smb-export.cjs");
const PREFIX = "spreadsheet-export:";
const INTERVALS = [1, 6, 12, 24, 168];
const DRIVE_EXPORTS_ENABLED = false;

function registerSpreadsheetSchedules(app, repository, auth) {
  const active = new Set(), pending = new Map();
  repository.spreadsheetExportsActive = active;
  const load = (key, fallback = null) => {
    const row = repository.connection.prepare("SELECT value FROM monline_meta WHERE key=?").get(key);
    return row ? JSON.parse(row.value) : fallback;
  };
  const store = (key, value) => repository.connection.prepare(
    "INSERT OR REPLACE INTO monline_meta(key,value) VALUES (?,?)").run(key, JSON.stringify(value));
  const jobKey = (owner, target) => PREFIX + owner + ":" + target;
  const defaultJob = () => ({ enabled: false, interval_hours: 24, language: "tr", theme: "dark",
    next_run: null, last_run: null, last_success: null, last_error: "", file_id: "", refresh_token: "" });
  const job = (owner, target) => ({ ...defaultJob(), ...load(jobKey(owner, target), {}) });
  const checkedTarget = (target) => {
    if (!["nas", "drive"].includes(target)) throw new BadRequestError("spreadsheet_schedule_invalid");
    return target;
  };
  const requireAvailable = (target) => {
    if (target === "drive" && !DRIVE_EXPORTS_ENABLED)
      throw new HttpError(503, "spreadsheet_schedule_coming_soon");
  };
  const unlocked = (owner, target) => {
    if (active.has("configuration") || active.has(jobKey(owner, target)) || repository.databaseOperation ||
        (target === "nas" && [...active].some((key) => key.endsWith(":nas"))))
      throw new HttpError(409, "spreadsheet_schedule_busy");
  };
  const encryptionKey = () => {
    const key = load("spreadsheet-export-key");
    if (key) return Buffer.from(key, "base64");
    const generated = crypto.randomBytes(32);
    store("spreadsheet-export-key", generated.toString("base64"));
    return generated;
  };
  const seal = (token) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const bytes = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
  };
  const unseal = (token) => {
    const bytes = Buffer.from(token, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
  };
  const integrationSettings = () => load("spreadsheet-integrations", {});
  const nasDirectory = () => process.env.MONLINE_EXPORT_DIR || integrationSettings().nas_directory || "";
  const nasMode = () => integrationSettings().nas_mode ||
    (nasDirectory() ? "directory" : "smb");
  const smbConfig = () => {
    const saved = integrationSettings();
    return { host: saved.smb_host || "", share: saved.smb_share || "", folder: saved.smb_folder || "",
      username: saved.smb_username || "", domain: saved.smb_domain || "",
      password: saved.smb_password ? unseal(saved.smb_password) : "" };
  };
  const nasConfigured = () => {
    const saved = integrationSettings();
    return nasMode() === "directory" ? !!nasDirectory() :
      !!(saved.smb_host && saved.smb_share && saved.smb_username && saved.smb_password);
  };
  const googleConfig = () => {
    const saved = integrationSettings();
    return {
      client_id: process.env.MONLINE_GOOGLE_CLIENT_ID || saved.google_client_id || "",
      client_secret: process.env.MONLINE_GOOGLE_CLIENT_SECRET ||
        (saved.google_client_secret ? unseal(saved.google_client_secret) : ""),
    };
  };
  const callbackUrl = () => publicUrl(repository, "/api/spreadsheet-schedules/drive/callback");
  const driveConfigured = () => {
    const url = callbackUrl();
    const saved = integrationSettings();
    return !!((process.env.MONLINE_GOOGLE_CLIENT_ID || saved.google_client_id) &&
      (process.env.MONLINE_GOOGLE_CLIENT_SECRET || saved.google_client_secret) &&
      url && (url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)));
  };
  const ready = (value, target) => target === "nas"
    ? nasConfigured()
    : DRIVE_EXPORTS_ENABLED && driveConfigured() && !!value.refresh_token;
  const visible = (owner, target) => {
    const value = job(owner, target);
    const { refresh_token, file_id, ...safe } = value;
    const comingSoon = target === "drive" && !DRIVE_EXPORTS_ENABLED;
    return { ...safe, target, coming_soon: comingSoon,
      enabled: comingSoon ? false : value.enabled, next_run: comingSoon ? null : value.next_run,
      connected: target === "drive" && !!refresh_token,
      configured: target === "nas" ? nasConfigured() : driveConfigured(),
      running: active.has(jobKey(owner, target)),
      file_name: "Monline.xlsx" };
  };
  const status = (owner) => ({
    jobs: ["nas", "drive"].map((target) => visible(owner, target)),
    callback_url: callbackUrl()?.href || "",
  });
  async function writeNas(owner, bytes) {
    if (nasMode() === "smb") return smb.writeSmb(smbConfig(), owner, bytes);
    // The mount must already exist: never silently create a missing NAS mount.
    const configured = nasDirectory();
    if (!configured) throw new Error("spreadsheet_schedule_nas_config");
    const root = await fs.realpath(configured);
    if (!(await fs.stat(root)).isDirectory()) throw new Error("spreadsheet_schedule_nas_failed");
    if (!/^[a-zA-Z0-9_-]+$/.test(owner)) throw new Error("spreadsheet_schedule_invalid");
    const directory = root;
    const filename = path.join(directory, "Monline.xlsx");
    const temporary = path.join(directory, "." + crypto.randomUUID() + ".tmp");
    try {
      await fs.writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
      await fs.rename(temporary, filename);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }
  async function run(owner, target) {
    requireAvailable(target);
    unlocked(owner, target);
    const value = job(owner, target), key = jobKey(owner, target);
    const user = repository.findRecordById("users", owner);
    if (user.getBool("disabled")) throw new BadRequestError("spreadsheet_schedule_invalid");
    active.add(key);
    const started = new Date().toISOString();
    try {
      if (!ready(value, target)) throw new Error(target === "nas" ? "spreadsheet_schedule_nas_config"
        : driveConfigured() ? "spreadsheet_schedule_reconnect" : "spreadsheet_schedule_drive_config");
      const snapshot = repository.runInTransaction((tx) =>
        require("./domain/lib/spreadsheet-export.js").spreadsheetSnapshot(tx, owner));
      const bytes = await require("./spreadsheet-renderer.cjs").renderSpreadsheet(
        snapshot, value.language, value.theme);
      if (repository.databaseOperation) throw new Error("spreadsheet_schedule_busy");
      if (target === "nas") await writeNas(owner, bytes);
      else {
        let installation = load("spreadsheet-export-installation");
        if (!installation) {
          installation = crypto.randomUUID();
          store("spreadsheet-export-installation", installation);
        }
        await drive.uploadSpreadsheet(bytes, unseal(value.refresh_token), value.file_id,
          installation + "-" + owner, (id) => { value.file_id = id; store(key, value); }, googleConfig());
      }
      value.last_run = started;
      value.last_success = new Date().toISOString();
      value.last_error = "";
      value.next_run = value.enabled
        ? new Date(Date.now() + value.interval_hours * 3600000).toISOString() : null;
      store(key, value);
    } catch (error) {
      value.last_run = started;
      const known = ["spreadsheet_schedule_reconnect", "spreadsheet_schedule_drive_failed",
        "spreadsheet_schedule_nas_config", "spreadsheet_schedule_drive_config",
        "spreadsheet_schedule_smb_unavailable", "spreadsheet_schedule_smb_failed",
        "spreadsheet_schedule_smb_invalid", "spreadsheet_schedule_smb_auth_failed",
        "spreadsheet_schedule_smb_timeout", "spreadsheet_schedule_smb_session_conflict",
        "spreadsheet_schedule_smb_permission", "spreadsheet_schedule_smb_network",
        "spreadsheet_schedule_smb_share_missing", "spreadsheet_schedule_smb_folder_missing",
        "spreadsheet_schedule_render_failed", "spreadsheet_schedule_busy"];
      value.last_error = known.includes(error.message) ? error.message
        : target === "nas" ? "spreadsheet_schedule_nas_failed" : "spreadsheet_schedule_drive_failed";
      if (value.last_error === "spreadsheet_schedule_reconnect") value.enabled = false;
      // A failed target retries independently; a NAS failure never blocks Drive.
      value.next_run = value.enabled ? new Date(Date.now() + 15 * 60000).toISOString() : null;
      store(key, value);
      throw new BadRequestError(value.last_error);
    } finally { active.delete(key); }
    return visible(owner, target);
  }
  const route = (method, url, handler) => app[method](url, async (req, res, next) => {
    try { await handler(req, res, auth.requireUser(req)); } catch (error) { next(error); }
  });
  const configurationStatus = () => {
    const saved = integrationSettings();
    return {
      nas_directory: nasDirectory(),
      nas_mode: nasMode(),
      smb_host: saved.smb_host || "", smb_share: saved.smb_share || "", smb_folder: saved.smb_folder || "",
      smb_username: saved.smb_username || "", smb_domain: saved.smb_domain || "",
      smb_password_configured: !!saved.smb_password,
      google_client_id: process.env.MONLINE_GOOGLE_CLIENT_ID || saved.google_client_id || "",
      google_client_secret_configured: !!(process.env.MONLINE_GOOGLE_CLIENT_SECRET || saved.google_client_secret),
      public_url: publicUrl(repository)?.href ||
        repository.findRecordsByFilter("admin_settings", "", "", 1)[0]?.getString("server_url") || "",
      environment: {
        nas_directory: !!process.env.MONLINE_EXPORT_DIR,
        google_client_id: !!process.env.MONLINE_GOOGLE_CLIENT_ID,
        google_client_secret: !!process.env.MONLINE_GOOGLE_CLIENT_SECRET,
        public_url: !!process.env.MONLINE_PUBLIC_URL,
      },
    };
  };
  route("get", "/api/spreadsheet-integrations", (req, res, user) => {
    if (!auth.isAdmin(user)) throw new ForbiddenError("admin_config_required");
    res.json(configurationStatus());
  });
  route("put", "/api/spreadsheet-integrations/:target", async (req, res, user) => {
    if (!auth.isAdmin(user)) throw new ForbiddenError("admin_config_required");
    const target = checkedTarget(req.params.target), body = req.body || {};
    requireAvailable(target);
    if (active.size || repository.databaseOperation) throw new HttpError(409, "spreadsheet_schedule_busy");
    active.add("configuration");
    try {
      const value = integrationSettings(), environment = configurationStatus().environment;
      const readText = (name, limit) => {
        if (typeof body[name] !== "string" || body[name].length > limit || /[\r\n\0]/.test(body[name]))
          throw new BadRequestError("spreadsheet_schedule_invalid");
        return body[name].trim();
      };
      if (target === "nas") {
        if (!["directory", "smb"].includes(body.nas_mode)) throw new BadRequestError("spreadsheet_schedule_invalid");
        value.nas_mode = body.nas_mode;
        if (body.nas_mode === "smb") {
          let next;
          try {
            next = smb.validateSmbConfig({
              host: readText("smb_host", 253), share: readText("smb_share", 255),
              folder: readText("smb_folder", 1024), username: readText("smb_username", 256),
              domain: readText("smb_domain", 256),
              password: typeof body.smb_password === "string" && body.smb_password !== ""
                ? body.smb_password : value.smb_password ? unseal(value.smb_password) : "",
            });
          } catch { throw new BadRequestError("spreadsheet_schedule_smb_invalid"); }
          Object.assign(value, { smb_host: next.host, smb_share: next.share, smb_folder: next.folder,
            smb_username: next.username, smb_domain: next.domain, smb_password: seal(next.password) });
          store("spreadsheet-integrations", value);
          return res.json(configurationStatus());
        }
        const directory = environment.nas_directory ? nasDirectory() : readText("nas_directory", 4096);
        if (directory) {
          if (!path.isAbsolute(directory)) throw new BadRequestError("spreadsheet_schedule_nas_path");
          try {
            if (!(await fs.stat(directory)).isDirectory()) throw new Error("Not a directory");
            await fs.access(directory, constants.W_OK);
          } catch { throw new BadRequestError("spreadsheet_schedule_nas_failed"); }
        }
        if (!environment.nas_directory) value.nas_directory = directory;
        repository.runInTransaction(() => {
          store("spreadsheet-integrations", value);
          if (!directory) {
            const entries = repository.connection.prepare(
              "SELECT key,value FROM monline_meta WHERE key LIKE ?").all(PREFIX + "%:nas");
            for (const entry of entries) {
              const item = JSON.parse(entry.value);
              Object.assign(item, { enabled: false, next_run: null, last_error: "" });
              store(entry.key, item);
            }
          }
        });
      } else {
        const previous = googleConfig();
        if (!environment.google_client_id) value.google_client_id = readText("google_client_id", 1024);
        if (!environment.google_client_secret) {
          const secret = readText("google_client_secret", 4096);
          if (secret) value.google_client_secret = seal(secret);
        }
        let serverUrl;
        if (!environment.public_url) {
          try {
            serverUrl = new URL(readText("public_url", 4096));
            if (!(serverUrl.protocol === "https:" ||
                  (serverUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(serverUrl.hostname))) || serverUrl.username ||
                serverUrl.password || serverUrl.search || serverUrl.hash) throw new Error("Invalid URL");
          } catch { throw new BadRequestError("spreadsheet_schedule_public_url_invalid"); }
        }
        if (!(process.env.MONLINE_GOOGLE_CLIENT_ID || value.google_client_id) ||
            !(process.env.MONLINE_GOOGLE_CLIENT_SECRET || value.google_client_secret))
          throw new BadRequestError("spreadsheet_schedule_drive_config");
        repository.runInTransaction(() => {
          store("spreadsheet-integrations", value);
          if (serverUrl) {
            const settings = repository.findRecordsByFilter("admin_settings", "", "", 1)[0];
            settings.set("server_url", serverUrl.href.replace(/\/$/, ""));
            repository.save(settings);
          }
          const next = googleConfig();
          if (previous.client_id !== next.client_id || previous.client_secret !== next.client_secret) {
            // OAuth grants belong to the configured client; reconnect after changing it.
            const entries = repository.connection.prepare(
              "SELECT key,value FROM monline_meta WHERE key LIKE ?").all(PREFIX + "%:drive");
            for (const entry of entries) {
              const item = JSON.parse(entry.value);
              Object.assign(item, { enabled: false, next_run: null, refresh_token: "",
                last_error: "spreadsheet_schedule_reconnect" });
              store(entry.key, item);
            }
          }
        });
        pending.clear();
      }
      res.json(configurationStatus());
    } finally { active.delete("configuration"); }
  });
  route("post", "/api/spreadsheet-integrations/nas/probe", async (req, res, user) => {
    if (!auth.isAdmin(user)) throw new ForbiddenError("admin_config_required");
    if (active.size || repository.databaseOperation) throw new HttpError(409, "spreadsheet_schedule_busy");
    active.add("configuration");
    try {
      if (nasMode() === "smb") await smb.probeSmb(smbConfig());
      else {
        const directory = nasDirectory();
        if (!directory || !(await fs.stat(directory)).isDirectory())
          throw new Error("spreadsheet_schedule_nas_failed");
        await fs.access(directory, constants.W_OK);
      }
      res.json({ ok: true });
    } catch (error) {
      throw new BadRequestError(error.message.startsWith("spreadsheet_schedule_")
        ? error.message : "spreadsheet_schedule_nas_failed");
    } finally { active.delete("configuration"); }
  });
  route("get", "/api/spreadsheet-schedules", (req, res, user) => res.json(status(user.id)));
  route("put", "/api/spreadsheet-schedules/:target", (req, res, user) => {
    const target = checkedTarget(req.params.target);
    requireAvailable(target);
    unlocked(user.id, target);
    const body = req.body || {}, value = job(user.id, target);
    if (typeof body.enabled !== "boolean" || !INTERVALS.includes(body.interval_hours) ||
        !["tr", "en", "de", "bg"].includes(body.language) || !["dark", "light"].includes(body.theme))
      throw new BadRequestError("spreadsheet_schedule_invalid");
    if (body.enabled && !ready(value, target))
      throw new BadRequestError(target === "nas" ? "spreadsheet_schedule_nas_config" : "spreadsheet_schedule_reconnect");
    const restart = body.enabled && (!value.enabled || value.interval_hours !== body.interval_hours);
    Object.assign(value, { enabled: body.enabled, interval_hours: body.interval_hours,
      language: body.language, theme: body.theme });
    value.next_run = !value.enabled ? null : restart || !value.next_run
      ? new Date(Date.now() + value.interval_hours * 3600000).toISOString() : value.next_run;
    store(jobKey(user.id, target), value);
    res.json(visible(user.id, target));
  });
  const manualRuns = new Map();
  route("post", "/api/spreadsheet-schedules/:target/run", async (req, res, user) => {
    const target = checkedTarget(req.params.target), key = jobKey(user.id, target);
    requireAvailable(target);
    unlocked(user.id, target);
    if ((manualRuns.get(key) || 0) > Date.now()) throw new HttpError(429, "spreadsheet_schedule_wait");
    manualRuns.set(key, Date.now() + 60000);
    for (const [id, until] of manualRuns) if (until < Date.now()) manualRuns.delete(id);
    res.json(await run(user.id, target));
  });
  route("post", "/api/spreadsheet-schedules/drive/connect", (req, res, user) => {
    requireAvailable("drive");
    unlocked(user.id, "drive");
    if (!driveConfigured()) throw new BadRequestError("spreadsheet_schedule_drive_config");
    for (const [id, item] of pending) if (item.expires < Date.now()) pending.delete(id);
    for (const [id, item] of pending) if (item.owner === user.id) pending.delete(id);
    if (pending.size >= 1000) throw new HttpError(429, "spreadsheet_schedule_wait");
    const state = crypto.randomBytes(32).toString("base64url");
    const nonce = crypto.randomBytes(32).toString("base64url");
    const verifier = crypto.randomBytes(32).toString("base64url");
    const redirect = callbackUrl();
    pending.set(state, { owner: user.id, session: req.sessionToken, nonce, verifier,
      redirect: redirect.href, expires: Date.now() + 600000 });
    res.cookie("monline_drive_oauth", nonce, { httpOnly: true, secure: redirect.protocol === "https:",
      sameSite: "lax", path: redirect.pathname, maxAge: 600000 });
    res.json({ url: drive.authorizationUrl(redirect.href, state, verifier, googleConfig()) });
  });
  app.get("/api/spreadsheet-schedules/drive/callback", async (req, res) => {
    const state = String(req.query.state || ""), entry = pending.get(state);
    pending.delete(state);
    const redirect = publicUrl(repository, "/settings");
    if (!redirect) return res.status(400).send("Server URL is not configured.");
    redirect.searchParams.set("tab", "data_transfer");
    let result = "failed";
    try {
      requireAvailable("drive");
      const cookie = String(req.headers.cookie || "").split(";")
        .map((part) => part.trim()).find((part) => part.startsWith("monline_drive_oauth="))?.split("=")[1];
      if (!entry || entry.expires < Date.now() || cookie !== entry.nonce ||
          typeof req.query.code !== "string" || req.query.error) throw new Error("Invalid OAuth callback");
      if (auth.resolve(entry.session) !== entry.owner) throw new Error("Expired session");
      repository.findRecordById("users", entry.owner);
      unlocked(entry.owner, "drive");
      active.add(jobKey(entry.owner, "drive"));
      try {
        const token = await drive.exchangeCode(req.query.code, entry.redirect, entry.verifier, googleConfig());
        const value = job(entry.owner, "drive");
        value.refresh_token = seal(token);
        value.last_error = "";
        store(jobKey(entry.owner, "drive"), value);
        result = "connected";
      } finally { active.delete(jobKey(entry.owner, "drive")); }
    } catch { /* Never expose OAuth codes, tokens or provider responses. */ }
    res.clearCookie("monline_drive_oauth", { path: callbackUrl()?.pathname || req.path });
    redirect.hash = "drive=" + result;
    res.redirect(303, redirect.href);
  });
  route("delete", "/api/spreadsheet-schedules/drive/connection", async (req, res, user) => {
    requireAvailable("drive");
    unlocked(user.id, "drive");
    const value = job(user.id, "drive"), key = jobKey(user.id, "drive");
    active.add(key);
    try {
      // Keep the connection if revocation fails, so the user can retry it.
      if (value.refresh_token) await drive.revoke(unseal(value.refresh_token));
      value.refresh_token = "";
      value.enabled = false;
      value.next_run = null;
      value.last_error = "";
      store(key, value);
      res.json(visible(user.id, "drive"));
    } catch { throw new BadRequestError("spreadsheet_schedule_drive_failed"); }
    finally { active.delete(key); }
  });
  require("./runtime.cjs").onRecordDelete((event) => {
    if (["nas", "drive"].some((target) => active.has(jobKey(event.record.id, target))))
      throw new HttpError(409, "spreadsheet_schedule_busy");
    event.next();
    for (const target of ["nas", "drive"])
      repository.connection.prepare("DELETE FROM monline_meta WHERE key=?").run(jobKey(event.record.id, target));
    for (const [id, item] of pending) if (item.owner === event.record.id) pending.delete(id);
  }, "users");
  require("./runtime.cjs").cronAdd("spreadsheetExports", "* * * * *", async () => {
    if (repository.databaseOperation || active.has("configuration")) return;
    const entries = repository.connection.prepare(
      "SELECT key,value FROM monline_meta WHERE key LIKE ?").all(PREFIX + "%");
    for (const entry of entries) {
      const [, owner, target] = entry.key.split(":");
      if (target === "drive" && !DRIVE_EXPORTS_ENABLED) continue;
      const value = JSON.parse(entry.value);
      if (!value.enabled || !value.next_run || new Date(value.next_run).getTime() > Date.now()) continue;
      if (active.has(entry.key)) continue;
      try { await run(owner, checkedTarget(target)); } catch { /* Status is visible in the account UI. */ }
    }
  });
}
module.exports = { registerSpreadsheetSchedules };
