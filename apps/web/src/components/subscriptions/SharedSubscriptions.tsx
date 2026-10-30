import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SharedSubscriptionEditDialog } from "@/components/subscriptions/SharedSubscriptionEditDialog";
import { SubscriptionCard } from "@/components/subscriptions/SubscriptionCard";
import { Button } from "@/components/ui/button";
import { sharingErrorMessage } from "@/lib/sharingErrors";
import type { SharedSubscription } from "@/services/sharing";
import { sharingKeys, sharingService } from "@/services/sharing";

export function SharedSubscriptions({
  userId,
  searchTerm,
  layout,
  showCurrencyCode,
}: {
  userId: string;
  searchTerm: string;
  layout: "grid" | "list";
  showCurrencyCode?: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<SharedSubscription | null>(null);
  const shared = useQuery({
    queryKey: sharingKeys.shared(userId),
    queryFn: sharingService.shared,
    enabled: !!userId,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    // Membership changes and revocations must also remove previously cached items.
    refetchInterval: 30_000,
  });
  const subscriptions = (shared.isError ? [] : (shared.data ?? [])).filter((sub) =>
    sub.name.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase()),
  );
  return (
    <section className="space-y-4 border-t pt-6" aria-labelledby="shared-subscriptions-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="shared-subscriptions-title" className="text-lg font-semibold">
            {t("sharing_shared_with_me")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("sharing_shared_hint")}</p>
        </div>
        <Button variant="outline" onClick={() => shared.refetch()} disabled={shared.isFetching}>
          {t("sharing_refresh")}
        </Button>
      </div>
      {shared.isPending && <p role="status">{t("loading")}</p>}
      {shared.isError && (
        <p role="alert" className="text-destructive">
          {sharingErrorMessage(t, shared.error)}
        </p>
      )}
      {shared.isSuccess && subscriptions.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          {t("sharing_no_shared")}
        </p>
      )}
      <div
        className={
          layout === "grid"
            ? "grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3"
            : "space-y-3"
        }
      >
        {subscriptions.map((sub) => (
          <div key={sub.id} className="space-y-2">
            <p className="px-1 text-xs text-muted-foreground">
              {t("sharing_shared_by", { name: sub.owner_name || t("sharing_owner") })}
            </p>
            <SubscriptionCard
              sub={sub}
              layout={layout}
              showCurrencyCode={showCurrencyCode}
              readOnly
              onSharedEdit={sub.permission === "edit" ? () => setEditing(sub) : undefined}
            />
            {sub.notes && (
              <p className="whitespace-pre-wrap break-words px-1 text-sm text-muted-foreground">
                {sub.notes}
              </p>
            )}
            {sub.url && /^https?:\/\//i.test(sub.url) && (
              <a
                className="inline-block px-1 text-sm text-primary underline"
                href={sub.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("open_url")}
              </a>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <SharedSubscriptionEditDialog
          sub={editing}
          userId={userId}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
