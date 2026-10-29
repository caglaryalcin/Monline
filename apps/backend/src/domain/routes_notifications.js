const {
  MailerMessage,
  httpClient,
  repository,
  routerAdd,
} = require("../runtime.cjs");
const domainPath = __dirname;
const { smtpTestMessage } = require("../email-templates.cjs");
const { ntfyRequest } = require("./lib/ntfy.js");
const providerFields = {
  email: [],
  discord: ["discord_webhook_url"],
  telegram: ["telegram_bot_token", "telegram_chat_id"],
  gotify: ["gotify_url", "gotify_token"],
  pushover: ["pushover_user_key", "pushover_api_token"],
  ntfy: [
    "ntfy_url",
    "ntfy_topic",
    "ntfy_username",
    "ntfy_password",
    "ntfy_auth_token",
  ],
  pushplus: ["pushplus_token"],
  mattermost: ["mattermost_webhook_url"],
  webhook: ["webhook_url"],
  serverchan: ["serverchan_send_key"],
};
// ================================================================
// ROUTE: POST /api/notifications/test — send a test notification
// ================================================================
routerAdd("POST", "/api/notifications/test", async (e) => {
  if (!e.auth)
    return e.json(401, {
      error: "Authentication required",
    });
  const body = e.requestInfo().body || {};
  const provider = body.provider;
  if (!provider)
    return e.json(400, {
      error: "provider is required",
    });
  if (typeof provider !== "string" || !Object.hasOwn(providerFields, provider))
    return e.json(400, { error: "Unknown notification provider" });
  let config;
  if (Object.hasOwn(body, "config")) {
    const draft = body.config;
    if (
      !draft ||
      typeof draft !== "object" ||
      Array.isArray(draft) ||
      Object.entries(draft).some(
        ([key, value]) =>
          !providerFields[provider].includes(key) ||
          typeof value !== "string" ||
          value.length > 8192,
      )
    )
      return e.json(400, { error: "Invalid notification test configuration" });
    // A supplied draft is authoritative. Never mix it with saved secrets or save it.
    config = {
      getString: (key) =>
        key === "email_to"
          ? e.auth.getString("email")
          : Object.hasOwn(draft, key)
            ? draft[key]
            : "",
    };
  } else
    config = require("../server-config.cjs").effectiveNotificationConfig(
      repository,
      e.auth.id,
    );
  const languageHelpers = require("../notification-language.cjs");
  const language = e.auth.getString?.("language") || "en";
  const copy = languageHelpers.copyFor(language);
  let title = copy.testTitle;
  let message = copy.testMessage;
  const templatesModule = require("../notification-templates.cjs");
  const savedTemplates = languageHelpers.templatesForLanguage(
    {
      templates: config.get?.("templates"),
      template_language: config.get?.("template_language"),
      localized_templates: config.get?.("localized_templates"),
    },
    language,
  );
  const useTemplate =
    Object.hasOwn(body, "localized_templates") ||
    Object.hasOwn(body, "templates") ||
    !!savedTemplates[provider];
  let rendered;
  if (useTemplate) {
    if (
      body.event !== undefined &&
      !templatesModule.EVENTS.includes(body.event)
    )
      return e.json(400, { error: "notification_template_invalid" });
    const templates = Object.hasOwn(body, "localized_templates")
      ? languageHelpers.templatesForLanguage(
          {
            localized_templates: templatesModule.validateLocalizedTemplates(
              body.localized_templates,
            ),
          },
          language,
        )
      : Object.hasOwn(body, "templates")
        ? templatesModule.validateTemplates(body.templates)
        : savedTemplates;
    rendered = templatesModule.renderNotification(
      templates,
      provider,
      templatesModule.sampleContext(repository, e.auth, body.event),
    );
    title = rendered.title;
    message = rendered.message;
  }
  try {
    switch (provider) {
      case "discord": {
        const url = config.getString("discord_webhook_url");
        if (!url)
          return e.json(400, {
            error: "Webhook URL not configured",
          });
        await httpClient.send({
          url,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [
              {
                title,
                description: message,
                color: 3447003,
              },
            ],
          }),
        });
        break;
      }
      case "telegram": {
        const token = config.getString("telegram_bot_token");
        const chatId = config.getString("telegram_chat_id");
        if (!token || !chatId)
          return e.json(400, {
            error: "Token or Chat ID not configured",
          });
        await httpClient.send({
          url: "https://api.telegram.org/bot" + token + "/sendMessage",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown",
          }),
        });
        break;
      }
      case "gotify": {
        const url = config.getString("gotify_url");
        const token = config.getString("gotify_token");
        if (!url || !token)
          return e.json(400, {
            error: "URL or token not configured",
          });
        await httpClient.send({
          url: url + "/message?token=" + token,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            message,
            priority: 5,
          }),
        });
        break;
      }
      case "pushover": {
        const userKey = config.getString("pushover_user_key");
        const apiToken = config.getString("pushover_api_token");
        if (!userKey || !apiToken)
          return e.json(400, {
            error: "User key or API token not configured",
          });
        await httpClient.send({
          url: "https://api.pushover.net/1/messages.json",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: apiToken,
            user: userKey,
            title,
            message,
          }),
        });
        break;
      }
      case "ntfy": {
        const ntfyUrl = config.getString("ntfy_url") || "https://ntfy.sh";
        const topic = config.getString("ntfy_topic");
        if (!topic)
          return e.json(400, {
            error: "Topic not configured",
          });
        await httpClient.send(
          ntfyRequest(ntfyUrl, topic, title, message, {
            username: config.getString("ntfy_username"),
            password: config.getString("ntfy_password"),
            token: config.getString("ntfy_auth_token"),
          }),
        );
        break;
      }
      case "pushplus": {
        const token = config.getString("pushplus_token");
        if (!token)
          return e.json(400, {
            error: "Token not configured",
          });
        await httpClient.send({
          url: "http://www.pushplus.plus/send",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            title,
            content: message,
            template: "markdown",
          }),
        });
        break;
      }
      case "mattermost": {
        const url = config.getString("mattermost_webhook_url");
        if (!url)
          return e.json(400, {
            error: "Webhook URL not configured",
          });
        await httpClient.send({
          url,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "*" + title + "*\n" + message,
          }),
        });
        break;
      }
      case "webhook": {
        const url = config.getString("webhook_url");
        if (!url)
          return e.json(400, {
            error: "Webhook URL not configured",
          });
        await httpClient.send({
          url,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            message,
          }),
        });
        break;
      }
      case "serverchan": {
        const key = config.getString("serverchan_send_key");
        if (!key)
          return e.json(400, {
            error: "SendKey not configured",
          });
        await httpClient.send({
          url: "https://sctapi.ftqq.com/" + key + ".send",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            desp: message,
          }),
        });
        break;
      }
      case "email": {
        const toEmail = config.getString("email_to");
        if (!toEmail)
          return e.json(400, {
            error: "Destination email not configured",
          });
        if (rendered) {
          await require("./lib/notifications.js").sendEmail(
            repository,
            toEmail,
            rendered.title,
            rendered.html,
            rendered.message,
          );
          break;
        }
        const settings = repository.settings();
        const msg = new MailerMessage(
          smtpTestMessage({
            language: repository
              .findRecordById("users", e.auth.id)
              .getString("language"),
            from: {
              address: settings.meta.senderAddress || "noreply@monline.app",
              name: settings.meta.senderName || "Monline",
            },
            to: [{ address: toEmail }],
          }),
        );
        await repository.newMailClient().send(msg);
        break;
      }
      default:
        return e.json(400, {
          error: "Unknown provider: " + provider,
        });
    }
  } catch (err) {
    if (err.code === "ntfy_invalid_credentials")
      return e.json(400, { error: err.message });
    return e.json(500, {
      error: "Failed to send: " + String(err),
    });
  }
  return e.json(200, {
    success: true,
  });
});
