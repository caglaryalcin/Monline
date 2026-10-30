import { useState } from "react";

import { useMerchantLogo } from "@/contexts/MerchantLogosContext";
import { findLogoService } from "@/lib/logoServices";
import { automaticLogoUrls, isLegacyWorkspaceLogo, isRenderableLogoSize } from "@/lib/subscriptionLogo";
import { cn } from "@/lib/utils";
import { subscriptionsService } from "@/services/subscriptions";
import type { Subscription } from "@/types";

function LogoImage({
  sources,
  name,
  className,
  vectorPreview,
}: {
  sources: string[];
  name: string;
  className?: string;
  vectorPreview?: string;
}) {
  const [failed, setFailed] = useState(0);
  const advance = () => setFailed((index) => index === failed ? index + 1 : index);
  return failed < sources.length ? (
    <img
      key={sources[failed]}
      src={sources[failed]}
      alt={name}
      className={cn(
        className,
        sources[failed]?.startsWith("/assets/logos/merchants/") &&
          (/-white\.svg$/i.test(sources[failed]) ? "bg-slate-900" : "bg-white"),
        findLogoService(name)?.iconSlug === "hbo" && "dark:brightness-0 dark:invert",
      )}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={{ objectFit: /\.svg(?:[?#]|$)/i.test(sources[failed]) || sources[failed] === vectorPreview ? "contain" : "scale-down" }}
      onError={advance}
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        if (!isRenderableLogoSize(naturalWidth, naturalHeight)) advance();
      }}
    />
  ) : (
    <span
      aria-label={name}
      className={cn(
        "flex items-center justify-center bg-primary/10 font-semibold text-primary",
        className,
      )}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export function SubscriptionLogo({
  sub,
  previewUrl,
  previewContentType,
  month,
  rowId,
  className = "h-full w-full object-contain p-1",
}: {
  sub: Pick<Subscription, "name" | "url"> &
    Partial<Pick<Subscription, "id" | "logo" | "standalone_payment_id">>;
  previewUrl?: string | null;
  previewContentType?: string;
  className?: string;
  month?: string;
  rowId?: string;
}) {
  const saved =
    sub.logo && sub.id
      ? subscriptionsService.logoUrl({
          id: sub.id,
          logo: sub.logo,
          standalone_payment_id: sub.standalone_payment_id,
        })
      : null;
  const choice = useMerchantLogo(sub.name, { month, rowId });
  const automatic = automaticLogoUrls(
    choice ? { name: choice.provider_name, url: `https://${choice.domain}` } : sub,
  );
  const legacyWorkspace = isLegacyWorkspaceLogo({ name: sub.name, logo: sub.logo });
  const sources = [
    ...new Set([
      ...(previewUrl ? [previewUrl] : []),
      ...(legacyWorkspace ? automatic.slice(0, 1) : []),
      ...(saved ? [saved] : []),
      ...automatic,
    ]),
  ];
  return (
    <LogoImage
      key={JSON.stringify(sources)}
      sources={sources}
      name={sub.name}
      className={className}
      vectorPreview={previewContentType?.includes("svg") ? previewUrl || undefined : undefined}
    />
  );
}
