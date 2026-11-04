import { findLogoService } from "@/lib/logoServices";
import type { Subscription } from "@/types";

export function automaticLogoUrls(
  sub: Pick<Subscription, "name" | "url"> & Pick<Partial<Subscription>, "brand_name">,
): string[] {
  const brand = sub.brand_name?.trim();
  const lookupName = brand || sub.name;
  const service = findLogoService(lookupName);
  // Bundled brand artwork also works with an old website, a billing-page URL
  // or a brand's alternate domain, without relying on remote favicon sizes.
  const namedLogo = service?.logoUrl ? [service.logoUrl] : [];
  let domain = "";
  if (sub.url && !brand) {
    try {
      const url = new URL(sub.url.includes("://") ? sub.url : `https://${sub.url}`);
      if (["https:", "http:"].includes(url.protocol))
        domain = url.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      /* Try a known service name instead. */
    }
  }
  if (!domain) domain = service?.domain ?? publicLogoDomain(lookupName);
  // Do not send local NAS addresses, credentials, paths, or query strings to a favicon service.
  if (!publicLogoDomain(domain)) return namedLogo;
  const localLogo = [service, findLogoService(domain)].find(
    (candidate) => candidate?.domain === domain && candidate.logoUrl,
  )?.logoUrl;
  return [
    ...namedLogo,
    ...(localLogo && !namedLogo.length ? [localLogo] : []),
    `https://icon.horse/icon/${encodeURIComponent(domain)}`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
  ];
}

/** Legacy automatic filenames can acquire another storage prefix on each import. */
export function isLegacyWorkspaceLogo(sub: Pick<Subscription, "name" | "logo">): boolean {
  if (findLogoService(sub.name)?.iconSlug !== "googleworkspace" || !sub.logo) return false;
  return /^(?:[a-f0-9]{16}_)*logo(?:[-_](?:workspace[._-]google[._-]com|googleworkspace|google))?(?:_[a-z0-9]{10,})?\.(?:webp|png|svg|ico|jpe?g)$/i.test(
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
