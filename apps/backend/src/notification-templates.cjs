const escapeHtml = require("escape-html");
const { BadRequestError } = require("./errors.cjs");
const languageHelpers = require("./notification-language.cjs");

const EVENTS = ["payment", "cancellation"];
const CHANNELS = [
  "email",
  "discord",
  "telegram",
  "gotify",
  "pushover",
  "ntfy",
  "pushplus",
  "mattermost",
  "webhook",
  "serverchan",
];
const VARIABLES = [
  "title",
  "message",
  "subscriptions",
  "user_name",
  "user_email",
  "payer",
  "days",
  "count",
  "event",
  "date",
  "url",
  "language",
  "date_iso",
  "open_app",
];
const HTML = `<!doctype html>
<html lang="{{language}}"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f5f4ef;font-family:Arial,sans-serif;color:#303529">
  <main style="max-width:560px;margin:24px auto;padding:28px;background:#fff;border:1px solid #dfe3d9;border-radius:16px">
    <p style="font-weight:bold;font-size:24px">Monline</p>
    <h1 style="font-size:20px">{{title}}</h1>
    <p style="line-height:1.7">{{message}}</p>
    <p><a href="{{url}}" style="color:#303529">{{open_app}}</a></p>
  </main>
</body></html>`;
const defaults = () =>
  Object.fromEntries(
    EVENTS.map((event) => [
      event,
      { title: "{{title}}", message: "{{message}}", html: HTML },
    ]),
  );

function validateTemplates(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > CHANNELS.length
  )
    throw new BadRequestError("notification_template_invalid");
  const result = {};
  for (const [channel, events] of Object.entries(value)) {
    if (
      !CHANNELS.includes(channel) ||
      !events ||
      typeof events !== "object" ||
      Array.isArray(events)
    )
      throw new BadRequestError("notification_template_invalid");
    result[channel] = {};
    for (const [event, fields] of Object.entries(events)) {
      if (
        !EVENTS.includes(event) ||
        !fields ||
        typeof fields !== "object" ||
        Array.isArray(fields)
      )
        throw new BadRequestError("notification_template_invalid");
      result[channel][event] = {};
      for (const [field, template] of Object.entries(fields)) {
        if (
          ![
            "title",
            "message",
            ...(channel === "email" ? ["html"] : []),
          ].includes(field) ||
          typeof template !== "string" ||
          template.length >
            (field === "html" ? 131072 : field === "title" ? 300 : 8192) ||
          template.includes("\0") ||
          (field === "title" && /[\r\n]/.test(template))
        )
          throw new BadRequestError("notification_template_invalid");
        for (const match of template.matchAll(/{{\s*([\w.]+)\s*}}/g))
          if (!VARIABLES.includes(match[1]))
            throw new BadRequestError("notification_template_invalid_variable");
        result[channel][event][field] = template;
      }
    }
  }
  return result;
}

function renderNotification(templates, channel, context) {
  if (context.event) context = languageHelpers.reminderContext(context);
  else
    context = {
      ...context,
      language: languageHelpers.resolveLanguage(context.language),
      open_app: languageHelpers.copyFor(context.language).openApp,
    };
  const event = EVENTS.includes(context.event) ? context.event : "payment";
  const template = templates?.[channel]?.[event] || {};
  const subscriptions = Array.isArray(context.subscriptions)
    ? context.subscriptions
    : [];
  const values = {
    ...Object.fromEntries(
      VARIABLES.map((key) => [key, String(context[key] ?? "")]),
    ),
    event,
    language: languageHelpers
      .resolveLanguage(context.language)
      .replace("_", "-"),
    count: String(subscriptions.length),
    date:
      context.date ||
      subscriptions[0]?.cancellation_date ||
      subscriptions[0]?.next_payment ||
      "",
    subscriptions:
      context.subscription_text ??
      subscriptions
        .map(
          (sub) =>
            `${sub.name} — ${sub.currency || ""}${sub.price ?? ""} (${sub.cancellation_date || sub.next_payment || ""})`,
        )
        .join("\n"),
  };
  const render = (source, html = false) =>
    String(source).replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
      const value = values[key] ?? "";
      if (!html) return value;
      const safe = escapeHtml(value);
      return (
        key === "message"
          ? safe.replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>")
          : safe
      ).replace(/\r?\n/g, "<br>");
    });
  const title = render(template.title?.trim() ? template.title : "{{title}}")
    .replace(/[\r\n\x00-\x1f]/g, " ")
    .slice(0, 300);
  values.title = title;
  const message = render(
    template.message?.trim() ? template.message : "{{message}}",
  );
  values.message = message;
  return {
    title,
    message,
    html: render(template.html?.trim() ? template.html : HTML, true),
  };
}

function sampleContext(repository, user, event = "payment") {
  const cancellation = event === "cancellation";
  const language = languageHelpers.resolveLanguage(user.getString("language"));
  const copy = languageHelpers.copyFor(language);
  const date = new Date();
  date.setDate(date.getDate() + 3);
  const sampleDate = require("./domain/lib/date-helpers.js").formatLocalDate(
    date,
  );
  return languageHelpers.reminderContext({
    event: cancellation ? "cancellation" : "payment",
    language,
    user_name: user.getString("name"),
    user_email: user.getString("email"),
    payer: user.getString("name"),
    days: 3,
    url:
      require("./public-url.cjs").publicUrl(repository, "/subscriptions")
        ?.href || "",
    subscriptions: [
      {
        name: copy.example,
        price: 100,
        currency: "₺",
        currency_code: "TRY",
        ...(cancellation
          ? { cancellation_date: sampleDate }
          : { next_payment: sampleDate }),
      },
    ],
  });
}

function validateLocalizedTemplates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestError("notification_template_invalid");
  const result = {};
  for (const [language, templates] of Object.entries(value)) {
    if (!languageHelpers.LANGUAGES.includes(language))
      throw new BadRequestError("notification_template_invalid");
    result[language] = validateTemplates(templates);
  }
  return result;
}

module.exports = {
  defaults,
  validateTemplates,
  validateLocalizedTemplates,
  renderNotification,
  sampleContext,
  EVENTS,
  CHANNELS,
  VARIABLES,
};
