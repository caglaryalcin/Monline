import { api } from "@/lib/api";
import type { MerchantLogoChoice } from "@/lib/merchantLogo";

export const merchantLogosKey = (userId: string) => ["merchant-logos", userId] as const;
export const merchantLogosService = {
  list: () => api.get<MerchantLogoChoice[]>("/api/merchant-logos"),
  save: (body: Pick<MerchantLogoChoice, "merchant_name" | "provider_name" | "domain" | "row_id" | "start_month" | "scope">) =>
    api.post<MerchantLogoChoice>("/api/merchant-logos", body),
  remove: (id: string) => api.del(`/api/merchant-logos/${id}`),
};
