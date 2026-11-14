import { Pause } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { SubscriptionNotRenewedActions } from "@/lib/subscriptionNotRenewed";
import type { Subscription } from "@/types";

export function SubscriptionNotRenewedButton({
  subscription, actions, date, paid = false, compact = false,
}: {
  subscription: Subscription;
  actions?: SubscriptionNotRenewedActions;
  date?: string;
  paid?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  if (!actions?.canDecline(subscription, date, paid)) return null;
  const label = t("subscription_not_renewed");
  return (
    <Button
      type="button"
      variant={compact ? "ghost" : "outline"}
      size={compact ? "icon" : "sm"}
      className={compact ? "h-6 w-6 shrink-0 rounded-md text-muted-foreground" : "h-auto min-h-9 gap-1.5 whitespace-normal text-left text-xs"}
      disabled={!!actions.pendingId}
      aria-label={`${label} · ${subscription.name}`}
      title={`${label} · ${t("subscription_not_renewed_help")}`}
      onClick={() => actions.decline(subscription, date, paid)}
    >
      <Pause className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {!compact && label}
    </Button>
  );
}
