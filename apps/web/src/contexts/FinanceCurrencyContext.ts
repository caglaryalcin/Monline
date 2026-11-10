import { createContext, useContext } from "react";

import { financeCurrencyQuote } from "@/lib/financeCurrency";

// Standalone ledger components retain the storage currency outside a workspace.
export const FinanceCurrencyContext = createContext(financeCurrencyQuote("TRY", 1));
export const useFinanceCurrencyValue = () => useContext(FinanceCurrencyContext);
