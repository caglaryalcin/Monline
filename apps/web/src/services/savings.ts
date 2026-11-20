import { api } from "@/lib/api";
import type { Saving, SavingInput, SavingsRates } from "@/lib/savings";
export const savingsRatesKey = (userId?: string) => ["savings-rates", userId, "market"] as const;

export const savingsService = {
  list: () => api.get<Saving[]>("/api/savings"),
  rates: () => api.get<SavingsRates>("/api/savings/rates"),
  refreshRates: () => api.post<SavingsRates>("/api/savings/rates"),
  create: (value: SavingInput) => api.post<Saving>("/api/savings", value),
  update: (id: string, value: SavingInput) => api.put<Saving>(`/api/savings/${id}`, value),
  remove: (id: string) => api.del(`/api/savings/${id}`),
};

// Re-read the saved snapshot soon after a background refresh, without extra provider calls.
export const savingsRatesRefetchInterval = (query: { state: { data?: SavingsRates } }) =>
  query.state.data?.refreshing ? 2000 : 60000;
