import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PROVIDERS } from "@/components/settings/notifications/config";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { notificationsService } from "@/services/notifications";
import type { NotificationsConfig } from "@/types";

export function NotificationsTab() {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const config = useQuery({
    queryKey: queryKeys.notificationsConfig(user?.id ?? ""),
    queryFn: () => notificationsService.getConfig(user!.id),
    enabled: !!user?.id,
  });
  const save = useMutation({
    mutationFn: (data: Partial<NotificationsConfig>) =>
      config.data?.id
        ? notificationsService.updateConfig(config.data.id, data)
        : notificationsService.createConfig({ ...data, user: user!.id }),
    onSuccess: (record) => {
      qc.setQueryData(queryKeys.notificationsConfig(user?.id ?? ""), record);
      toast.success(t("saved"));
    },
    onError: (error: Error) => toast.error(t(error.message, { defaultValue: t("error") })),
  });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t("notification_channels")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("admin_channels_personal_hint")}
        </p>
      </div>
      {config.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("loading")}
        </p>
      )}
      {config.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("admin_config_load_error")}
        </p>
      )}
      {PROVIDERS.map((provider) => {
        const available = !!config.data?.available_channels?.[provider.id];
        const checked = !!config.data?.[provider.enabledKey];
        const Icon = provider.icon;
        return (
          <div
            key={provider.id}
            className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={
                  checked
                    ? "rounded-xl bg-primary p-2 text-primary-foreground"
                    : "rounded-xl bg-muted/50 p-2 text-muted-foreground"
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {provider.id === "email" ? t("email") : provider.label}
                </p>
                {!isAdmin && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(available ? "admin_channel_ready" : "admin_channel_waiting")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {isAdmin && config.isSuccess && !available && (
                <Button
                  asChild
                  variant="outline"
                  className="h-7 gap-1.5 rounded-lg border-primary/40 bg-primary/10 px-2.5 text-xs"
                >
                  <Link
                    to="/admin"
                    search={{ tab: "channels" }}
                    aria-label={`${provider.label}: ${t("admin_channel_configure")}`}
                  >
                    <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("admin_channel_configure")}
                  </Link>
                </Button>
              )}
              <Switch
                aria-label={provider.label}
                checked={checked}
                disabled={
                  save.isPending || config.isPending || config.isError || (!available && !checked)
                }
                onCheckedChange={(enabled) => save.mutate({ [provider.enabledKey]: enabled })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
