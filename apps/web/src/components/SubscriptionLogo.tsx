import { useState } from "react";

import { findLogoService } from "@/lib/logoServices";
import { automaticLogoUrls, isLegacyWorkspaceLogo } from "@/lib/subscriptionLogo";
import { cn } from "@/lib/utils";
import { subscriptionsService } from "@/services/subscriptions";
import type { Subscription } from "@/types";

function LogoImage({
  sources,
  name,
  serviceName,
  className,
}: {
  sources: string[];
  name: string;
  serviceName?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(0);
  return failed < sources.length ? (
    <img
      src={sources[failed]}
      alt={name}
      className={cn(
        className,
        findLogoService(serviceName || name)?.iconSlug === "hbo" && "dark:brightness-0 dark:invert",
      )}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed((index) => index + 1)}
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
  className = "h-full w-full object-contain p-1",
}: {
  sub: Pick<Subscription, "name" | "url"> &
    Partial<Pick<Subscription, "id" | "logo" | "standalone_payment_id" | "brand_name">>;
  previewUrl?: string | null;
  className?: string;
}) {
  const serviceName = sub.brand_name?.trim() || sub.name;
  const saved =
    sub.logo && sub.id
      ? subscriptionsService.logoUrl({
          id: sub.id,
          logo: sub.logo,
          standalone_payment_id: sub.standalone_payment_id,
        })
      : null;
  const automatic = automaticLogoUrls(sub);
  const legacyWorkspace = isLegacyWorkspaceLogo({ name: serviceName, logo: sub.logo });
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
      serviceName={serviceName}
      className={className}
    />
  );
}
