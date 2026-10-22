import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SubscriptionCard } from "@/components/subscriptions/SubscriptionCard";
import type { SubscriptionPriceDisplay } from "@/components/subscriptions/subscriptionsPage.types";
import { cn } from "@/lib/utils";
import type { Currency, Subscription } from "@/types";

function SubscriptionGridFillers({ count }: { count: number }) {
  const tabletCount = (2 - (count % 2)) % 2;
  const desktopCount = (3 - (count % 3)) % 3;

  return Array.from({ length: Math.max(tabletCount, desktopCount) }, (_, index) => (
    <div
      key={index}
      aria-hidden="true"
      className={cn(
        "pointer-events-none hidden self-stretch rounded-2xl border border-border/70 bg-card/30",
        index < tabletCount && "md:block",
        index < desktopCount ? "lg:block" : "lg:hidden",
      )}
    />
  ));
}

function SubscriptionsLoadingGrid({ layout }: { layout: "grid" | "list" }) {
  if (layout === "list") {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={item}
            className="h-[4.5rem] animate-pulse rounded-xl border bg-card/40 backdrop-blur-sm"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div
          key={item}
          className="h-36 rounded-2xl border bg-card/40 animate-pulse backdrop-blur-sm"
        />
      ))}
    </div>
  );
}

function SubscriptionsEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-dashed bg-card/30 p-12 text-center backdrop-blur-md">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Search className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <p className="text-lg font-medium text-foreground">{t("no_subscriptions")}</p>
      <p className="mt-1 text-muted-foreground">{t("no_subscriptions_hint")}</p>
    </div>
  );
}

interface SubscriptionsGridProps {
  isLoading: boolean;
  subscriptions: Subscription[];
  layout?: "grid" | "list";
  mainCurrency?: Currency;
  currencies?: Currency[];
  convertCurrency?: boolean;
  showProgress?: boolean;
  onEdit: (subscription: Subscription) => void;
  onClone: (id: string) => void;
  onRenew: (id: string) => void;
  renewPending?: boolean;
  onHistory: (subscription: Subscription) => void;
  onDelete: (id: string) => void;
  onToggleActive?: (subscription: Subscription) => void;
  statusPendingId?: string | null;
}

export function SubscriptionsGrid({
  isLoading,
  subscriptions,
  layout = "grid",
  mainCurrency,
  currencies,
  convertCurrency,
  showProgress,
  onEdit,
  onClone,
  onRenew,
  renewPending,
  onHistory,
  onDelete,
  onToggleActive,
  statusPendingId,
}: SubscriptionsGridProps) {
  const [priceDisplays, setPriceDisplays] = useState<Record<string, SubscriptionPriceDisplay>>({});
  if (isLoading) {
    return <SubscriptionsLoadingGrid layout={layout} />;
  }

  if (subscriptions.length === 0) {
    return <SubscriptionsEmptyState />;
  }

  const renderCards = (items: Subscription[]) =>
    items.map((subscription) => (
      <SubscriptionCard
        key={subscription.id}
        sub={subscription}
        layout={layout}
        mainCurrency={mainCurrency}
        currencies={currencies}
        convertCurrency={convertCurrency}
        priceDisplay={priceDisplays[subscription.id] ?? "billing"}
        onPriceDisplayChange={(mode) =>
          setPriceDisplays((current) => ({ ...current, [subscription.id]: mode }))
        }
        showProgress={showProgress}
        onEdit={() => onEdit(subscription)}
        onClone={() => onClone(subscription.id)}
        onRenew={() => onRenew(subscription.id)}
        renewPending={renewPending}
        onHistory={() => onHistory(subscription)}
        onDelete={() => onDelete(subscription.id)}
        onToggleActive={onToggleActive ? () => onToggleActive(subscription) : undefined}
        statusPending={statusPendingId === subscription.id}
        statusDisabled={!!statusPendingId}
      />
    ));

  if (layout === "list") {
    return <div className="space-y-2">{renderCards(subscriptions)}</div>;
  }

  const groups = [
    subscriptions.filter((subscription) => !subscription.inactive),
    subscriptions.filter((subscription) => subscription.inactive),
  ].filter((group) => group.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div
          key={group[0].inactive ? "inactive" : "active"}
          className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {renderCards(group)}
          {!group[0].inactive && <SubscriptionGridFillers count={group.length} />}
        </div>
      ))}
    </div>
  );
}
