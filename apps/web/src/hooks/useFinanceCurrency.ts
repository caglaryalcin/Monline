import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { financeCurrencyQuote } from "@/lib/financeCurrency";
import { queryKeys } from "@/lib/queryKeys";
import { savingsUnitRate } from "@/lib/savings";
import { currenciesService } from "@/services/currencies";
import { savingsService } from "@/services/savings";

export function useFinanceCurrency({ convert = true }: { convert?: boolean } = {}) {
  const { user } = useAuth();
  const userId = user?.id || "";
  const currencies = useQuery({
    queryKey: queryKeys.currencies.all(userId),
    queryFn: () => currenciesService.list(userId),
    enabled: !!userId,
    staleTime: 60000,
  });
  const main = currencies.data?.find((item) => item.is_main) ||
    currencies.data?.find((item) => item.id === user?.main_currency);
  const currency = main?.code.toUpperCase() || "TRY";
  const needsRates = convert && !!main && currency !== "TRY";
  const rates = useQuery({
    queryKey: ["savings-rates", userId, "fixer"],
    queryFn: savingsService.rates,
    enabled: !!userId && needsRates,
    staleTime: 60000,
    refetchInterval: 5 * 60 * 1000,
  });
  const rate = currencies.isSuccess && main
    ? savingsUnitRate("TRY", rates.data, currency) : null;
  const quote = useMemo(() => financeCurrencyQuote(currency, rate), [currency, rate]);
  return {
    ...quote,
    main,
    label: currency === "TRY" ? "TL" : currency,
    pending: currencies.isPending || (needsRates && rates.isPending),
    failed: currencies.isError || (convert && !currencies.isPending && !quote.available && (!needsRates || !rates.isPending)),
    currencies,
    rates,
  };
}
