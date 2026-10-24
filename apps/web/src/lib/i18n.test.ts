import { LS_KEYS } from "./constants";
import i18n, { SUPPORTED_LANGUAGES } from "./i18n";

describe("i18n", () => {
  it("translates payment period controls in every supported language", () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      const resources = i18n.getResourceBundle(code, "translation");
      for (const key of [
        "history_last_six_months",
        "statistics_categories_upcoming",
        "statistics_next_months",
        "statistics_category_no_upcoming",
      ]) {
        expect(resources[key], `${code}.${key}`).toBeTruthy();
      }
    }
    expect(i18n.t("history_last_six_months", { lng: "tr" })).toBe("Son 6 ay");
    expect(i18n.t("statistics_categories_upcoming", { lng: "tr" })).toBe("Gelecek ödemeler");
    expect(i18n.t("statistics_next_months", { lng: "tr", count: 6 })).toBe("Önümüzdeki 6 ay");
  });
  it.each(["tr", "bg"])("uses real %s weekdays in the calendar", (language) => {
    const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    keys.forEach((key, index) => {
      const day = new Date(2026, 9, 11 + index);
      expect(i18n.t(key, { lng: language }).toLocaleLowerCase(language)).toBe(
        new Intl.DateTimeFormat(language, { weekday: "long" })
          .format(day)
          .toLocaleLowerCase(language),
      );
    });
  });
  it("fully translates Monline workflows in Turkish, German and Bulgarian with matching placeholders", () => {
    const english = i18n.getResourceBundle("en", "translation");
    for (const language of ["tr", "de", "bg"]) {
      const resources = i18n.getResourceBundle(language, "translation");
      for (const key of Object.keys(english)) {
        expect(resources[key], `${language}.${key}`).toBeTruthy();
        expect((resources[key].match(/\{\{.*?\}\}/g) ?? []).sort(), `${language}.${key}`).toEqual(
          (english[key].match(/\{\{.*?\}\}/g) ?? []).sort(),
        );
        expect((resources[key].match(/<\/?\w+>/g) ?? []).sort(), `${language}.${key}`).toEqual(
          (english[key].match(/<\/?\w+>/g) ?? []).sort(),
        );
      }
    }
  });
  it("configures the expected fallback language and localStorage key", () => {
    expect(i18n.options.fallbackLng).toEqual(["en"]);
    expect(i18n.options.detection).toMatchObject({
      lookupLocalStorage: LS_KEYS.LANGUAGE,
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    });
  });

  it("renders Bulgarian plural forms and interpolates translated statements", () => {
    expect(i18n.t("billing_days_remaining", { lng: "bg", count: 1 })).toBe("Остава 1 ден");
    expect(i18n.t("billing_days_remaining", { lng: "bg", count: 5 })).toBe("Остават 5 дни");
    expect(i18n.t("billing_days_overdue", { lng: "bg", count: 1 })).toBe("Просрочено с 1 ден");
    expect(i18n.t("billing_days_overdue", { lng: "bg", count: 5 })).toBe("Просрочено с 5 дни");
    expect(i18n.t("statement_progress", { lng: "bg", current: 2, total: 4 })).toBe(
      "Четене на страница 2 от 4…",
    );
  });

  it("exposes the supported languages list", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(
      expect.arrayContaining([
        { code: "en", name: "English" },
        { code: "pt_BR", name: "Português (Brasil)" },
        { code: "zh_CN", name: "中文 (简体)" },
        { code: "bg", name: "Български" },
      ]),
    );
    expect(SUPPORTED_LANGUAGES).toHaveLength(17);
  });

  it("translates the income-credit workflow in every supported language", () => {
    const creditKeys = [
      "record_type",
      "expense",
      "credit_income",
      "credit_income_hint",
      "expense_hint",
      "one_time_payout",
      "one_time_payout_hint",
      "received_on",
      "one_time",
      "credits_this_month",
    ];

    for (const { code } of SUPPORTED_LANGUAGES) {
      const resources = i18n.getResourceBundle(code, "translation");
      for (const key of creditKeys) {
        expect(resources[key], `${code}.${key}`).toBeTruthy();
      }
    }
  });

  it("translates subscription view controls in every supported language", () => {
    const viewKeys = ["view", "grid_view", "list_view"];

    for (const { code } of SUPPORTED_LANGUAGES) {
      const resources = i18n.getResourceBundle(code, "translation");
      for (const key of viewKeys) {
        expect(resources[key], `${code}.${key}`).toBeTruthy();
      }
    }
  });
});
