import { api } from "@/lib/api";
import client from "@/lib/client";
import type { NotificationsConfig } from "@/types";

export const notificationsService = {
  getConfig: async (userId: string): Promise<NotificationsConfig | null> => {
    try {
      const result = await client
        .collection("notifications_config")
        .getList<NotificationsConfig>(1, 1, {
          filter: client.filter("user = {:userId}", { userId }),
        });
      return result.items[0] ?? null;
    } catch {
      return null;
    }
  },

  createConfig: (data: Partial<NotificationsConfig>) =>
    client.collection("notifications_config").create<NotificationsConfig>(data),

  updateConfig: (id: string, data: Partial<NotificationsConfig>) =>
    client.collection("notifications_config").update<NotificationsConfig>(id, data),

  test: (provider: string, config?: Partial<NotificationsConfig>) =>
    api.post<{ success: boolean }>("/api/notifications/test", {
      provider,
      ...(config === undefined ? {} : { config }),
    }),
};
