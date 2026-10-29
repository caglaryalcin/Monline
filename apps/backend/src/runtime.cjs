const crypto = require("node:crypto");
const { DataRecord } = require("./storage.cjs");
const errors = require("./errors.cjs");
const runtime = module.exports;
const security = {
  randomString: (length) =>
    security.randomStringWithAlphabet(
      length,
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    ),
  randomStringWithAlphabet: (length, alphabet) =>
    Array.from(
      { length },
      () => alphabet[crypto.randomInt(alphabet.length)],
    ).join(""),
  sha256: (value) =>
    crypto.createHash("sha256").update(String(value)).digest("hex"),
};
async function send(options) {
  const controller = new AbortController(),
    timer = setTimeout(
      () => controller.abort(),
      (options.timeout || 12) * 1000,
    );
  try {
    const response = await fetch(options.url, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body,
      redirect: options.redirect || "follow",
      signal: controller.signal,
    });
    const chunks = [];
    let size = 0;
    if (response.body)
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > (options.maxBytes || 8 * 1024 * 1024))
          throw new Error("Remote response too large");
        chunks.push(chunk);
      }
    const bytes = Buffer.concat(chunks),
      raw = bytes.toString("utf8");
    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {}
    if (
      response.status >= 400 &&
      options.method &&
      options.method !== "GET" &&
      options.method !== "HEAD"
    )
      throw new Error("Remote service returned HTTP " + response.status);
    return {
      statusCode: response.status,
      raw,
      json,
      bytes,
      headers: response.headers,
    };
  } finally {
    clearTimeout(timer);
  }
}
const files = {
  fileFromBytes: (bytes, name) => ({ bytes: Buffer.from(bytes), name }),
  fileFromMultipart: (header) => ({
    bytes: header.buffer,
    name: header.originalname,
  }),
  fileFromURL: async (url, timeout = 8) => {
    const { allowedLogoUrl } = require("./domain/lib/pure/image-source.js");
    for (let hop = 0; hop < 4; hop++) {
      if (!allowedLogoUrl(url))
        throw new errors.BadRequestError("Unsupported image host");
      const response = await send({
        url,
        timeout,
        redirect: "manual",
        maxBytes: 2 * 1024 * 1024,
      });
      if (response.statusCode >= 300 && response.statusCode < 400) {
        url = new URL(response.headers.get("location"), url).href;
        continue;
      }
      if (response.statusCode !== 200) throw new Error("Image unavailable");
      return {
        name: "logo",
        reader: { bytes: response.bytes },
        bytes: response.bytes,
      };
    }
    throw new Error("Too many redirects");
  },
};
Object.assign(runtime, {
  security,
  httpClient: { send },
  files,
  Record: DataRecord,
  MailerMessage: class {
    constructor(data) {
      Object.assign(this, data);
    }
  },
  ...errors,
});

function configure(app, repository, auth) {
  const jobs = new Map();
  Object.assign(runtime, { repository, jobs });
  const events = {
    onRecordCreate: "create",
    onRecordUpdate: "update",
    onRecordDelete: "delete",
    onRecordAfterCreateSuccess: "afterCreate",
    onRecordCreateRequest: "createRequest",
    onRecordUpdateRequest: "updateRequest",
    onRecordEnrich: "enrich",
  };
  for (const [name, event] of Object.entries(events))
    runtime[name] = (callback, ...names) =>
      repository.on(event, callback, names);
  runtime.cronAdd = (name, expression, callback) => {
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        await callback();
      } finally {
        running = false;
      }
    };
    jobs.set(name, run);
    require("node-cron").schedule(
      expression,
      () =>
        run().catch(() =>
          console.error("[Monline] Scheduled job failed:", name),
        ),
      { timezone: process.env.TZ || "Europe/Istanbul", noOverlap: true },
    );
  };
  runtime.apiLimits = { bodyLimit: (limit) => limit };
  runtime.routerAdd = (method, route, handler, bodyLimit = 1024 * 1024) => {
    if (
      [
        "/api/db/backup",
        "/api/db/restore",
        "/api/auth/totp/login-challenge",
      ].includes(route)
    )
      return;
    const expressRoute = route.replace(/\{(\w+)\}/g, ":$1");
    app[method.toLowerCase()](expressRoute, async (req, res, next) => {
      try {
        if (
          (route.startsWith("/api/api-keys") ||
            route === "/api/notifications/test") &&
          !auth.isAdmin(req.user)
        )
          throw new errors.ForbiddenError("admin_config_required");
        if (route === "/api/auth/totp/login-verify")
          auth.limitTotp(req.body?.challenge);
        if (
          Number(req.headers["content-length"] || 0) > bodyLimit &&
          !req.is("multipart/form-data")
        )
          throw new errors.HttpError(413, "Request too large");
        const context = {
          auth: req.user || null,
          app: repository,
          requestInfo: () => ({ body: req.body || {}, query: req.query }),
          request: {
            url: {
              query: () => ({ get: (key) => req.query[key] || "" }),
              path: req.path,
            },
            header: { get: (key) => req.get(key) || "" },
            pathValue: (key) => req.params[key],
            formFile: (key) => {
              const file = req.files?.find((entry) => entry.fieldname === key);
              if (!file) throw new errors.BadRequestError("File is required");
              return [null, file];
            },
          },
          response: {
            header: () => ({ set: (key, value) => res.set(key, value) }),
            write: (data) => res.send(Buffer.from(data)),
          },
          json: (status, data) => {
            if (data?.token && data?.record?.id) {
              auth.setSessionCookie(req, res, data.token);
              if (
                route === "/api/auth/totp/login-verify" &&
                req.body.remember === true
              )
                auth.rememberDevice(req, res, data.record.id);
            }
            return res.status(status).json(data);
          },
          string: (status, text) => res.status(status).send(text),
        };
        await handler(context);
        if (!res.headersSent) res.status(204).end();
      } catch (error) {
        next(error);
      }
    });
  };
}
runtime.configure = configure;
