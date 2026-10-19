import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { DEFAULT_REMINDERS, PROVIDERS } from "@/components/settings/notifications/config";
import { ProviderCard } from "@/components/settings/notifications/ProviderCard";
import { RemindersEditor } from "@/components/settings/notifications/RemindersEditor";
import { SMTPTab } from "@/components/settings/smtp/SMTPTab";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LS_KEYS } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { notificationsService } from "@/services/notifications";
import type { NotificationReminder, NotificationsConfig } from "@/types";

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

export function NotificationsTab() {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: queryKeys.notificationsConfig(user?.id ?? ""),
    queryFn: () => notificationsService.getConfig(user!.id),
    enabled: !!user?.id,
  });

  const [formData, setFormData] = useState<Partial<NotificationsConfig>>({});
  const [reminders, setReminders] = useState<NotificationReminder[]>(DEFAULT_REMINDERS);

  useEffect(() => {
    if (config) {
      setFormData(config);
      setReminders(
        Array.isArray(config.reminders) && config.reminders.length > 0
          ? config.reminders
          : DEFAULT_REMINDERS,
      );
    }
  }, [config]);

  const handleChange = (key: keyof NotificationsConfig, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const data = { ...formData, reminders, user: user?.id };
      if (config?.id) {
        return notificationsService.updateConfig(config.id, data);
      } else {
        return notificationsService.createConfig(data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notificationsConfig(user?.id ?? "") });
      toast.success(t("success_save", "Saved successfully"));
    },
    onError: () => toast.error(t("error_save", "Error saving")),
  });

  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const handleTest = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const provider = PROVIDERS.find((item) => item.id === providerId)!;
      const draft = Object.fromEntries(
        provider.fields.map(({ key }) => [key, formData[key] ?? ""]),
      );
      await notificationsService.test(providerId, draft);
      toast.success(t("notification_sent", "Test notification sent!"));
    } catch {
      toast.error(t("error_sending_notification", "Error sending notification"));
    } finally {
      setTestingProvider(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl bg-muted/30 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-2xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const enabledCount = PROVIDERS.filter((p) => !!formData[p.enabledKey]).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Reminder schedule */}
      {enabledCount > 0 && <RemindersEditor reminders={reminders} onChange={setReminders} />}

      {/* Channels section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t("notification_channels", "Channels")}
          </p>
          {enabledCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {enabledCount} {t("enabled", "enabled")}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {[...PROVIDERS]
            .sort((a, b) => {
              const aOn = !!formData[a.enabledKey];
              const bOn = !!formData[b.enabledKey];
              return aOn === bOn ? 0 : aOn ? -1 : 1;
            })
            .map((provider) => (
              <ProviderCard
                key={`${user?.id}:${provider.id}`}
                disclosureStorageKey={
                  user?.id ? LS_KEYS.notificationDisclosure(user.id, provider.id) : undefined
                }
                provider={
                  provider.id === "email"
                    ? { ...provider, label: `${t("email")} (SMTP)` }
                    : provider
                }
                formData={formData}
                onChange={handleChange}
                onTest={() => handleTest(provider.id)}
                isTesting={testingProvider === provider.id}
                allowConfigureDisabled={provider.id === "email" && isAdmin}
              >
                {provider.id === "email" && isAdmin && <SMTPTab inline />}
              </ProviderCard>
            ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pb-12">
        <Button
          size="lg"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="rounded-xl shadow-lg shadow-primary/20 min-w-32"
        >
          <Save className="w-5 h-5 mr-2" />
          {saveMut.isPending ? t("saving", "Saving…") : t("save", "Save Changes")}
        </Button>
      </div>
    </div>
  );
}
