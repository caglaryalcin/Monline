import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DEFAULT_REMINDERS, PROVIDERS } from "@/components/settings/notifications/config";
import { RemindersEditor } from "@/components/settings/notifications/RemindersEditor";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { notificationsService } from "@/services/notifications";
import type { NotificationReminder, NotificationsConfig } from "@/types";

export function PersonalNotificationSettings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const cache = useQueryClient();
  const queryKey = queryKeys.notificationsConfig(user?.id ?? "");
  const query = useQuery({ queryKey, queryFn: notificationsService.getPersonalConfig, enabled: !!user });
  const [reminders, setReminders] = useState<NotificationReminder[]>(DEFAULT_REMINDERS);
  const hydrated = useRef(false);
  useEffect(() => {
    if (query.data && !hydrated.current) {
      hydrated.current = true;
      setReminders(query.data.reminders?.length ? query.data.reminders : DEFAULT_REMINDERS);
    }
  }, [query.data]);
  const save = useMutation({
    mutationFn: notificationsService.savePersonalConfig,
    onSuccess: data => { cache.setQueryData(queryKey, data); toast.success(t("saved")); },
    onError: (error: Error) => toast.error(t(error.message, { defaultValue: t("error") })),
  });
  if (query.isPending) return <p role="status">{t("loading")}</p>;
  if (query.isError) return <p role="alert" className="text-sm text-destructive">{t("admin_config_load_error")}</p>;
  return (
    <div className="space-y-4">
      <RemindersEditor reminders={reminders} onChange={setReminders} onSave={() => save.mutate({ reminders })}
        isSaving={save.isPending && !!save.variables?.reminders} saveDisabled={save.isPending || !reminders.length}
        maxReminders={50} />
      <div className="grid gap-3 md:grid-cols-2">
        {PROVIDERS.map(provider => {
          const available = !!query.data.available_channels?.[provider.id];
          const checked = !!query.data[provider.enabledKey];
          const Icon = provider.icon;
          return (
            <div key={provider.id} className={`flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 ${checked ? "settings-active-highlight" : ""}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className={"shrink-0 rounded-xl p-2 " + provider.bgClass + " " + provider.colorClass}>
                  {provider.logo ? <img src={provider.logo} alt="" className="h-5 w-5 object-contain" />
                    : <Icon className="h-5 w-5" aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{provider.id === "email" ? t("email") : provider.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t(available ? "admin_channel_ready" : "admin_channel_waiting")}</p>
                </div>
              </div>
              <Switch aria-label={provider.label} checked={checked} disabled={save.isPending || (!available && !checked)}
                onCheckedChange={enabled => save.mutate({ [provider.enabledKey]: enabled } as Partial<NotificationsConfig>)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
