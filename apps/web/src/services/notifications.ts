import { api } from "@/lib/api";
import client from "@/lib/client";
import type { NotificationEvent, NotificationsConfig, NotificationTemplates } from "@/types";

export const notificationsService = {
  getConfig: (_userId: string): Promise<NotificationsConfig> =>
    api.get<NotificationsConfig>("/api/notifications/preferences"),

  getChannels: () => api.get<NotificationsConfig>("/api/admin/channels"),
  saveChannels: (data: Partial<NotificationsConfig>) =>
    api.patch<NotificationsConfig>("/api/admin/channels", data),
  previewTemplate: (
    provider: string,
    event: NotificationEvent,
    templates: NotificationTemplates,
    language?: string,
  ) =>
    api.post<{ title: string; message: string; html: string }>(
      "/api/admin/channels/template-preview",
      {
        provider,
        event,
        ...(language ? { localized_templates: { [language]: templates } } : { templates }),
      },
    ),

  createConfig: (data: Partial<NotificationsConfig>) =>
    client.collection("notifications_config").create<NotificationsConfig>(data),

  updateConfig: (id: string, data: Partial<NotificationsConfig>) =>
    client.collection("notifications_config").update<NotificationsConfig>(id, data),

  test: (
    provider: string,
    config?: Partial<NotificationsConfig>,
    userId?: string,
    templates?: NotificationTemplates,
    event?: NotificationEvent,
    language?: string,
  ) =>
    api.post<{ success: boolean }>("/api/notifications/test", {
      provider,
      ...(userId ? { userId } : {}),
      ...(config === undefined ? {} : { config }),
      ...(templates === undefined
        ? {}
        : {
            ...(language ? { localized_templates: { [language]: templates } } : { templates }),
            event: event ?? "payment",
          }),
    }),
};
