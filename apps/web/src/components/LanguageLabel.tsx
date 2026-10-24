import { type ReactNode, useId } from "react";

const star = "m0-1 .224.691h.727l-.588.427.225.691L0 .382l-.588.427.225-.691-.588-.427h.727Z";

function Stripes({ colors, vertical = false }: { colors: string[]; vertical?: boolean }) {
  return colors.map((fill, index) => (
    <rect
      key={index}
      x={vertical ? (24 * index) / colors.length : 0}
      y={vertical ? 0 : (16 * index) / colors.length}
      width={vertical ? 24 / colors.length : 24}
      height={vertical ? 16 : 16 / colors.length}
      fill={fill}
    />
  ));
}

// Local SVG artwork keeps flags consistent across platforms, including offline installations.
const flags: Record<string, ReactNode> = {
  en: (
    <>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#c8102e" strokeWidth="1.7" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" />
      <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="2.6" />
    </>
  ),
  pt: (
    <>
      <rect width="24" height="16" fill="#009739" />
      <path d="m12 1.5 10 6.5-10 6.5L2 8Z" fill="#ffdf00" />
      <circle cx="12" cy="8" r="4.2" fill="#002776" />
      <path d="M8 6.8c2.6-.5 5.8.5 8 2.3" fill="none" stroke="#fff" strokeWidth=".8" />
    </>
  ),
  de: <Stripes colors={["#151515", "#dd0000", "#ffce00"]} />,
  es: (
    <>
      <rect width="24" height="16" fill="#aa151b" />
      <rect y="4" width="24" height="8" fill="#f1bf00" />
      <path d="M6 6h3v3c0 2-3 2-3 0Z" fill="#aa151b" />
      <path d="M7.5 6v4M6 8h3" stroke="#f1bf00" strokeWidth=".6" />
      <path d="M5 6v4m5-4v4" stroke="#fff" strokeWidth=".6" />
      <path d="M6 5h3" stroke="#aa151b" strokeWidth="1" />
    </>
  ),
  fr: <Stripes colors={["#002654", "#fff", "#ed2939"]} vertical />,
  it: <Stripes colors={["#009246", "#fff", "#ce2b37"]} vertical />,
  nl: <Stripes colors={["#ae1c28", "#fff", "#21468b"]} />,
  pl: <Stripes colors={["#fff", "#dc143c"]} />,
  ru: <Stripes colors={["#fff", "#0039a6", "#d52b1e"]} />,
  zh: (
    <>
      <rect width="24" height="16" fill="#de2910" />
      <g fill="#ffde00">
        <path d={star} transform="translate(4 4) scale(2.1)" />
        <path d={star} transform="translate(7.5 1.7) rotate(23) scale(.7)" />
        <path d={star} transform="translate(9 3.5) rotate(45) scale(.7)" />
        <path d={star} transform="translate(9 5.7) scale(.7)" />
        <path d={star} transform="translate(7.5 7.3) rotate(23) scale(.7)" />
      </g>
    </>
  ),
  ja: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <circle cx="12" cy="8" r="4.8" fill="#bc002d" />
    </>
  ),
  ko: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <g transform="rotate(33.69 12 8)">
        <circle cx="12" cy="8" r="4" fill="#cd2e3a" />
        <path d="M8 8a4 4 0 0 0 8 0 2 2 0 0 0-4 0 2 2 0 0 1-4 0" fill="#0047a0" />
        <path
          d="M5 5.5v5M3.8 5.5v5M2.6 5.5v5M19 5.5v2m0 1v2m1.2-5v2m0 1v2m1.2-5v2m0 1v2"
          stroke="#000"
          strokeWidth=".7"
        />
      </g>
      <g transform="rotate(-33.69 12 8)" stroke="#000" strokeWidth=".7">
        <path d="M5 5.5v2m0 1v2M3.8 5.5v5M2.6 5.5v2m0 1v2M19 5.5v5m1.2-5v2m0 1v2m1.2-5v5" />
      </g>
    </>
  ),
  tr: (
    <>
      <rect width="24" height="16" fill="#e30a17" />
      <circle cx="9.2" cy="8" r="4.2" fill="#fff" />
      <circle cx="10.8" cy="7.5" r="3.35" fill="#e30a17" />
      <path d={star} transform="translate(16.4 8) rotate(-18) scale(2.6)" fill="#fff" />
    </>
  ),
  uk: <Stripes colors={["#0057b7", "#ffd700"]} />,
  cs: (
    <>
      <Stripes colors={["#fff", "#d7141a"]} />
      <path d="m0 0 12 8L0 16Z" fill="#11457e" />
    </>
  ),
  da: (
    <>
      <rect width="24" height="16" fill="#c8102e" />
      <path d="M8 0v16M0 8h24" stroke="#fff" strokeWidth="2.5" />
    </>
  ),
  bg: <Stripes colors={["#fff", "#00966e", "#d62612"]} />,
};

function LanguageFlag({ code }: { code: string }) {
  const clipId = useId();
  const artwork = flags[code.toLowerCase().split(/[-_]/)[0]];
  if (!artwork) return null;

  return (
    <svg
      className="h-4 w-6 shrink-0 overflow-hidden rounded-[3px]"
      viewBox="0 0 24 16"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect width="24" height="16" rx="2.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{artwork}</g>
      <rect
        x=".35"
        y=".35"
        width="23.3"
        height="15.3"
        rx="2.2"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".18"
        strokeWidth=".7"
      />
    </svg>
  );
}

export function LanguageLabel({ code, name }: { code: string; name: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2.5 align-middle">
      <LanguageFlag code={code} />
      <span lang={code.replace("_", "-")} className="truncate">
        {name}
      </span>
    </span>
  );
}
