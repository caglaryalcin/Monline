import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { SubscriptionSortKey } from "@/components/subscriptions/subscriptionsPage.types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import { usersService } from "@/services/users";

export function useSubscriptionSort() {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const savedSort = user?.sort_order;
  const sort: SubscriptionSortKey =
    savedSort === "next_payment"
      ? "date"
      : savedSort === "price" || savedSort === "status"
        ? savedSort
        : "name";
  const sortDir: "asc" | "desc" = user?.sort_direction === "desc" ? "desc" : "asc";

  const save = useMutation({
    mutationFn: (next: { sort: SubscriptionSortKey; direction: "asc" | "desc" }) =>
      usersService.update(user!.id, {
        sort_order: next.sort === "date" ? "next_payment" : next.sort,
        sort_direction: next.direction,
      }),
    onSuccess: async () => {
      await refreshUser();
    },
    onError: () => toast.error(t("error_saving")),
  });

  // Display the acknowledged account preference. While saving, the menu is
  // disabled so rapid changes cannot overwrite one another out of order.
  return {
    sort,
    sortDir,
    isSaving: save.isPending,
    setSort: (next: SubscriptionSortKey) => {
      if (user && !save.isPending) save.mutate({ sort: next, direction: sortDir });
    },
    toggleSortDir: () => {
      if (user && !save.isPending)
        save.mutate({ sort, direction: sortDir === "asc" ? "desc" : "asc" });
    },
  };
}
