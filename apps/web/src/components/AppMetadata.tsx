import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { resolveLocale } from "@/lib/locale";

function setMeta(selector: string, attr: "content", value: string) {
  const el = document.head.querySelector<HTMLMetaElement>(selector);
  if (el) {
    el.setAttribute(attr, value);
    return;
  }

  const meta = document.createElement("meta");

  if (selector.startsWith('meta[name="')) {
    const name = selector.slice(11, -2);
    meta.setAttribute("name", name);
  } else if (selector.startsWith('meta[property="')) {
    const property = selector.slice(15, -2);
    meta.setAttribute("property", property);
    /* v8 ignore start */
  } else {
    // Dead branch: AppMetadata only calls setMeta with meta[name="…"] or meta[property="…"] selectors.
  }
  /* v8 ignore stop */

  meta.setAttribute(attr, value);
  document.head.appendChild(meta);
}

export function AppMetadata() {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n);

  useEffect(() => {
    const appName = t("app_name", { defaultValue: "Monline" });
    const subtitle = t("meta_subtitle", {
      defaultValue: "Monthly online spending, clearly.",
    });
    const description = t("meta_description", {
      defaultValue:
        "Track subscriptions and monthly online spending, with spreadsheet connections and full control of your data.",
    });

    document.documentElement.lang = locale;
    document.title = `${appName} — ${subtitle}`;

    setMeta('meta[name="application-name"]', "content", appName);
    setMeta('meta[name="apple-mobile-web-app-title"]', "content", appName);
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", appName);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[name="twitter:title"]', "content", appName);
    setMeta('meta[name="twitter:description"]', "content", description);
  }, [locale, t]);

  return null;
}
