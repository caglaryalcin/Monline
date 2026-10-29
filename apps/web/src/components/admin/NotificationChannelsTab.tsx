import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DEFAULT_REMINDERS, PROVIDERS } from "@/components/settings/notifications/config";
import { ProviderCard } from "@/components/settings/notifications/ProviderCard";
import { RemindersEditor } from "@/components/settings/notifications/RemindersEditor";
import { LS_KEYS } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { notificationsService } from "@/services/notifications";
import type { NotificationReminder, NotificationsConfig } from "@/types";

const channelsKey = ["admin-channels"] as const;
const providers = PROVIDERS.map((provider) =>
  provider.id === "email"
    ? { ...provider, fields: [], hintKey: "admin_email_recipient_hint" }
    : provider,
);

export function NotificationChannelsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: channelsKey,
    queryFn: () => notificationsService.getChannels(),
  });
  const [formData, setFormData] = useState<Partial<NotificationsConfig>>({});
  const [reminders, setReminders] = useState<NotificationReminder[]>(DEFAULT_REMINDERS);
  const hydrated = useRef(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  useEffect(() => {
    if (query.isSuccess && !hydrated.current) {
      hydrated.current = true;
      setFormData(query.data ?? {});
      setReminders(query.data?.reminders?.length ? query.data.reminders : DEFAULT_REMINDERS);
    }
  }, [query.data, query.isSuccess]);
  const save = useMutation({
    mutationFn: ({ data }: { section: string; data: Partial<NotificationsConfig> }) =>
      notificationsService.saveChannels(data),
    onSuccess: (record) => {
      qc.setQueryData(channelsKey, record);
      qc.invalidateQueries({ queryKey: ["notifications_config"] });
      setFormData((current) => ({ ...current, available_channels: record.available_channels }));
      toast.success(t("saved"));
    },
    onError: (error: Error) => toast.error(t(error.message, { defaultValue: t("error") })),
  });
  const saveSection = (section: string) => {
    if (save.isPending || !query.isSuccess) return;
    if (section === "reminders") {
      save.mutate({ section, data: { reminders } });
      return;
    }
    const provider = providers.find((item) => item.id === section)!;
    const data = Object.fromEntries(provider.fields.map(({ key }) => [key, formData[key] ?? ""]));
    save.mutate({ section, data });
  };
  const test = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const provider = providers.find((item) => item.id === providerId)!;
      const draft = Object.fromEntries(
        provider.fields.map(({ key }) => [key, formData[key] ?? ""]),
      );
      await notificationsService.test(providerId, draft);
      toast.success(t("notification_sent"));
    } catch {
      toast.error(t("error_sending_notification"));
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
      <RemindersEditor
        reminders={reminders}
        onChange={setReminders}
        onSave={() => saveSection("reminders")}
        isSaving={save.isPending && save.variables?.section === "reminders"}
        saveDisabled={save.isPending}
      />
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
            onChange={(key, value) => setFormData((current) => ({ ...current, [key]: value }))}
            onSave={() => saveSection(provider.id)}
            isSaving={save.isPending && save.variables?.section === provider.id}
            saveDisabled={save.isPending}
            onTest={() => test(provider.id)}
            isTesting={testingProvider === provider.id}
          />
        ))}
      </div>
    </div>
  );
}
