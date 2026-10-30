import { useQuery } from "@tanstack/react-query";

import { spendingKey } from "@/lib/spending";
import { spendingService } from "@/services/spending";

export function useActiveLoanCount(userId: string) {
  const spending = useQuery({
    queryKey: spendingKey(userId),
    queryFn: spendingService.get,
    enabled: !!userId,
    staleTime: 30_000,
  });
  if (spending.isError || !spending.data) return undefined;
  return (spending.data.loans ?? []).filter(
    (loan) => loan.remaining_installments > 0 || Math.round(loan.remaining_amount * 100) > 0,
  ).length;
}
