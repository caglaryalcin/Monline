let preference = "";
const listeners = new Set<() => void>();

export const NUMBER_FORMAT_LOCALES = ["en-US", "de-DE", "fr-FR", "de-CH", "hi-IN"] as const;

export function supportedNumberLocale(value: string) {
  try {
    const canonical = Intl.getCanonicalLocales(value.replace(/_/g, "-"))[0];
    return canonical && Intl.NumberFormat.supportedLocalesOf([canonical]).length ? canonical : null;
  } catch {
    return null;
  }
}

/** Number formatting is independent of the interface/translation language. */
export function resolveNumberLocale(value = preference): string {
  const selected = value && supportedNumberLocale(value);
  if (selected) return selected;
  if (typeof navigator !== "undefined") {
    for (const language of [...(navigator.languages || []), navigator.language]) {
      const locale = language && supportedNumberLocale(language);
      if (locale) return locale;
    }
  }
  return "en-US";
}

export function setNumberLocale(value?: string | null) {
  const next = value ? supportedNumberLocale(value) || "" : "";
  if (preference === next) return;
  preference = next;
  listeners.forEach((listener) => listener());
}

export function subscribeNumberLocale(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("languagechange", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("languagechange", listener);
  };
}

const formatters = new Map<string, Intl.NumberFormat>();
export function numberFormatter(
  options: Intl.NumberFormatOptions = {},
  locale = resolveNumberLocale(),
) {
  const key = JSON.stringify([locale, options]);
  const cached = formatters.get(key);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, options);
  if (formatters.size >= 100) formatters.delete(formatters.keys().next().value!);
  formatters.set(key, formatter);
  return formatter;
}

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale = resolveNumberLocale(),
) {
  return numberFormatter(options, locale).format(value);
}

/** Accept localized grouped values and either decimal separator without changing stored numbers. */
export function parseNumberInput(raw: string, locale = resolveNumberLocale()): number {
  const parts = numberFormatter({}, locale).formatToParts(12345.6);
  const decimal = parts.find((part) => part.type === "decimal")?.value || ".";
  const group = parts.find((part) => part.type === "group")?.value || ",";
  let value = raw;
  for (let digit = 0; digit <= 9; digit++) {
    const native = numberFormatter({ useGrouping: false }, locale).format(digit);
    if (native !== String(digit)) value = value.split(native).join(String(digit));
  }
  if (decimal !== "." && decimal !== ",") value = value.split(decimal).join(".");
  value = value.replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");
  const negative = value.trim().startsWith("-");
  value = value.replace(/[^\d.,]/g, "");
  if (!/\d/.test(value)) return 0;
  const dot = value.lastIndexOf(".");
  const comma = value.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    const index = Math.max(dot, comma);
    value = value.slice(0, index).replace(/[.,]/g, "") + "." + value.slice(index + 1);
  } else {
    const separator = dot >= 0 ? "." : comma >= 0 ? "," : "";
    const chunks = separator ? value.split(separator) : [value];
    const grouped =
      separator === group &&
      chunks.length > 1 &&
      /^\d{1,3}$/.test(chunks[0]) &&
      /^\d{3}$/.test(chunks[chunks.length - 1]) &&
      chunks.slice(1, -1).every((chunk) => /^\d{2,3}$/.test(chunk));
    value = grouped
      ? chunks.join("")
      : chunks.length > 1
        ? chunks.slice(0, -1).join("") + "." + chunks[chunks.length - 1]
        : value;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? (negative ? -amount : amount) : 0;
}
