import { createInstance } from "i18next";

import { categoryLabel } from "./categoryLabel";
import de from "./locales/de.json";
import en from "./locales/en.json";
import tr from "./locales/tr.json";

describe("category translations", () => {
  it("changes seeded labels with the application language while preserving the ID and name", async () => {
    const instance = createInstance();
    await instance.init({
      lng: "tr",
      resources: { tr: { translation: tr }, en: { translation: en }, de: { translation: de } },
    });
    const category = { id: "stable-id", name: "Music", translation_key: "music" };
    expect(categoryLabel(category, instance.t)).toBe("Müzik");
    await instance.changeLanguage("de");
    expect(categoryLabel(category, instance.t)).toBe("Musik");
    expect(category).toEqual({ id: "stable-id", name: "Music", translation_key: "music" });
    expect(categoryLabel({ name: "My work tools" }, instance.t)).toBe("My work tools");
  });
});
