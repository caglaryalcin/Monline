import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SubscriptionFormModal } from "@/components/SubscriptionFormModal";
import { SubscriptionHistoryDialog } from "@/components/subscriptions/SubscriptionHistoryDialog";
import { SubscriptionsFiltersPanel } from "@/components/subscriptions/SubscriptionsFiltersPanel";
import { SubscriptionsGrid } from "@/components/subscriptions/SubscriptionsGrid";
import {
  INITIAL_SUBSCRIPTION_FILTERS,
  type SubscriptionFiltersState,
  type SubscriptionSortKey,
} from "@/components/subscriptions/subscriptionsPage.types";
import { SubscriptionsPageHeader } from "@/components/subscriptions/SubscriptionsPageHeader";
import { SubscriptionsToolbar } from "@/components/subscriptions/SubscriptionsToolbar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useFilteredSubscriptions } from "@/hooks/useFilteredSubscriptions";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { categoriesService } from "@/services/categories";
import { currenciesService } from "@/services/currencies";
import { fixerService } from "@/services/fixer";
import { householdService } from "@/services/household";
import { paymentMethodsService } from "@/services/paymentMethods";
import { subscriptionsService } from "@/services/subscriptions";
import type { Subscription } from "@/types";

export function SubscriptionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  const [searchTerm, setSearchTerm] = useState("");
  const [sort] = useState<SubscriptionSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<SubscriptionFiltersState>(INITIAL_SUBSCRIPTION_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [editSubscription, setEditSubscription] = useState<Subscription | null>(null);
  const [historySubscription, setHistorySubscription] = useState<Subscription | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: queryKeys.subscriptions.all(userId),
    queryFn: () => subscriptionsService.list(userId),
    enabled: !!userId,
  });

  const { data: currencies = [] } = useQuery({
    queryKey: queryKeys.currencies.all(userId),
    queryFn: () => currenciesService.list(userId),
    enabled: !!userId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories.all(userId),
    queryFn: () => categoriesService.list(userId),
    enabled: !!userId,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: queryKeys.paymentMethods.all(userId),
    queryFn: () => paymentMethodsService.listForForm(userId),
    enabled: !!userId,
  });

  const { data: household = [] } = useQuery({
    queryKey: queryKeys.household.all(userId),
    queryFn: () => householdService.list(userId),
    enabled: !!userId,
  });

  const mainCurrency = currencies.find((currency) => currency.is_main);

  const statusMutation = useMutation({
    mutationFn: ({ id, inactive }: { id: string; inactive: boolean }) =>
      subscriptionsService.update(id, { inactive }),
    onMutate: async ({ id, inactive }) => {
      const key = queryKeys.subscriptions.all(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previousInactive = queryClient
        .getQueryData<Subscription[]>(key)
        ?.find((subscription) => subscription.id === id)?.inactive;
      queryClient.setQueryData<Subscription[]>(key, (current) =>
        current?.map((subscription) =>
          subscription.id === id ? { ...subscription, inactive } : subscription,
        ),
      );
      return { previousInactive };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Subscription[]>(queryKeys.subscriptions.all(userId), (current) =>
        current?.map((subscription) =>
          subscription.id === updated.id
            ? { ...subscription, inactive: updated.inactive, next_payment: updated.next_payment }
            : subscription,
        ),
      );
    },
    onError: (error, { id }, context) => {
      const previousInactive = context?.previousInactive;
      if (previousInactive !== undefined) {
        queryClient.setQueryData<Subscription[]>(queryKeys.subscriptions.all(userId), (current) =>
          current?.map((subscription) =>
            subscription.id === id ? { ...subscription, inactive: previousInactive } : subscription,
          ),
        );
      }
      toast.error(
        t(
          error.message === "category_required" ? "category_required" : "subscription_status_error",
        ),
      );
    },
    onSettled: (_data, _error, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.history(userId, id) }),
      ]),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionsService.delete(id),
    onSuccess: () => {
      toast.success(t("subscription_deleted"));
      queryClient.invalidateQueries({
        queryKey: queryKeys.subscriptions.all(userId),
      });
      setDeleteId(null);
    },
    onError: () => toast.error(t("error_deleting_subscription")),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => subscriptionsService.clone(id),
    onSuccess: () => {
      toast.success(t("success"));
      queryClient.invalidateQueries({
        queryKey: queryKeys.subscriptions.all(userId),
      });
    },
    onError: (error: Error) =>
      toast.error(t(error.message === "category_required" ? "category_required" : "unknown_error")),
  });

  const renewMutation = useMutation({
    mutationFn: async (id: string) => {
      await subscriptionsService.renew(id);
      const subscription = subscriptions.find((entry) => entry.id === id);
      const currencyId = subscription?.currency;
      const currency =
        currencies.find((entry) => entry.id === currencyId) ?? subscription?.expand?.currency;
      if (
        !currencyId ||
        currencyId === mainCurrency?.id ||
        currency?.is_main ||
        (mainCurrency && currency?.code === mainCurrency.code)
      ) {
        return "skipped" as const;
      }
      try {
        await fixerService.updateRates(currencyId);
        return "updated" as const;
      } catch (error) {
        return error instanceof Error && error.message === "No exchange rate API key configured."
          ? ("missing-key" as const)
          : ("failed" as const);
      }
    },
    onSuccess: (rates) => {
      if (rates === "updated") {
        toast.success(t("subscription_renewed_rates_updated"));
      } else if (rates === "skipped") {
        toast.success(t("success"));
      } else {
        toast.warning(
          t(
            rates === "missing-key"
              ? "subscription_renewed_rates_no_key"
              : "subscription_renewed_rates_failed",
          ),
        );
      }
      // Rates also affect cached dashboard totals and expanded currency records.
      return queryClient.invalidateQueries();
    },
    onError: (error: Error) =>
      toast.error(t(error.message === "category_required" ? "category_required" : "unknown_error")),
  });

  const filteredSubscriptions = useFilteredSubscriptions({
    subscriptions,
    searchTerm,
    filters,
    sort,
    sortDir,
    disabledToBottom: user?.disabled_to_bottom,
    hideDisabled: user?.hide_disabled,
  });

  const handleCycleSort = () => {
    setSortDir((current) => (current === "asc" ? "desc" : "asc"));
  };

  const handleCreate = () => {
    setEditSubscription(null);
    setShowForm(true);
  };

  const handleEdit = (subscription: Subscription) => {
    setEditSubscription(subscription);
    setShowForm(true);
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 space-y-6 fade-in duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <SubscriptionsPageHeader onCreate={handleCreate} />
        <div className="min-w-0 flex-1">
          <SubscriptionsToolbar
            searchTerm={searchTerm}
            showFilters={showFilters}
            view={view}
            onSearchChange={setSearchTerm}
            onToggleFilters={() => setShowFilters((current) => !current)}
            onCycleSort={handleCycleSort}
            onViewChange={setView}
          />
        </div>
      </div>

      {showFilters ? (
        <SubscriptionsFiltersPanel
          categories={categories}
          filters={filters}
          onChange={setFilters}
        />
      ) : null}

      <SubscriptionsGrid
        isLoading={isLoading}
        subscriptions={filteredSubscriptions}
        layout={view}
        mainCurrency={mainCurrency}
        currencies={currencies}
        convertCurrency={user?.convert_currency}
        showProgress={user?.subscription_progress}
        onEdit={handleEdit}
        onClone={(id) => cloneMutation.mutate(id)}
        onRenew={(id) => {
          if (!renewMutation.isPending) renewMutation.mutate(id);
        }}
        renewPending={renewMutation.isPending}
        onHistory={setHistorySubscription}
        onDelete={setDeleteId}
        onToggleActive={(subscription) => {
          if (!statusMutation.isPending)
            statusMutation.mutate({ id: subscription.id, inactive: !subscription.inactive });
        }}
        statusPendingId={statusMutation.isPending ? statusMutation.variables?.id : null}
      />

      {showForm ? (
        <SubscriptionFormModal
          sub={editSubscription}
          userId={userId}
          currencies={currencies}
          categories={categories}
          paymentMethods={paymentMethods}
          household={household}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            queryClient.invalidateQueries();
          }}
        />
      ) : null}

      {historySubscription ? (
        <SubscriptionHistoryDialog
          sub={historySubscription}
          userId={userId}
          onClose={() => setHistorySubscription(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteId}
        confirmOnEnter
        onOpenChange={(nextOpen) => !nextOpen && setDeleteId(null)}
        title={t("delete_subscription")}
        description={t("confirm_delete_subscription")}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
