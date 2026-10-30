import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ScopedTransferActions } from "@/components/ScopedTransferActions";
import { SubscriptionFormModal } from "@/components/SubscriptionFormModal";
import { LoansSection } from "@/components/subscriptions/LoansSection";
import { ManualBillDialog } from "@/components/subscriptions/ManualBillDialog";
import { SharedSubscriptions } from "@/components/subscriptions/SharedSubscriptions";
import { SpendingMonthPicker } from "@/components/subscriptions/SpendingMonthPicker";
import { StatementCommitments } from "@/components/subscriptions/StatementCommitments";
import { SubscriptionHistoryDialog } from "@/components/subscriptions/SubscriptionHistoryDialog";
import { SubscriptionsFiltersPanel } from "@/components/subscriptions/SubscriptionsFiltersPanel";
import { SubscriptionsGrid } from "@/components/subscriptions/SubscriptionsGrid";
import { SubscriptionSharingDialog } from "@/components/subscriptions/SubscriptionSharingDialog";
import {
  INITIAL_SUBSCRIPTION_FILTERS,
  type SubscriptionAutomationSetting,
  type SubscriptionFiltersState,
  type SubscriptionSortKey,
} from "@/components/subscriptions/subscriptionsPage.types";
import { SubscriptionsPageHeader } from "@/components/subscriptions/SubscriptionsPageHeader";
import { SubscriptionsToolbar } from "@/components/subscriptions/SubscriptionsToolbar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useFilteredSubscriptions } from "@/hooks/useFilteredSubscriptions";
import { useLocalToday } from "@/hooks/useLocalToday";
import { queryKeys } from "@/lib/queryKeys";
import {
  currentSpendingMonth,
  EMPTY_SPENDING,
  isBillRecord,
  spendingKey,
  subscriptionSection,
} from "@/lib/spending";
import { toast } from "@/lib/toast";
import { categoriesService } from "@/services/categories";
import { currenciesService } from "@/services/currencies";
import { fixerService } from "@/services/fixer";
import { householdService } from "@/services/household";
import { paymentMethodsService } from "@/services/paymentMethods";
import { spendingService } from "@/services/spending";
import { subscriptionsService } from "@/services/subscriptions";
import type { Subscription } from "@/types";

export type SubscriptionSection = "online" | "installments" | "bills" | "loans";

