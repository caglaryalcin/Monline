import { useTranslation } from "react-i18next";

import { DISPLAY_TOGGLES, type DisplayKey } from "@/components/settings/display/display.config";
import { DisplayToggleCard } from "@/components/settings/display/DisplayToggleCard";
import { useUserSettingsMutation } from "@/components/settings/shared/useUserSettingsMutation";
import { useAuth } from "@/contexts/AuthContext";

export function DisplayTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const mut = useUserSettingsMutation();

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
            label={t(labelKey)}
            description={t(descriptionKey)}
            onToggle={() => toggleField(key)}
          />
        ))}
      </div>
    </div>
  );
}
