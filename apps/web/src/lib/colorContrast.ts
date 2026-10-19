function luminance(hsl: string): number {
  const [h, s, l] = hsl.split(/\s+/).map((value) => parseFloat(value));
  const saturation = s / 100;
  const lightness = l / 100;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (offset: number) => {
    const k = (offset + h / 30) % 12;
    const value = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
}

export function contrastRatio(first: string, second: string): number {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Keep decorative accent colors, while making accent text readable on surfaces. */
export function readableAccent(hsl: string, dark: boolean): string {
  const [h, s, initial] = hsl.split(/\s+/).map((value) => parseFloat(value));
  let lightness = initial;
  const background = dark ? "90 5% 19%" : "50 21% 95%";
  while (
    lightness > 0 &&
    lightness < 100 &&
    contrastRatio(`${h} ${s}% ${lightness}%`, background) < 4.5
  ) {
    lightness = Math.max(0, Math.min(100, lightness + (dark ? 1 : -1)));
  }
  return `${h} ${s}% ${lightness}%`;
}

export function accentForeground(hsl: string): string {
  const dark = "222.2 47.4% 11.2%",
    light = "210 40% 98%";
  if (Math.max(contrastRatio(hsl, dark), contrastRatio(hsl, light)) >= 4.5) {
    return contrastRatio(hsl, dark) > contrastRatio(hsl, light) ? dark : light;
  }
  return contrastRatio(hsl, "0 0% 0%") > contrastRatio(hsl, "0 0% 100%") ? "0 0% 0%" : "0 0% 100%";
}
