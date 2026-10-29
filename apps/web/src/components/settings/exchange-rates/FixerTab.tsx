import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FIXER_PROVIDER_LINKS } from "@/components/settings/exchange-rates/fixer.constants";
import { FixerActions } from "@/components/settings/exchange-rates/FixerActions";
import { FixerApiKeyField } from "@/components/settings/exchange-rates/FixerApiKeyField";
import { FixerProviderSelect } from "@/components/settings/exchange-rates/FixerProviderSelect";
import { toast } from "@/lib/toast";
import { fixerService } from "@/services/fixer";
import type { FixerSettings } from "@/types";

export function FixerTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [apiKey, setApiKey] = useState("");
  const [removeStoredApiKey, setRemoveStoredApiKey] = useState(false);
  const [provider, setProvider] = useState<"fixer" | "apilayer">("fixer");

  const {
    data: settings,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["admin-exchange"],
    queryFn: () => fixerService.getSettings(),
  });

  // Derived state: is there a key saved on the server?
  const isKeySavedOnServer = settings?.api_key_configured ?? false;

  useEffect(() => {
    if (settings) {
      setApiKey("");
      setRemoveStoredApiKey(false);
      setProvider(settings.provider || "fixer");
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () => {
      const trimmedApiKey = apiKey.trim();
      const hasEffectiveApiKey =
        !removeStoredApiKey && (trimmedApiKey.length > 0 || isKeySavedOnServer);

      const payload: Partial<FixerSettings> = {
        provider,
        enabled: hasEffectiveApiKey,
      };

      // API Key Logic:
      // 1. Explicitly requested removal
      if (removeStoredApiKey) {
        payload.api_key = "";
      }
      // 2. User typed a new key
      else if (trimmedApiKey) {
        payload.api_key = trimmedApiKey;
      }
      // 3. Updating an existing record where no key is currently saved
      else if (!isKeySavedOnServer) {
        payload.api_key = "";
      }
      // 4. Otherwise (isKeySavedOnServer === true and trimmedApiKey is empty):
      //    Do NOT include api_key in 'payload' so the server keeps the existing value.
      // api_key_configured is derived server-side (security.client.js) from api_key.

      return fixerService.saveSettings(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-exchange"] });
      qc.invalidateQueries({ queryKey: ["exchange-status"] });
      setApiKey("");
      setRemoveStoredApiKey(false);
      toast.success(t("success_update"));
    },
    onError: () => toast.error(t("error")),
  });

  const updateRatesMut = useMutation({
    mutationFn: () => fixerService.updateAllRates(),
    onSuccess: (data) => {
      qc.invalidateQueries();
      toast.success(t("exchange_rates_updated", { updatedCount: data.updated }));
    },
    onError: (err: Error) => toast.error(err.message || t("error")),
  });

  const canSave = removeStoredApiKey || apiKey.trim().length > 0 || isKeySavedOnServer;
  const canUpdateRates = !removeStoredApiKey && (isKeySavedOnServer || apiKey.trim().length > 0);

  if (isPending) return <p role="status">{t("loading")}</p>;
  if (isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        {t("admin_config_load_error")}
      </p>
    );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-6 ">
        <FixerProviderSelect provider={provider} onProviderChange={setProvider} />

        <FixerApiKeyField
          apiKey={apiKey}
          apiKeyConfigured={isKeySavedOnServer}
          provider={provider}
          providerLink={FIXER_PROVIDER_LINKS[provider]}
          removeStoredApiKey={removeStoredApiKey}
          onApiKeyChange={(value) => {
            setApiKey(value);
            setRemoveStoredApiKey(false);
          }}
          onRemoveStoredApiKey={() => {
            setApiKey("");
            setRemoveStoredApiKey(true);
          }}
        />

        <FixerActions
          canSave={canSave}
          canUpdateRates={canUpdateRates}
          saving={saveMut.isPending}
          updatingRates={updateRatesMut.isPending}
          onSave={() => saveMut.mutate()}
          onUpdateRates={() => updateRatesMut.mutate()}
        />

        {isKeySavedOnServer && !removeStoredApiKey && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
            {t("fixer_configured_hint")}
          </p>
        )}
      </div>
    </div>
  );
}
