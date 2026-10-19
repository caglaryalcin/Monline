import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { OIDC_FIELDS } from "@/components/settings/oidc/oidc.config";
import { OIDCSecretField } from "@/components/settings/oidc/OIDCSecretField";
import { FeatureToggleCard } from "@/components/ui/FeatureToggleCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { serverSettingsService } from "@/services/serverSettings";
import type { AdminSettings } from "@/types";

export function OIDCTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [secretValue, setSecretValue] = useState("");
  const [secretConfigured, setSecretConfigured] = useState(false);

  const { data: settings } = useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: () => serverSettingsService.getSettings(),
  });

  const save = useMutation({
    mutationFn: (data: Partial<AdminSettings>) => serverSettingsService.updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.settings() });
      toast.success(t("saved"));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("error")),
  });

  useEffect(() => {
    setSecretValue("");
    setSecretConfigured(!!settings?.oidc_client_secret_configured);
  }, [settings?.id, settings?.oidc_client_secret_configured]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-6">
        <FeatureToggleCard
          enabled={!!settings?.oidc_enabled}
          onEnabledChange={(c) => save.mutate({ oidc_enabled: c })}
          disabled={!settings || save.isPending}
        />

        {settings?.oidc_enabled && (
          <>
            <Separator />

            <div className="space-y-4">
              <OIDCSecretField
                secretConfigured={secretConfigured}
                secretValue={secretValue}
                onSecretChange={setSecretValue}
                onRemove={() =>
                  save.mutate({
                    oidc_client_secret: "",
                    oidc_client_secret_configured: false,
                  })
                }
                onSave={(value) =>
                  save.mutate({
                    oidc_client_secret: value,
                    oidc_client_secret_configured: true,
                  })
                }
              />
              {OIDC_FIELDS.map(({ key, labelKey, placeholder }) => (
                <div key={key as string} className="grid gap-2">
                  <Label className="text-sm font-medium">{t(labelKey)}</Label>
                  <Input
                    defaultValue={String(settings?.[key] ?? "")}
                    onBlur={(e) => save.mutate({ [key]: e.target.value } as Partial<AdminSettings>)}
                    className="bg-muted/50 rounded-xl"
                    placeholder={
                      placeholder?.startsWith("http")
                        ? placeholder
                        : placeholder
                          ? t(placeholder)
                          : undefined
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
