import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { type MerchantLogoChoice, type MerchantLogoTarget, resolveMerchantLogo } from "@/lib/merchantLogo";
import { merchantLogosKey, merchantLogosService } from "@/services/merchantLogos";

export const MerchantLogosContext = createContext<{
  userId: string;
  choices: MerchantLogoChoice[];
}>({ userId: "", choices: [] });
export function MerchantLogosProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const userId = user?.id || "";
  const query = useQuery({
    queryKey: merchantLogosKey(userId),
    queryFn: merchantLogosService.list,
    enabled: !!userId && !isLoading,
    staleTime: 0,
  });
  return (
    <MerchantLogosContext.Provider value={{ userId, choices: query.data || [] }}>
      {children}
    </MerchantLogosContext.Provider>
  );
}
export function useMerchantLogo(name: string, target: MerchantLogoTarget = {}) {
  const { choices } = useContext(MerchantLogosContext);
  return resolveMerchantLogo(choices, name, target);
}
