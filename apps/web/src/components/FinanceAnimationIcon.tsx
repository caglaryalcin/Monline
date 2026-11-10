export function FinanceAnimationIcon({ asset }: { asset: "credit-card" | "loans" | "price-tag" | "receipt" }) {
  const source = `/assets/savings-${asset}`;
  return (
    <picture className="block h-[45px] w-[45px] shrink-0" aria-hidden="true">
      <source type="image/webp" srcSet={`${source}-72.webp 1x, ${source}-144.webp 2x, ${source}-216.webp 3x`} />
      <img src={`${source}.gif`} alt="" width={45} height={45} className="h-[45px] w-[45px] max-w-none object-contain" draggable={false} />
    </picture>
  );
}
