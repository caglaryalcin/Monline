import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FixerApiKeyFieldProps {
  apiKey: string;
  apiKeyConfigured: boolean;
  removeStoredApiKey: boolean;
  onApiKeyChange: (value: string) => void;
  onRemoveStoredApiKey: () => void;
}

export function FixerApiKeyField({
  apiKey,
  apiKeyConfigured,
  removeStoredApiKey,
  onApiKeyChange,
  onRemoveStoredApiKey,
}: FixerApiKeyFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{t("fixer_api_key")}</label>
        {apiKeyConfigured && !removeStoredApiKey && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive/70 "
            onClick={onRemoveStoredApiKey}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            {t("remove")}
          </Button>
        )}
      </div>

      <Input
        type="password"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        placeholder={
          apiKeyConfigured && !removeStoredApiKey
            ? "••••••••••••••••"
            : "••••••••••••••••"
        }
        className="rounded-xl"
      />

      <p className="text-xs text-muted-foreground">
        {removeStoredApiKey
          ? `${t("fixer_api_key")} ${t("remove")}. ${t("save")}.`
          : apiKeyConfigured
            ? `${t("saved")}.`
            : ""}
      </p>

    </div>
  );
}
