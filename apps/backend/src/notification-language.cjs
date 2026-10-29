const locales = require("./notification-locales.json");
const LANGUAGES = Object.keys(locales);
function resolveLanguage(language) {
  const normalized = String(language || "en")
    .replace(/-/g, "_")
    .toLowerCase();
  const exact = LANGUAGES.find((key) => key.toLowerCase() === normalized);
  if (exact) return exact;
  const base = normalized.split("_")[0];
  if (base === "pt") return "pt_BR";
  if (base === "zh") return "zh_CN";
  return Object.hasOwn(locales, base) ? base : "en";
}
const phrase = (text, values) =>
  text.replace(/{(\w+)}/g, (_, key) => String(values[key] ?? ""));
function dateLabel(value, language) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")))
    return String(value || "");
  const date = new Date(value + "T12:00:00Z");
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(language.replace("_", "-"), {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function amountLabel(sub, language) {
  if (sub.price === undefined || sub.price === null) return "";
  const locale = language.replace("_", "-");
  if (sub.currency_code) {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: sub.currency_code,
      }).format(Number(sub.price));
    } catch {
      /* Custom currencies retain their configured symbol. */
    }
  }
  return (
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(sub.price)) +
    (sub.currency ? " " + sub.currency.trim() : "")
  );
}
function reminderContext(context) {
  const language = resolveLanguage(context.language);
  const copy = locales[language];
  const cancellation = context.event === "cancellation";
  const subscriptions = Array.isArray(context.subscriptions)
    ? context.subscriptions
    : [];
  const days = Number(context.days ?? 0);
  const plural = new Intl.PluralRules(language.replace("_", "-")).select(days);
  const daysPattern =
    plural === "one"
      ? copy.daysOne
      : plural === "few"
        ? copy.daysFew || copy.daysOther
        : copy.daysOther;
  const when = days === 0 ? copy.today : phrase(daysPattern, { days });
  const payer = context.payer || copy.you;
  const subscriptionText = subscriptions
    .map((sub) => {
      const due = sub.cancellation_date || sub.next_payment || "";
      const date = dateLabel(due, language);
      return cancellation
        ? `• **${sub.name}** — ${copy.cancels}: ${date}`
        : `• **${sub.name}** — ${amountLabel(sub, language)} (${copy.due}: ${date})`;
    })
    .join("\n");
  const intro = phrase(
    cancellation ? copy.cancellationIntro : copy.paymentIntro,
    { payer, when },
  );
  const dateIso =
    context.date_iso ||
    subscriptions[0]?.cancellation_date ||
    subscriptions[0]?.next_payment ||
    "";
  return {
    ...context,
    language,
    payer,
    title: cancellation ? copy.cancellationTitle : copy.paymentTitle,
    message: intro + "\n\n" + subscriptionText,
    subscription_text: subscriptionText,
    date: dateLabel(dateIso, language),
    date_iso: dateIso,
    open_app: copy.openApp,
  };
}
function templatesForLanguage(config, language) {
  const locale = resolveLanguage(language);
  const base =
    resolveLanguage(config.template_language || "en") === locale
      ? config.templates || {}
      : {};
  return mergeTemplates(base, config.localized_templates?.[locale] || {});
}
function mergeTemplates(base, changes) {
  const merged = { ...base };
  for (const [channel, events] of Object.entries(changes))
    merged[channel] = { ...base[channel], ...events };
  return merged;
}
module.exports = {
  LANGUAGES,
  resolveLanguage,
  reminderContext,
  dateLabel,
  templatesForLanguage,
  mergeTemplates,
  copyFor: (language) => locales[resolveLanguage(language)],
};
