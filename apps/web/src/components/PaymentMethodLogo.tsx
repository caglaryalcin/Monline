import { useState } from "react";

import { paymentMethodLogoSources } from "@/lib/paymentMethodLogos";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

function Logo({
  method,
  sources,
  size,
  className,
}: {
  method: PaymentMethod;
  sources: string[];
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(0);
  const style = size ? { width: size, height: size } : undefined;
  if (failed < sources.length)
    return (
      <img
        src={sources[failed]}
        alt={method.name}
        title={method.name}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        loading="lazy"
        style={style}
        className={cn("shrink-0 object-contain bg-white p-0.5", className)}
        onError={() => setFailed((current) => current + 1)}
      />
    );
  const initials = method.name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      title={method.name}
      style={style}
      className={cn(
        "shrink-0 flex items-center justify-center bg-muted font-semibold text-muted-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function PaymentMethodLogo({
  method,
  size,
  className,
}: {
  method: PaymentMethod;
  size?: number;
  className?: string;
}) {
  const sources = paymentMethodLogoSources(method);
  return (
    <Logo
      key={JSON.stringify(sources)}
      method={method}
      sources={sources}
      size={size}
      className={className}
    />
  );
}
