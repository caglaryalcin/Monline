import { useId } from "react";

// Restart after reload or remount, but keep playback stable during React updates.
const playbackSession = Date.now().toString(36);

export function FinanceAnimationIcon({ asset }: { asset: "credit-card" | "loans" | "price-tag" | "receipt" }) {
  const instance = useId();
  const source = `/assets/savings-${asset}`;
  const playback = `?plays=3&session=${playbackSession}-${encodeURIComponent(instance)}`;
  return (
    <picture className="block h-[45px] w-[45px] shrink-0" aria-hidden="true">
      <source type="image/webp" srcSet={`${source}-72.webp${playback} 1x, ${source}-144.webp${playback} 2x, ${source}-216.webp${playback} 3x`} />
      <img src={`${source}.gif${playback}`} alt="" width={45} height={45} className="h-[45px] w-[45px] max-w-none object-contain" draggable={false} />
    </picture>
  );
}
