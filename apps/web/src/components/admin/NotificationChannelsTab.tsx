import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { NotificationTemplateEditor } from "@/components/admin/NotificationTemplateEditor";
import { PROVIDERS } from "@/components/settings/notifications/config";
import { ProviderCard } from "@/components/settings/notifications/ProviderCard";
import { SMTPTab, type SMTPTabHandle } from "@/components/settings/smtp/SMTPTab";
import { useAuth } from "@/contexts/AuthContext";
import { LS_KEYS } from "@/lib/constants";
import { notificationLanguage } from "@/lib/languages";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { notificationsService } from "@/services/notifications";
import { serverSettingsService } from "@/services/serverSettings";
import type { NotificationEvent, NotificationsConfig } from "@/types";

const channelsKey = ["admin-channels"] as const;
const providers = PROVIDERS.map((provider) =>
  provider.id === "email"
    ? { ...provider, fields: [], hintKey: undefined }
    : provider,
);

export function NotificationChannelsTab() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const templateLanguage = notificationLanguage(user?.language || i18n.resolvedLanguage);
  const qc = useQueryClient();
  const smtpRef = useRef<SMTPTabHandle>(null);
  const smtp = useQuery({
    queryKey: queryKeys.admin.smtp(),
    queryFn: serverSettingsService.getSmtp,
  });
  const query = useQuery({
    queryKey: channelsKey,
    queryFn: () => notificationsService.getChannels(),
  });
  const [formData, setFormData] = useState<Partial<NotificationsConfig>>({});
  const channelEnabled = (id: string) => id === "email"
    ? !!smtp.data?.enabled : !!formData.enabled_channels?.[id];
  const templatesForProvider = (provider: string) => ({
    ...(notificationLanguage(formData.template_language) === templateLanguage
      ? formData.templates?.[provider]
      : undefined),
    ...formData.localized_templates?.[templateLanguage]?.[provider],
  });
  const hydrated = useRef(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [templateEvents, setTemplateEvents] = useState<Record<string, NotificationEvent>>({});
  useEffect(() => {
    if (query.isSuccess && !hydrated.current) {
      hydrated.current = true;
      setFormData(query.data ?? {});
    }
  }, [query.data, query.isSuccess]);
  const toggleSmtp = useMutation({
    mutationFn: (enabled: boolean) => serverSettingsService.updateSmtp({ enabled }),
    onSuccess: (_record, enabled) => {
      qc.setQueryData(queryKeys.admin.smtp(), (current: Record<string, unknown> | undefined) => ({
        ...current,
        enabled,
      }));
      qc.invalidateQueries({ queryKey: channelsKey });
      qc.invalidateQueries({ queryKey: ["notifications_config"] });
      toast.success(t("saved"));
    },
    onError: (error: Error) => toast.error(t(error.message, { defaultValue: t("error") })),
  });
  const save = useMutation({
    mutationFn: async ({
      section,
      data,
    }: {
      section: string;
      data: Partial<NotificationsConfig>;
    }) => {
      if (section === "email") {
        if (!smtpRef.current) throw new Error(t("admin_config_load_error"));
        await smtpRef.current.save();
      }
      return notificationsService.saveChannels(data);
    },
    onSuccess: (record) => {
      qc.setQueryData(channelsKey, record);
      qc.invalidateQueries({ queryKey: ["notifications_config"] });
      setFormData((current) => ({ ...current, available_channels: record.available_channels,
        enabled_channels: record.enabled_channels }));
      toast.success(t("saved"));
    },
    onError: (error: Error) => toast.error(t(error.message, { defaultValue: t("error") })),
  });
  const toggleChannel = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      notificationsService.saveChannels({ enabled_channels: { [id]: enabled } }),
    onSuccess: (record) => {
      qc.setQueryData(channelsKey, record);
      qc.invalidateQueries({ queryKey: ["notifications_config"] });
      setFormData((current) => ({ ...current, available_channels: record.available_channels,
        enabled_channels: record.enabled_channels }));
      toast.success(t("saved"));
    },
    onError: (error: Error) => toast.error(t(error.message, { defaultValue: t("error") })),
  });
  const saveSection = (section: string) => {
    if (save.isPending || !query.isSuccess) return;
    const provider = providers.find((item) => item.id === section)!;
    const data = Object.fromEntries(provider.fields.map(({ key }) => [key, formData[key] ?? ""]));
    save.mutate({
      section,
      data: {
        ...data,
        localized_templates: { [templateLanguage]: { [section]: templatesForProvider(section) } },
      },
    });
  };
  const test = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const provider = providers.find((item) => item.id === providerId)!;
      const draft = Object.fromEntries(
        provider.fields.map(({ key }) => [key, formData[key] ?? ""]),
      );
      await notificationsService.test(
        providerId,
        draft,
        undefined,
        { [providerId]: templatesForProvider(providerId) },
        templateEvents[providerId] ?? "payment",
        templateLanguage,
      );
      toast.success(t("notification_sent"));
    } catch (error) {
      toast.error(
        t(error instanceof Error ? error.message : "error_sending_notification", {
          defaultValue: t("error_sending_notification"),
        }),
      );
    } finally {
      setTestingProvider(null);
    }
  };
  if (query.isPending) return <p role="status">{t("loading")}</p>;
  if (query.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        {t("admin_config_load_error")}
      </p>
    );
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            disclosureStorageKey={LS_KEYS.notificationDisclosure("global", provider.id)}
            provider={{
              ...provider,
              label: provider.id === "email" ? `${t("email")} (SMTP)` : provider.label,
            }}
            configurationOnly
            formData={formData}
            configurationEnabled={channelEnabled(provider.id)}
            onConfigurationEnabledChange={
              provider.id === "email" ? (enabled) => toggleSmtp.mutate(enabled)
                : (enabled) => toggleChannel.mutate({ id: provider.id, enabled })
            }
            toggleDisabled={
              smtp.isPending ||
              smtp.isError ||
              save.isPending ||
              toggleSmtp.isPending ||
              toggleChannel.isPending ||
              testingProvider !== null
            }
            onChange={(key, value) => setFormData((current) => ({ ...current, [key]: value }))}
            onSave={() => saveSection(provider.id)}
            isSaving={(save.isPending && save.variables?.section === provider.id) ||
              (toggleChannel.isPending && toggleChannel.variables?.id === provider.id)}
            saveDisabled={
              save.isPending ||
              toggleSmtp.isPending ||
              toggleChannel.isPending ||
              (provider.id === "email" && (smtp.isPending || smtp.isError))
            }
            onTest={() => test(provider.id)}
            testDisabled={!channelEnabled(provider.id)}
            isTesting={testingProvider === provider.id}
          >
            <div className={provider.id === "email" ? "space-y-4" : ""}>
              {provider.id === "email" && (
                <section
                  aria-label={t("smtp_settings")}
                  className="min-w-0 space-y-4 rounded-xl border bg-muted/10 p-4 [&_h3]:text-sm"
                >
                  <h3 className="text-sm font-semibold">{t("smtp_settings")}</h3>
                  {smtp.isError && (
                    <p role="alert" className="text-xs text-destructive">
                      {t("admin_config_load_error")}
                    </p>
                  )}
                  <SMTPTab
                    ref={smtpRef}
                    inline
                    channelEnabled={!!smtp.data?.enabled}
                    isSaving={save.isPending || toggleSmtp.isPending || testingProvider === "email"}
                  />
                </section>
              )}
              <div
                className={
                  provider.id === "email" ? "min-w-0 rounded-xl border bg-muted/10 p-4" : ""
                }
              >
                <NotificationTemplateEditor
                  key={`${provider.id}-${templateLanguage}`}
                  providerId={provider.id}
                  language={templateLanguage}
                  event={templateEvents[provider.id] ?? "payment"}
                  onEventChange={(event) =>
                    setTemplateEvents((current) => ({ ...current, [provider.id]: event }))
                  }
                  templates={templatesForProvider(provider.id)}
                  defaults={formData.template_defaults}
                  onChange={(templates) =>
                    setFormData((current) => ({
                      ...current,
                      localized_templates: {
                        ...current.localized_templates,
                        [templateLanguage]: {
                          ...current.localized_templates?.[templateLanguage],
                          [provider.id]: templates,
                        },
                      },
                    }))
                  }
                  disabled={
                    !channelEnabled(provider.id) || save.isPending || toggleSmtp.isPending ||
                    toggleChannel.isPending || testingProvider === provider.id
                  }
                />
              </div>
            </div>
          </ProviderCard>
        ))}
      </div>
    </div>
  );
}
