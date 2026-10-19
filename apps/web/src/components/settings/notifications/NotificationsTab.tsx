import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DEFAULT_REMINDERS, PROVIDERS } from "@/components/settings/notifications/config";
import { ProviderCard } from "@/components/settings/notifications/ProviderCard";
import { RemindersEditor } from "@/components/settings/notifications/RemindersEditor";
import { SMTPTab, type SMTPTabHandle } from "@/components/settings/smtp/SMTPTab";
import { useAuth } from "@/contexts/AuthContext";
import { LS_KEYS } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { notificationsService } from "@/services/notifications";
import { serverSettingsService } from "@/services/serverSettings";
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
  const hydratedUser = useRef<string | null>(null);
  const smtpForm = useRef<SMTPTabHandle>(null);

  const smtpQuery = useQuery({
    queryKey: queryKeys.admin.smtp(),
    queryFn: serverSettingsService.getSmtp,
    enabled: isAdmin,
  });

  useEffect(() => {
    if (
      !isLoading &&
      !(isAdmin && smtpQuery.isPending) &&
      hydratedUser.current !== (user?.id ?? "")
    ) {
      hydratedUser.current = user?.id ?? "";
      setFormData(
        isAdmin
          ? {
              ...config,
              email_enabled: !!config?.email_enabled && !!smtpQuery.data?.enabled,
            }
          : (config ?? {}),
      );
      setReminders(
        Array.isArray(config?.reminders) && config.reminders.length > 0
          ? config.reminders
          : DEFAULT_REMINDERS,
      );
    }
  }, [config, isLoading, isAdmin, smtpQuery.isPending, smtpQuery.data, user?.id]);

  const handleChange = (key: keyof NotificationsConfig, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const saveMut = useMutation({
    mutationFn: async ({
      section,
      data,
    }: {
      section: string;
      data: Partial<NotificationsConfig>;
    }) => {
      if (!user?.id) throw new Error("Authentication required");
      let smtpSettings: Record<string, unknown> | undefined;
      if (section === "email" && isAdmin) {
        if (!smtpForm.current) throw new Error("SMTP settings are unavailable");
        smtpSettings = await smtpForm.current.save();
      }
      const record = config?.id
        ? await notificationsService.updateConfig(config.id, data)
        : await notificationsService.createConfig({ ...data, user: user.id });
      return { record, smtpSettings };
    },
    onSuccess: ({ record, smtpSettings }) => {
      // Keep other cards' drafts intact and reuse the first created record.
      qc.setQueryData(queryKeys.notificationsConfig(user?.id ?? ""), record);
      if (smtpSettings) qc.setQueryData(queryKeys.admin.smtp(), smtpSettings);
      toast.success(t("success_save", "Saved successfully"));
    },
    onError: () => toast.error(t("error_save", "Error saving")),
  });

  const handleSave = (section: string) => {
    if (saveMut.isPending) return;
    if (section === "reminders") {
      saveMut.mutate({ section, data: { reminders } });
      return;
    }
    const provider = PROVIDERS.find((item) => item.id === section)!;
    const data = Object.fromEntries([
      [provider.enabledKey, !!formData[provider.enabledKey]],
      ...provider.fields.map(({ key }) => [key, formData[key] ?? ""]),
    ]);
    saveMut.mutate({ section, data });
  };

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

  if (isLoading || (isAdmin && smtpQuery.isPending)) {
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
      {enabledCount > 0 && (
        <RemindersEditor
          reminders={reminders}
          onChange={setReminders}
          onSave={() => handleSave("reminders")}
          isSaving={saveMut.isPending && saveMut.variables?.section === "reminders"}
          saveDisabled={saveMut.isPending}
        />
      )}

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
                onSave={() => handleSave(provider.id)}
                isSaving={saveMut.isPending && saveMut.variables?.section === provider.id}
                saveDisabled={
                  saveMut.isPending ||
                  !user?.id ||
                  (provider.id === "email" && isAdmin && smtpQuery.isError)
                }
                onTest={() => handleTest(provider.id)}
                isTesting={testingProvider === provider.id}
                toggleDisabled={
                  saveMut.isPending || (provider.id === "email" && isAdmin && smtpQuery.isError)
                }
              >
                {provider.id === "email" && isAdmin && (
                  <SMTPTab
                    ref={smtpForm}
                    inline
                    channelEnabled={!!formData.email_enabled}
                    isSaving={saveMut.isPending}
                  />
                )}
              </ProviderCard>
            ))}
        </div>
      </div>
    </div>
  );
}
