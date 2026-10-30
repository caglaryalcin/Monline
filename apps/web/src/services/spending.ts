import { api } from "@/lib/api";
import type { SpendingData } from "@/lib/spending";

export const spendingService = { get: () => api.get<SpendingData>("/api/spending") };
