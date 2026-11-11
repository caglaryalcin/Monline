import { useId } from "react";

// A fresh image URL restarts finite animations after reload or remount.
// Keep it stable during ordinary React updates so the animation stays stopped.
const playbackSession = Date.now().toString(36);

export function FinanceAnimationIcon({
  asset,
}: {
  asset: "banknote" | "credit-card" | "dollar" | "euro" | "gold" | "loans" | "raise" | "receipt" | "wallet";
}) {
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