export function SubscriptionSections({
  section,
  sections,
  onSectionChange,
}: {
  section: SubscriptionSection;
  sections?: SubscriptionSection[];
  onSectionChange?: (section: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";
  const today = useLocalToday();

  const [searchTerm, setSearchTerm] = useState("");
  const [sort] = useState<SubscriptionSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<SubscriptionFiltersState>(INITIAL_SUBSCRIPTION_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [showBillForm, setShowBillForm] = useState(false);
  const [editSubscription, setEditSubscription] = useState<Subscription | null>(null);
  const [historySubscription, setHistorySubscription] = useState<Subscription | null>(null);
  const [sharingSubscription, setSharingSubscription] = useState<Subscription | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const deleteAllMutation = useMutation({
    mutationFn: () => subscriptionsService.deleteAll(),
    onSuccess: async () => {
      setDeleteAllOpen(false);
      await queryClient.invalidateQueries();
      toast.success(t("all_subscriptions_deleted"));
    },
    onError: () => toast.error(t("error_deleting_subscription")),
  });
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [month, setMonth] = useState(currentSpendingMonth);
  const spending = useQuery({
    queryKey: spendingKey(userId),
    queryFn: spendingService.get,
    enabled: !!userId,
    staleTime: 0,
  });

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
    staleTime: 0,
    refetchOnWindowFocus: "always",
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

  const automationMutation = useMutation({
    mutationFn: ({
      id,
      setting,
      enabled,
    }: {
      id: string;
      setting: SubscriptionAutomationSetting;
      enabled: boolean;
    }) => subscriptionsService.update(id, { [setting]: enabled }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Subscription[]>(queryKeys.subscriptions.all(userId), (current) =>
        current?.map((subscription) =>
          subscription.id === updated.id
            ? {
                ...subscription,
                auto_renew: updated.auto_renew,
                auto_mark_paid: updated.auto_mark_paid,
              }
            : subscription,
        ),
      );
      return queryClient.invalidateQueries();
    },
    onError: (error: Error) =>
      toast.error(t(error.message === "category_required" ? "category_required" : "unknown_error")),
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
    subscriptions: subscriptions.filter(
      (sub) =>
        subscriptionSection(sub) === section ||
        (section === "online" && subscriptionSection(sub) === "other"),
    ),
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
    if (section === "bills") {
      setShowBillForm(true);
      return;
    }
    setEditSubscription(null);
    setShowForm(true);
  };

  const handleEdit = (subscription: Subscription) => {
    setEditSubscription(subscription);
    setShowForm(true);
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 space-y-6 fade-in duration-500">
      {section !== "loans" && (
        <SubscriptionsToolbar
          primaryAction={
            <SubscriptionsPageHeader
              onCreate={handleCreate}
              createLabel={section === "bills" ? t("spending_add_bill") : undefined}
            />
          }
          searchTerm={searchTerm}
          showFilters={showFilters}
          view={view}
          onSearchChange={setSearchTerm}
          onToggleFilters={() => setShowFilters((current) => !current)}
          onCycleSort={handleCycleSort}
          onViewChange={setView}
          onDeleteAll={() => setDeleteAllOpen(true)}
          deleteAllDisabled={
            isLoading ||
            deleteAllMutation.isPending ||
            !(
              subscriptions.length ||
              spending.data?.tracked_statements_count ||
              spending.data?.imported_payments_count ||
              spending.data?.events.some((event) => event.source === "statement") ||
              spending.data?.installments.length ||
              spending.data?.unmatched_installments.length
            )
          }
          transferActions={<ScopedTransferActions scope="subscriptions" compact />}
        />
      )}

      {sections && onSectionChange && (
        <Tabs value={section} onValueChange={onSectionChange}>
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            {sections.map((name) => (
              <TabsTrigger key={name} value={name}>
                {t(`spending_section_${name}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      {section === "installments" &&
        spending.data?.installments.some((plan) => plan.period === month) && (
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t("spending_installments_source")}</h2>
            <p className="text-sm text-muted-foreground">{t("spending_installments_help")}</p>
          </div>
        )}
      {["installments", "bills"].includes(section) && (
        <SpendingMonthPicker
          month={month}
          onChange={setMonth}
          calendarPicker={section === "installments"}
          recordedMonths={
            section === "installments"
              ? (spending.data?.statement_months ?? [])
              : [
                  ...new Set([
                    ...(spending.data?.events
                      .filter(isBillRecord)
                      .map((event) => event.date.slice(0, 7)) || []),
                  ]),
                ]
                  .filter(Boolean)
                  .sort()
                  .reverse()
          }
        />
      )}
      {["installments", "bills"].includes(section) && (
        <p className="flex items-start gap-2 rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <Lightbulb
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <span>
            {t(section === "installments" ? "spending_installments_info" : "spending_bills_info")}
          </span>
        </p>
      )}
      {spending.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("spending_load_failed")}
        </p>
      )}
      {spending.isPending && ["installments", "bills", "loans"].includes(section) && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("loading")}
        </p>
      )}

      {showFilters && section !== "loans" ? (
        <SubscriptionsFiltersPanel
          categories={categories}
          filters={filters}
          onChange={setFilters}
        />
      ) : null}

      {section !== "loans" &&
        (filteredSubscriptions.length > 0 ||
          (section !== "installments" && section !== "bills")) && (
          <div className="space-y-3">
            <SubscriptionsGrid
              onShare={setSharingSubscription}
              isLoading={isLoading}
              subscriptions={filteredSubscriptions}
              layout={view}
              mainCurrency={mainCurrency}
              currencies={currencies}
              convertCurrency={user?.convert_currency}
              showCurrencyCode={user?.show_currency_code}
              showProgress={user?.subscription_progress}
              onEdit={handleEdit}
              onClone={(id) => cloneMutation.mutate(id)}
              onRenew={(id) => {
                if (!renewMutation.isPending) renewMutation.mutate(id);
              }}
              renewPending={renewMutation.isPending}
              renewPendingId={renewMutation.variables}
              onHistory={setHistorySubscription}
              onDelete={setDeleteId}
              onToggleActive={(subscription) => {
                if (!statusMutation.isPending && !automationMutation.isPending)
                  statusMutation.mutate({ id: subscription.id, inactive: !subscription.inactive });
              }}
              statusPendingId={statusMutation.isPending ? statusMutation.variables?.id : null}
              showAutoMarkPaid={!!user?.payment_tracking}
              onToggleAutomation={(subscription, setting) => {
                if (!automationMutation.isPending && !statusMutation.isPending)
                  automationMutation.mutate({
                    id: subscription.id,
                    setting,
                    enabled: !subscription[setting],
                  });
              }}
              automationPending={automationMutation.isPending}
              automationPendingId={automationMutation.variables?.id}
              automationPendingSetting={automationMutation.variables?.setting}
            />
          </div>
        )}
      {(section === "installments" || section === "bills") && !spending.isPending && (
        <StatementCommitments
          data={spending.data ?? EMPTY_SPENDING}
          section={section}
          search={searchTerm}
          month={month}
          layout={view}
        />
      )}

      {section === "loans" && !spending.isPending && !spending.isError && (
        <LoansSection loans={spending.data?.loans ?? []} month={today.slice(0, 7)} search="" />
      )}

      {section === "online" && (
        <SharedSubscriptions userId={userId} searchTerm={searchTerm} layout={view} showCurrencyCode={user?.show_currency_code} />
      )}
      {sharingSubscription && (
        <SubscriptionSharingDialog sub={sharingSubscription} userId={userId} onClose={() => setSharingSubscription(null)} />
      )}
      {showBillForm && <ManualBillDialog month={month} onClose={() => setShowBillForm(false)} />}
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
      <ConfirmDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title={t("delete_all_subscriptions")}
        description={t("delete_all_subscriptions_confirm", { count: subscriptions.length })}
        onConfirm={() => {
          if (!deleteAllMutation.isPending) deleteAllMutation.mutate();
        }}
      />
    </div>
  );
}
