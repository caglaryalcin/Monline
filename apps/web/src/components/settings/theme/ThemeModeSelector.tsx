import { useTranslation } from "react-i18next";

import { THEME_MODES } from "@/components/settings/theme/theme.config";
import { Label } from "@/components/ui/label";

interface ThemeModeSelectorProps {
  activeMode?: number;
  onSelect: (value: number) => void;
}

export function ThemeModeSelector({ activeMode, onSelect }: ThemeModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">{t("color_scheme")}</Label>
      <p className="text-sm text-muted-foreground">{t("color_scheme_desc")}</p>
      <div className="grid grid-cols-3 gap-3">
        {THEME_MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.value;

          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onSelect(mode.value)}
              aria-pressed={isActive}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors duration-200 sm:flex-row ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                  : "bg-muted/50 "
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {t(mode.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
