/** Resolve the active formatting locale consistently across finance screens. */
export function resolveLocale(
  language: { resolvedLanguage?: string; language?: string } | undefined,
  fallback = "en",
) {
  return (language?.resolvedLanguage || language?.language || fallback).replace(/_/g, "-");
}
