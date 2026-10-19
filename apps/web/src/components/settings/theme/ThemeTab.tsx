import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DisplayTab } from "@/components/settings/display/DisplayTab";
import { useUserSettingsMutation } from "@/components/settings/shared/useUserSettingsMutation";
import { AccentColorSelector } from "@/components/settings/theme/AccentColorSelector";
import { ThemeModeSelector } from "@/components/settings/theme/ThemeModeSelector";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { buildColorCSS, getPreset, saveColorToStorage, storedColor } from "@/lib/color-presets";

export function ThemeTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const mut = useUserSettingsMutation();

  // Optimistic: use user's saved color, fallback to localStorage, fallback to default
  const [activeColor, setActiveColor] = useState<string>(
    () => getPreset(user?.color_theme ?? storedColor()).id,
  );

  function applyColor(id: string) {
    setActiveColor(id);
    saveColorToStorage(id);
    // Immediately update the CSS so the whole app reflects the change
    let el = document.getElementById("color-theme") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "color-theme";
      document.head.appendChild(el);
    }
    el.textContent = buildColorCSS(getPreset(id));
    mut.mutate({ color_theme: id });
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-5">
        <ThemeModeSelector
          activeMode={user?.dark_theme_mode}
          onSelect={(value) => mut.mutate({ dark_theme_mode: value })}
        />

        <Separator />

        <AccentColorSelector activeColor={activeColor} onSelect={applyColor} />

        <Separator />

        {/* Custom CSS */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">{t("custom_css")}</Label>
          <p className="text-sm text-muted-foreground">{t("custom_css_desc")}</p>
          <Textarea
            rows={4}
            defaultValue={user?.custom_css ?? ""}
            onBlur={(e) => mut.mutate({ custom_css: e.target.value })}
            placeholder={`/* custom styles */\n\n.my-element {\n  color: red;\n}`}
            className="min-h-28 font-mono text-sm bg-muted/30 text-foreground rounded-xl border-border resize-y"
          />
        </div>
        <Separator />
        <section className="space-y-3" aria-labelledby="display-options-heading">
          <h3 id="display-options-heading" className="text-base font-semibold">
            {t("display_options")}
          </h3>
          <DisplayTab />
        </section>
      </div>
    </div>
  );
}
