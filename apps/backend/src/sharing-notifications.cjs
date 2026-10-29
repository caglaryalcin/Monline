const escapeHtml = require("escape-html");
const { brandedMessage } = require("./email-templates.cjs");

const ids = (value) =>
  Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];

function subscriptionRecipients(repository, subscription) {
  const sharing = subscription.get("sharing") || {};
  if (sharing.enabled === false) return new Set();
  const recipients = new Set(ids(sharing.users));
  const selectedGroups = new Set(
    ids(sharing.groups).filter((id) => sharing.groupEnabled?.[id] !== false),
  );
  if (selectedGroups.size) {
    const groups = repository.findRecordsByFilter(
      "sharing_groups",
      "user = {:owner}",
      "",
      0,
      0,
      {
        owner: subscription.getString("user"),
      },
    );
    for (const group of groups)
      if (selectedGroups.has(group.id))
        for (const id of ids(group.get("members"))) recipients.add(id);
  }
  recipients.delete(subscription.getString("user"));
  return recipients;
}

function sharedSubscriptionsUrl(repository) {
  const url = require("./public-url.cjs").publicUrl(
    repository,
    "/subscriptions",
  );
  if (!url) return "";
  url.hash = "shared-subscriptions-title";
  return url.href;
}

function subscriptionSharedMessage({
  from,
  to,
  language,
  senderName,
  subscriptionName,
  url,
}) {
  const locale =
    String(language || "en")
      .toLowerCase()
      .split(/[-_]/)[0] === "tr"
      ? "tr"
      : "en";
  const tr = locale === "tr";
  const body = tr
    ? `${senderName} adlı kullanıcı sizinle “${subscriptionName}” aboneliğini paylaştı.`
    : `${senderName} shared the subscription “${subscriptionName}” with you.`;
  const hint = tr
    ? "Aboneliği Monline’da “Benimle paylaşılanlar” bölümünde görebilirsiniz."
    : "You can find this subscription in the “Shared with me” section of Monline.";
  const linkLabel = tr
    ? "Paylaşılan abonelikleri görüntüle"
    : "View shared subscriptions";
  const link = url
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 18px;border:1px solid #b0ce62;border-radius:10px;background-color:#d1ff68;color:#303529;text-decoration:none;font-weight:600">${linkLabel}</a></p>`
    : "";
  return brandedMessage({
    from,
    to,
    locale,
    subject: tr
      ? "Monline — Sizinle bir abonelik paylaşıldı"
      : "Monline — A subscription was shared with you",
    text: `${body}\n\n${hint}${url ? `\n\n${linkLabel}: ${url}` : ""}`,
    bodyHtml: `<p style="margin:0 0 16px">${escapeHtml(body)}</p><p style="margin:0">${hint}</p>${link}`,
    logoAlt: tr ? "Monline logosu" : "Monline logo",
  });
}

async function notifyNewRecipients(
  repository,
  subscription,
  previousRecipients,
  sender,
) {
  // Sharing is an account event, separate from optional payment-reminder channels.
  const settings = repository.settings();
  if (!settings.smtp.enabled) return;
  const pending = [...subscriptionRecipients(repository, subscription)].filter(
    (id) => !previousRecipients.has(id),
  );
  if (!pending.length) return;
  const url = sharedSubscriptionsUrl(repository);
  let cursor = 0;
  async function deliver() {
    while (cursor < pending.length) {
      const userId = pending[cursor++];
      try {
        // Re-read access before each delivery; group membership may have changed
        // while earlier SMTP requests were pending.
        const current = repository.findRecordById(
          "subscriptions",
          subscription.id,
        );
        if (!subscriptionRecipients(repository, current).has(userId)) continue;
        const recipient = repository.findRecordById("users", userId);
        if (recipient.getBool("disabled") || !recipient.getString("email"))
          continue;
        await repository.newMailClient().send(
          subscriptionSharedMessage({
            from: {
              address: settings.meta.senderAddress || "noreply@monline.app",
              name: settings.meta.senderName || "Monline",
            },
            to: [{ address: recipient.getString("email") }],
            language: recipient.getString("language"),
            senderName: sender.getString("name") || sender.getString("email"),
            subscriptionName: current.getString("name"),
            url,
          }),
        );
      } catch {
        // A mail failure must not undo saved access or disclose SMTP credentials.
        console.warn(
          "[Monline] Subscription sharing email could not be delivered",
        );
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(4, pending.length) }, deliver),
  );
}

module.exports = {
  subscriptionRecipients,
  notifyNewRecipients,
  subscriptionSharedMessage,
};
