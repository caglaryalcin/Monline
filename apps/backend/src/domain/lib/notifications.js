const { MailerMessage, httpClient } = require("../../runtime.cjs");
async function sendDiscord(webhookUrl, title, message) {
  await httpClient.send({
    url: webhookUrl,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds: [
        {
          title: title,
          description: message,
          color: 3447003,
        },
      ],
    }),
  });
}
async function sendTelegram(botToken, chatId, message) {
  await httpClient.send({
    url: "https://api.telegram.org/bot" + botToken + "/sendMessage",
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
}
async function sendGotify(serverUrl, token, title, message) {
  await httpClient.send({
    url: serverUrl + "/message?token=" + token,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: title,
      message: message,
      priority: 5,
    }),
  });
}
async function sendPushover(userKey, apiToken, title, message) {
  await httpClient.send({
    url: "https://api.pushover.net/1/messages.json",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: apiToken,
      user: userKey,
      title: title,
      message: message,
    }),
  });
}
async function sendNtfy(serverUrl, topic, title, message) {
  const url = (serverUrl || "https://ntfy.sh") + "/" + topic;
  await httpClient.send({
    url: url,
    method: "POST",
    headers: {
      Title: title,
    },
    body: message,
  });
}
async function sendPushPlus(token, title, message) {
  await httpClient.send({
    url: "http://www.pushplus.plus/send",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: token,
      title: title,
      content: message,
      template: "markdown",
    }),
  });
}
async function sendMattermost(webhookUrl, message) {
  await httpClient.send({
    url: webhookUrl,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: message,
    }),
  });
}
async function sendWebhookNotification(webhookUrl, templatePayload) {
  await httpClient.send({
    url: webhookUrl,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(templatePayload),
  });
}
async function sendServerChan(key, title, message) {
  await httpClient.send({
    url: "https://sctapi.ftqq.com/" + key + ".send",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: title,
      desp: message,
    }),
  });
}
async function sendEmail(app, toEmail, subject, body) {
  const message = new MailerMessage({
    from: {
      address: app.settings().meta.senderAddress || "noreply@monline.app",
    },
    to: [
      {
        address: toEmail,
      },
    ],
    subject: subject,
    html: body,
  });
  await app.newMailClient().send(message);
}

/**
 * Dispatches a notification to all enabled providers for a given config record.
 * Each provider's enabled flag and credentials are stored as flat fields.
 */
async function dispatchToAllProviders(
  app,
  notifConfig,
  title,
  message,
  subsData,
) {
  if (notifConfig.getBool("email_enabled")) {
    const to = notifConfig.getString("email_to");
    if (to)
      try {
        await sendEmail(app, to, title, message);
      } catch (e) {
        console.log("[Monline] email err:", e);
      }
  }
  if (notifConfig.getBool("discord_enabled")) {
    const url = notifConfig.getString("discord_webhook_url");
    if (url)
      try {
        await sendDiscord(url, title, message);
      } catch (e) {
        console.log("[Monline] discord err:", e);
      }
  }
  if (notifConfig.getBool("telegram_enabled")) {
    const token = notifConfig.getString("telegram_bot_token");
    const chatId = notifConfig.getString("telegram_chat_id");
    if (token && chatId)
      try {
        await sendTelegram(token, chatId, message);
      } catch (e) {
        console.log("[Monline] telegram err:", e);
      }
  }
  if (notifConfig.getBool("gotify_enabled")) {
    const url = notifConfig.getString("gotify_url");
    const token = notifConfig.getString("gotify_token");
    if (url && token)
      try {
        await sendGotify(url, token, title, message);
      } catch (e) {
        console.log("[Monline] gotify err:", e);
      }
  }
  if (notifConfig.getBool("pushover_enabled")) {
    const userKey = notifConfig.getString("pushover_user_key");
    const apiToken = notifConfig.getString("pushover_api_token");
    if (userKey && apiToken)
      try {
        await sendPushover(userKey, apiToken, title, message);
      } catch (e) {
        console.log("[Monline] pushover err:", e);
      }
  }
  if (notifConfig.getBool("ntfy_enabled")) {
    const url = notifConfig.getString("ntfy_url");
    const topic = notifConfig.getString("ntfy_topic");
    if (topic)
      try {
        await sendNtfy(url, topic, title, message);
      } catch (e) {
        console.log("[Monline] ntfy err:", e);
      }
  }
  if (notifConfig.getBool("pushplus_enabled")) {
    const token = notifConfig.getString("pushplus_token");
    if (token)
      try {
        await sendPushPlus(token, title, message);
      } catch (e) {
        console.log("[Monline] pushplus err:", e);
      }
  }
  if (notifConfig.getBool("mattermost_enabled")) {
    const url = notifConfig.getString("mattermost_webhook_url");
    if (url)
      try {
        await sendMattermost(url, message);
      } catch (e) {
        console.log("[Monline] mattermost err:", e);
      }
  }
  if (notifConfig.getBool("webhook_enabled")) {
    const url = notifConfig.getString("webhook_url");
    if (url)
      try {
        await sendWebhookNotification(url, {
          title,
          message,
          subscriptions: subsData,
        });
      } catch (e) {
        console.log("[Monline] webhook err:", e);
      }
  }
  if (notifConfig.getBool("serverchan_enabled")) {
    const key = notifConfig.getString("serverchan_send_key");
    if (key)
      try {
        await sendServerChan(key, title, message);
      } catch (e) {
        console.log("[Monline] serverchan err:", e);
      }
  }
}
module.exports = {
  sendDiscord,
  sendTelegram,
  sendGotify,
  sendPushover,
  sendNtfy,
  sendPushPlus,
  sendMattermost,
  sendWebhookNotification,
  sendServerChan,
  sendEmail,
  dispatchToAllProviders,
};
