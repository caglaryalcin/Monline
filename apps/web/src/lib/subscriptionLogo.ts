import { findLogoService } from "@/lib/logoServices";
import type { Subscription } from "@/types";

/** A decoded logo stays usable regardless of its size, shape or storage path. */
export function isRenderableLogoSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

/** Decode with the browser so SVGs and ICOs follow the same rules as saved logos.
 * Convert formats unsupported by uploads to PNG at their original dimensions.
 */
export function prepareLogoBlob(blob: Blob, signal?: AbortSignal): Promise<Blob> {
  if (signal?.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    let finished = false;
    const finish = (result?: Blob, error?: Error) => {
      if (finished) return;
      finished = true;
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", onAbort);
      image.src = "";
      URL.revokeObjectURL(url);
      if (result) resolve(result);
      else reject(error || new Error("Invalid logo image"));
    };
    const onAbort = () => finish(undefined, new DOMException("Cancelled", "AbortError"));
    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      if (!isRenderableLogoSize(width, height)) { finish(); return; }
      const type = blob.type.toLowerCase().split(";")[0];
      if (["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"].includes(type)) {
        finish(blob);
        return;
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) { finish(); return; }
        context.drawImage(image, 0, 0);
        canvas.toBlob((png) => finish(png || undefined), "image/png");
      } catch {
        finish();
      }
    };
    image.onerror = () => finish();
    signal?.addEventListener("abort", onAbort, { once: true });
    image.src = url;
  });
}

export function automaticLogoUrls(sub: Pick<Subscription, "name" | "url">): string[] {
  const service = findLogoService(sub.name);
  // Bundled brand artwork also works with an old website, a billing-page URL
  // or a brand's alternate domain, without relying on remote favicon sizes.
  const namedLogo = service?.logoUrl ? [service.logoUrl] : [];
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
