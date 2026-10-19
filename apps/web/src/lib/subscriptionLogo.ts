import { findLogoService } from "@/lib/logoServices";
import type { Subscription } from "@/types";

export function automaticLogoUrls(sub: Pick<Subscription, "name" | "url">): string[] {
  const service = findLogoService(sub.name);
  let domain = "";
  if (sub.url) {
    try {
      const url = new URL(sub.url.includes("://") ? sub.url : `https://${sub.url}`);
      if (["https:", "http:"].includes(url.protocol))
        domain = url.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      /* Try a known service name instead. */
    }
  }
  if (!domain) domain = service?.domain ?? publicLogoDomain(sub.name);
  // Do not send local NAS addresses, credentials, paths, or query strings to a favicon service.
  if (!publicLogoDomain(domain)) return [];
  return [
    ...(domain === service?.domain && service.logoUrl ? [service.logoUrl] : []),
    `https://icon.horse/icon/${encodeURIComponent(domain)}`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
  ];
}

/** A bare public hostname. Never infer a website from an unknown plain name. */
export function publicLogoDomain(value: string): string {
  const domain = value
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain) &&
    !/\.(local|lan|internal|localhost|test|invalid|example|home|arpa)$/i.test(domain)
    ? domain
    : "";
}
