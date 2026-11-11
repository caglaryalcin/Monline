import { type ReactNode, useId, useMemo } from "react";

import { useAnimationPreferences } from "@/hooks/useAnimationPreferences";

// Restart after reload or remount, but keep playback stable during React updates.
const playbackSession = Date.now().toString(36);
let playbackSequence = 0;

export function FinanceAnimationIcon({ asset, fallback }: {
  asset: "credit-card" | "loans" | "price-tag" | "receipt";
  fallback: ReactNode;
}) {
  const instance = useId();
  const { gifsEnabled, loopAnimations } = useAnimationPreferences();
  const playback = useMemo(
    () => `?plays=${loopAnimations ? "infinite" : "3"}&session=${playbackSession}-${encodeURIComponent(instance)}-${gifsEnabled ? ++playbackSequence : "disabled"}`,
    [gifsEnabled, loopAnimations, instance],
  );
  if (!gifsEnabled) return <>{fallback}</>;
  const source = `/assets/savings-${asset}`;
  const suffix = loopAnimations ? "-loop" : "";
  return (
    <picture className="block h-[45px] w-[45px] shrink-0" aria-hidden="true">
      <source type="image/webp" srcSet={`${source}-72${suffix}.webp${playback} 1x, ${source}-144${suffix}.webp${playback} 2x, ${source}-216${suffix}.webp${playback} 3x`} />
      <img src={`${source}${suffix}.gif${playback}`} alt="" width={45} height={45} className="h-[45px] w-[45px] max-w-none object-contain" draggable={false} />
    </picture>
  );
}
