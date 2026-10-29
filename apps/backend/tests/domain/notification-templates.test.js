const {
  renderNotification,
  validateTemplates,
  validateLocalizedTemplates,
} = require("../../src/notification-templates.cjs");
const {
  LANGUAGES,
  resolveLanguage,
  reminderContext,
  templatesForLanguage,
  mergeTemplates,
} = require("../../src/notification-language.cjs");

const context = (language, event = "payment") => ({
  language,
  event,
  days: 3,
  payer: "Ada",
  user_name: "Ada",
  url: "https://example.test/subscriptions",
  subscriptions: [
    {
      name: "Music",
      price: 1234.5,
      currency_code: "TRY",
      next_payment: "2026-11-01",
      cancellation_date: "2026-11-01",
    },
  ],
});

it.each(LANGUAGES)(
  "renders both reminder types with complete content in %s",
  (language) => {
    for (const event of ["payment", "cancellation"]) {
      const result = renderNotification({}, "email", context(language, event));
      expect(result.title).toContain("Monline");
      expect(result.message).toContain("Music");
      expect(result.message).not.toMatch(
        /undefined|NaN|\{(?:payer|when|days)\}/,
      );
      expect(result.html).toContain(`lang="${language.replace("_", "-")}"`);
      expect(result.html).not.toContain("{{");
      if (language !== "en")
        expect(result.title).not.toMatch(
          /Upcoming Payments|Upcoming Cancellations/,
        );
    }
  },
);
it("uses Turkish dates, currency and reminder wording", () => {
  const result = renderNotification({}, "email", context("tr"));
  expect(result.title).toBe("Monline — Yaklaşan ödemeler");
  expect(result.message).toContain("01.11.2026");
  expect(result.message).toContain("1.234,50");
  expect(result.message).toContain("3 gün");
  expect(result.html).toContain("Monline’ı aç");
});
it.each([
  ["pt-br", "pt_BR"],
  ["zh-CN", "zh_CN"],
  ["tr-TR", "tr"],
  ["__proto__", "en"],
  ["constructor", "en"],
  ["unknown", "en"],
])("normalizes %s safely", (input, expected) =>
  expect(resolveLanguage(input)).toBe(expected),
);
it("escapes inserted HTML and does not interpret variables inside user data", () => {
  const value = context("en");
  value.subscriptions[0].name = '<img src=x onerror="alert(1)"> {{title}}';
  const result = renderNotification({}, "email", value);
  expect(result.html).not.toContain("<img");
  expect(result.html).toContain("&lt;img");
  expect(result.html).toContain("{{title}}");
});
it("selects only the recipient language while retaining a legacy template in its original language", () => {
  const config = {
    template_language: "tr",
    templates: { email: { payment: { title: "Eski Türkçe" } } },
    localized_templates: {
      en: { email: { payment: { title: "English" } } },
      tr: { email: { cancellation: { title: "Türkçe iptal" } } },
    },
  };
  expect(templatesForLanguage(config, "tr").email).toMatchObject({
    payment: { title: "Eski Türkçe" },
    cancellation: { title: "Türkçe iptal" },
  });
  expect(templatesForLanguage(config, "en").email.payment.title).toBe(
    "English",
  );
  expect(templatesForLanguage(config, "de")).toEqual({});
});
it("resets one event without losing other events or channels", () => {
  const result = mergeTemplates(
    {
      email: { payment: { title: "Old" }, cancellation: { title: "Keep" } },
      telegram: { payment: { message: "Keep too" } },
    },
    { email: { payment: {} } },
  );
  expect(result.email.payment).toEqual({});
  expect(result.email.cancellation.title).toBe("Keep");
  expect(result.telegram.payment.message).toBe("Keep too");
});
it.each([
  { email: { payment: { title: "{{unknown}}" } } },
  { email: { payment: { title: "Bad\r\nHeader" } } },
  { telegram: { payment: { html: "not supported" } } },
  { email: { payment: { html: "x".repeat(131073) } } },
  { unknown: { payment: { title: "Bad" } } },
])("rejects malformed or unsafe template fields", (value) =>
  expect(() => validateTemplates(value)).toThrow(),
);
it("rejects unsupported locale keys", () =>
  expect(() => validateLocalizedTemplates({ xx: {} })).toThrow());
it("exposes both localized and ISO dates to custom templates", () => {
  const result = renderNotification(
    { email: { payment: { message: "{{date}} / {{date_iso}}" } } },
    "email",
    context("tr"),
  );
  expect(result.message).toBe("01.11.2026 / 2026-11-01");
  expect(reminderContext({ ...context("en"), days: 0 }).message).toContain(
    "today",
  );
});
