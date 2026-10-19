import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { COLOR_PRESETS } from "@/lib/color-presets";

interface AccentColorSelectorProps {
  activeColor: string;
  onSelect: (value: string) => void;
}

export function AccentColorSelector({ activeColor, onSelect }: AccentColorSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-base font-semibold">{t("accent_color")}</Label>
        <p className="text-sm text-muted-foreground mt-1">{t("accent_color_desc")}</p>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-y-3 gap-x-2 justify-items-center">
        {COLOR_PRESETS.map((preset) => {
          const isActive = activeColor === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              onClick={() => onSelect(preset.id)}
              aria-pressed={isActive}
              className="flex flex-col items-center gap-1.5 group w-full"
            >
              <span
                className="h-8 w-8 rounded-full flex items-center justify-center transition-transform duration-150 mx-auto"
                style={{
                  backgroundColor: preset.hex,
                  outline: isActive ? `3px solid ${preset.hex}` : "3px solid transparent",
                  outlineOffset: "3px",
                }}
              >
                {isActive && (
                  <span className="rounded-full bg-foreground p-0.5 text-background">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] leading-tight text-center transition-colors truncate w-full ${isActive ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}
              >
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
