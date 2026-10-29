import { api } from "@/lib/api";
import client from "@/lib/client";
import type { FixerSettings } from "@/types";

export const fixerService = {
  getSettings: (): Promise<FixerSettings> => api.get<FixerSettings>("/api/admin/exchange"),
  getStatus: () =>
    api.get<{ enabled: boolean; api_key_configured: boolean }>("/api/exchange/status"),
  saveSettings: (data: Partial<FixerSettings>) =>
    api.patch<FixerSettings>("/api/admin/exchange", data),
  updateAllRates: () => api.post<{ updated: number; base: string }>("/api/admin/exchange/update"),

  updateRates: (currencyId?: string, userId?: string) =>
    api.post<{ updated: number; base: string }>("/api/fixer/update", {
      ...(currencyId ? { currencyId } : {}),
      ...(userId ? { userId } : {}),
    }),

  /** Returns the ISO timestamp of the last successful exchange rate update, or null. */
  getLastUpdate: async (): Promise<string | null> => {
    try {
      const result = await client
        .collection("exchange_log")
        .getList<{ last_update: string }>(1, 1, {
          sort: "-last_update",
        });
      return result.items[0]?.last_update ?? null;
    } catch {
      return null;
    }
  },
};
