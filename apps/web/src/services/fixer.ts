import { api } from "@/lib/api";
import client from "@/lib/client";
import type { FixerSettings } from "@/types";

export const fixerService = {
  getSettings: async (userId: string): Promise<FixerSettings | null> => {
    try {
      const result = await client.collection("fixer_settings").getList<FixerSettings>(1, 1, {
        filter: client.filter("user = {:userId}", { userId }),
      });
      return result.items[0] ?? null;
    } catch {
      return null;
    }
  },

  createSettings: (data: Partial<FixerSettings>) =>
    client.collection("fixer_settings").create<FixerSettings>(data),

  updateSettings: (id: string, data: Partial<FixerSettings>) =>
    client.collection("fixer_settings").update<FixerSettings>(id, data),

  updateRates: (currencyId?: string) =>
    api.post<{ updated: number; base: string }>(
      "/api/fixer/update",
      currencyId ? { currencyId } : {},
    ),

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
