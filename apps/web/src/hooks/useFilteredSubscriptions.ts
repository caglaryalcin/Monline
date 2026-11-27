import { useMemo } from "react";

import type {
  SubscriptionFiltersState,
  SubscriptionSortKey,
} from "@/components/subscriptions/subscriptionsPage.types";
import { useLocalToday } from "@/hooks/useLocalToday";
import { isBillingPaused } from "@/lib/subscriptionPauses";
import { subscriptionAmount } from "@/lib/subscriptionTrial";
import type { Subscription } from "@/types";

interface UseFilteredSubscriptionsParams {
  subscriptions: Subscription[];
  searchTerm: string;
  filters: SubscriptionFiltersState;
  sort: SubscriptionSortKey;
  sortDir: "asc" | "desc";
  disabledToBottom?: boolean;
  hideDisabled?: boolean;
}

export function useFilteredSubscriptions({
  subscriptions,
  searchTerm,
  filters,
  sort,
  sortDir,
  disabledToBottom,
  hideDisabled,
}: UseFilteredSubscriptionsParams) {
  const today = useLocalToday();
  return useMemo(() => {
    const disabled = (subscription: Subscription) => subscription.inactive || isBillingPaused(subscription, today);
    let result = [...subscriptions];
    if (hideDisabled) result = result.filter((subscription) => !disabled(subscription));

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      result = result.filter(
        (subscription) =>
          subscription.name.toLowerCase().includes(query) ||
          (subscription.brand_name ?? "").toLowerCase().includes(query),
      );
    }

    if (filters.state === "active") {
      result = result.filter((subscription) => !disabled(subscription));
    } else if (filters.state === "inactive") {
      result = result.filter((subscription) => disabled(subscription));
    }

    if (filters.categories.length > 0) {
      result = result.filter((subscription) =>
        filters.categories.includes(subscription.category ?? ""),
      );
    }

    if (filters.members.length > 0) {
      result = result.filter((subscription) => filters.members.includes(subscription.payer ?? ""));
    }

    if (filters.payments.length > 0) {
      result = result.filter((subscription) =>
        filters.payments.includes(subscription.payment_method ?? ""),
      );
    }

    result.sort((left, right) => {
      let comparison = 0;

      if (sort === "name") {
        comparison = left.name.localeCompare(right.name);
      } else if (sort === "price") {
        comparison = subscriptionAmount(left) - subscriptionAmount(right);
      } else if (sort === "date") {
        comparison = (left.next_payment || "").localeCompare(right.next_payment || "");
      } else if (sort === "status") {
        comparison = Number(disabled(left)) - Number(disabled(right));
      }

      return sortDir === "asc" ? comparison : -comparison;
    });

    if (disabledToBottom) {
      result.sort((left, right) => Number(disabled(left)) - Number(disabled(right)));
    }

    return result;
  }, [subscriptions, searchTerm, filters, sort, sortDir, disabledToBottom, hideDisabled, today]);
}
