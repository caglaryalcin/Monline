import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { canMarkSubscriptionNotRenewed, type SubscriptionNotRenewedActions } from "@/lib/subscriptionNotRenewed";
import { toast } from "@/lib/toast";
import { subscriptionsService } from "@/services/subscriptions";
import type { Subscription } from "@/types";

export function useSubscriptionNotRenewed(onDone?: () => void): SubscriptionNotRenewedActions {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const userId = user?.id ?? "";
  const mutation = useMutation({
    mutationFn: (subscription: Subscription) => subscriptionsService.update(subscription.id, { inactive: true }),
    onSuccess: async (updated) => {
      queryClient.setQueryData<Subscription[]>(queryKeys.subscriptions.all(userId), (current) =>
        current?.map((subscription) => subscription.id === updated.id ? { ...subscription, ...updated } : subscription),
      );
      onDone?.();
      toast.success(t("subscription_not_renewed_success"));
      await queryClient.invalidateQueries();
    },
    onError: () => toast.error(t("subscription_status_error")),
    onSettled: () => { submitting.current = false; },
  });
  return {
    canDecline: (subscription, _date, paid) => canMarkSubscriptionNotRenewed(subscription, userId, paid),
    decline: (subscription, _date, paid) => {
      if (submitting.current || !canMarkSubscriptionNotRenewed(subscription, userId, paid)) return;
      submitting.current = true;
      mutation.mutate(subscription);
    },
    pendingId: mutation.isPending ? mutation.variables.id : undefined,
  };
}
