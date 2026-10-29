export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "pt_BR", name: "Português (Brasil)" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "it", name: "Italiano" },
  { code: "nl", name: "Nederlands" },
  { code: "pl", name: "Polski" },
  { code: "ru", name: "Русский" },
  { code: "zh_CN", name: "中文 (简体)" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "tr", name: "Türkçe" },
  { code: "uk", name: "Українська" },
  { code: "cs", name: "Čeština" },
  { code: "da", name: "Dansk" },
  { code: "bg", name: "Български" },
];

export function notificationLanguage(language?: string): string {
  const normalized = (language || "en").replace(/-/g, "_").toLowerCase();
  const exact = SUPPORTED_LANGUAGES.find((item) => item.code.toLowerCase() === normalized);
  if (exact) return exact.code;
  const base = normalized.split("_")[0];
  if (base === "pt") return "pt_BR";
  if (base === "zh") return "zh_CN";
  return SUPPORTED_LANGUAGES.find((item) => item.code === base)?.code || "en";
}
