import { useSyncExternalStore } from "react";

import { resolveNumberLocale, subscribeNumberLocale } from "@/lib/numberFormat";

export function useNumberLocale() {
  return useSyncExternalStore(subscribeNumberLocale, resolveNumberLocale);
}
