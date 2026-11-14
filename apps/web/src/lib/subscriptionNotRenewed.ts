import type { Subscription } from "@/types";

export interface SubscriptionNotRenewedActions {
  canDecline: (subscription: Subscription, date?: string, paid?: boolean) => boolean;
  decline: (subscription: Subscription, date?: string, paid?: boolean) => void;
  pendingId?: string;
}

export function canMarkSubscriptionNotRenewed(subscription: Subscription, userId: string, paid = false) {
  return !!userId && subscription.user === userId && !subscription.inactive && !paid &&
    !subscription.standalone_payment_id && subscription.record_type !== "credit" &&
    subscription.expand?.cycle?.name !== "One-Time";
}
