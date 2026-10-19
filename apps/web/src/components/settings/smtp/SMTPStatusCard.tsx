import { useTranslation } from "react-i18next";

import { FeatureToggleCard } from "@/components/ui/FeatureToggleCard";

interface SMTPStatusCardProps {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SMTPStatusCard({ enabled, onEnabledChange, disabled }: SMTPStatusCardProps) {
  const { t } = useTranslation();

  return (
    <FeatureToggleCard
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      disabled={disabled}
      description={t("smtp_enable_description")}
    />
  );
}
