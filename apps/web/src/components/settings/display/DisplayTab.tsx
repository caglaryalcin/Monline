import { useTranslation } from "react-i18next";

import { DISPLAY_TOGGLES, type DisplayKey } from "@/components/settings/display/display.config";
import { DisplayToggleCard } from "@/components/settings/display/DisplayToggleCard";
import { useUserSettingsMutation } from "@/components/settings/shared/useUserSettingsMutation";
import { useAuth } from "@/contexts/AuthContext";
import { useAnimationPreferences } from "@/hooks/useAnimationPreferences";

export function DisplayTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const mut = useUserSettingsMutation();
  const { gifsEnabled, loopAnimations } = useAnimationPreferences();

  const toggleField = (key: DisplayKey) => {
    mut.mutate({ [key]: !user?.[key as keyof typeof user] });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="settings-display-grid">
        {DISPLAY_TOGGLES.map(({ key, labelKey, descriptionKey }) => (
          <DisplayToggleCard
            key={key}
            checked={!!user?.[key as keyof typeof user]}
            disabled={mut.isPending}
            label={t(labelKey)}
            description={t(descriptionKey)}
            onToggle={() => toggleField(key)}
          />
        ))}
        <div className="space-y-3 [&>div]:h-auto">
          <DisplayToggleCard
            checked={gifsEnabled}
            disabled={mut.isPending}
            label={t("use_gifs")}
            description={t("use_gifs_desc")}
            onToggle={() => mut.mutate({ disable_gifs: gifsEnabled })}
          />
          {gifsEnabled && (
            <div className="ml-4 border-l border-border pl-4">
              <DisplayToggleCard
                checked={loopAnimations}
                disabled={mut.isPending}
                label={t("loop_gifs")}
                description={t("loop_gifs_desc")}
                onToggle={() => mut.mutate({ loop_gifs: !loopAnimations })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
