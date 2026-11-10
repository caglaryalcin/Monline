/** Resolve the active formatting locale consistently across finance screens. */
export function resolveLocale(
  language: { resolvedLanguage?: string; language?: string } | undefined,
  fallback = "en",
) {
  return (language?.resolvedLanguage || language?.language || fallback).replace(/_/g, "-");
}

/** Dates use the selected interface language and profile country. */
export function resolveDateLocale(
  language: { resolvedLanguage?: string; language?: string } | undefined,
  country?: string,
) {
  const locale = resolveLocale(language);
  return country && /^[a-z]{2}$/i.test(country)
    ? new Intl.Locale(locale, { region: country.toUpperCase() }).toString()
    : locale;
}
