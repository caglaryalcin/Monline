import { useTranslation } from "react-i18next";

import type { SpendingEvent } from "@/lib/spending";
import { cn } from "@/lib/utils";

export function SubscriptionSourceBadge({
  source,
  label,
}: {
  source: SpendingEvent["source"];
  label?: string;
}) {
  const { t } = useTranslation();
  const card = source === "statement" || source === "manual_card";
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
        card
          ? "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          : source === "ledger"
            ? "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300"
            : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {label ??
        t(source === "statement" ? "spending_credit_card_source" : `spending_source_${source}`)}
    </span>
  );
}
