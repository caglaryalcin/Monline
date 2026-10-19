import { findLogoService } from "@/lib/logoServices";
import type { Subscription } from "@/types";

export function automaticLogoUrls(sub: Pick<Subscription, "name" | "url">): string[] {
  const service = findLogoService(sub.name);
  // Older Workspace records can still point to google.com. The local brand
  // asset does not depend on that URL and never discloses a private hostname.
  const workspaceLogo =
    service?.iconSlug === "googleworkspace" && service.logoUrl ? [service.logoUrl] : [];
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
  if (!publicLogoDomain(domain)) return workspaceLogo;
  return [
    ...workspaceLogo,
    ...(domain === service?.domain && service.logoUrl && !workspaceLogo.length
      ? [service.logoUrl]
      : []),
    `https://icon.horse/icon/${encodeURIComponent(domain)}`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
  ];
}

/** Names produced by the old automatic search and its generic logo fallback. */
export function isLegacyWorkspaceLogo(sub: Pick<Subscription, "name" | "logo">): boolean {
  if (findLogoService(sub.name)?.iconSlug !== "googleworkspace" || !sub.logo) return false;
  return /^(?:[a-f0-9]{16}_)?logo(?:[-_](?:workspace[._-]google[._-]com|googleworkspace|google))?(?:_[a-z0-9]{10,})?\.(?:webp|png|svg|ico|jpe?g)$/i.test(
    sub.logo,
  );
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
