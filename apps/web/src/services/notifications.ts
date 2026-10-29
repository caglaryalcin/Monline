import { api } from "@/lib/api";
import client from "@/lib/client";
import type { NotificationsConfig } from "@/types";

export const notificationsService = {
  getConfig: (_userId: string): Promise<NotificationsConfig> =>
    api.get<NotificationsConfig>("/api/notifications/preferences"),

  getChannels: () => api.get<NotificationsConfig>("/api/admin/channels"),
  saveChannels: (data: Partial<NotificationsConfig>) =>
    api.patch<NotificationsConfig>("/api/admin/channels", data),

  createConfig: (data: Partial<NotificationsConfig>) =>
    client.collection("notifications_config").create<NotificationsConfig>(data),

  updateConfig: (id: string, data: Partial<NotificationsConfig>) =>
    client.collection("notifications_config").update<NotificationsConfig>(id, data),

  test: (provider: string, config?: Partial<NotificationsConfig>, userId?: string) =>
    api.post<{ success: boolean }>("/api/notifications/test", {
      provider,
      ...(userId ? { userId } : {}),
      ...(config === undefined ? {} : { config }),
    }),
};
