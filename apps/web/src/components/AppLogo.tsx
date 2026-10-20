import { BRAND_ACCENT } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function LogoIcon({ className }: LogoProps) {
  return (
    <svg
      role="img"
      aria-label="Monline logo"
      viewBox="0 0 40 40"
      width={40}
      height={40}
      className={cn("inline-block shrink-0", className)}
    >
      <rect x="1" y="1" width="38" height="38" rx="12" fill={BRAND_ACCENT} />
      <path d="M10 28V13h4l6 9 6-9h4v15h-4V20l-6 8-6-8v8z" fill="#1b1d19" />
    </svg>
  );
}

export function LogoWithName({ className }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="Monline"
      className={cn(
        "inline-flex shrink-0 items-center gap-3 font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      <span aria-hidden="true" className="h-full shrink-0">
        <LogoIcon className="block h-full w-auto" />
      </span>
      <span aria-hidden="true" className="text-[1.5rem] leading-none">
        Monline<span className="text-[#9bbb47]">.</span>
      </span>
    </span>
  );
}
