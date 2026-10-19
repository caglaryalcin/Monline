import { COLOR_PRESETS } from "./color-presets";
import { accentForeground, contrastRatio, readableAccent } from "./colorContrast";

describe("theme contrast", () => {
  it("keeps accent text readable in both modes for every available preset", () => {
    for (const preset of COLOR_PRESETS) {
      expect(
        contrastRatio(readableAccent(preset.light, false), "50 21% 95%"),
        `${preset.id} light`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(readableAccent(preset.dark, true), "90 5% 19%"),
        `${preset.id} dark`,
      ).toBeGreaterThanOrEqual(4.5);
      for (const color of [preset.light, preset.dark])
        expect(
          contrastRatio(color, accentForeground(color)),
          `${preset.id} button`,
        ).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("retains a bright decorative accent without making heading text fluorescent", () => {
    expect(readableAccent("76 100% 70%", false)).not.toBe("76 100% 70%");
    expect(contrastRatio("0 0% 0%", "0 0% 100%")).toBe(21);
  });
});
