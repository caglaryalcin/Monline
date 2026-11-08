import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { CategoryFormRow } from "@/components/settings/categories/CategoryFormRow";
import { CategoryListItem } from "@/components/settings/categories/CategoryListItem";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { categoryLabel } from "@/lib/categoryLabel";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { categoriesService } from "@/services/categories";
import { subscriptionsService } from "@/services/subscriptions";

export function CategoriesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: queryKeys.categories.all(user?.id ?? ""),
    queryFn: () => categoriesService.list(user!.id),
    enabled: !!user?.id,
  });

  const { data: subscriptions, isError: subscriptionsError } = useQuery({
    queryKey: queryKeys.subscriptions.all(user?.id ?? ""),
    queryFn: () => subscriptionsService.list(user!.id),
    enabled: !!user?.id,
  });
  const subscriptionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const subscription of subscriptions ?? []) {
      if (subscription.category) {
        counts.set(subscription.category, (counts.get(subscription.category) ?? 0) + 1);
      }
    }
    return counts;
  }, [subscriptions]);

  const categoryUsage = useQuery({
    queryKey: [...queryKeys.subscriptions.all(user?.id ?? ""), "category-usage", pendingDeleteId],
    queryFn: () => categoriesService.subscriptionCount(user!.id, pendingDeleteId!),
    enabled: !!user?.id && !!pendingDeleteId,
    staleTime: 0,
    retry: false,
  });
  const categoryUsageLoading = categoryUsage.isPending || categoryUsage.isFetching;
  const categoryUsageCount = categoryUsage.data ?? 0;

  const createMut = useMutation({
    mutationFn: (name: string) => categoriesService.create(user!.id, name),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.categories.all(user?.id ?? ""),
      });
      setNewCategoryName("");
      setIsAdding(false);
      toast.success(t("success_create"));
    },
    onError: () => toast.error(t("error")),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => categoriesService.update(id, name),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.categories.all(user?.id ?? ""),
      });
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all(user?.id ?? "") });
      setEditingId(null);
      toast.success(t("success_update"));
    },
    onError: () => toast.error(t("error")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => categoriesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.categories.all(user?.id ?? ""),
      });
      toast.success(t("success_delete"));
    },
    onError: (error: Error) =>
      toast.error(t(error?.message === "category_in_use" ? "category_in_use" : "error")),
  });

  const handleAdd = () => {
    if (!newCategoryName.trim()) return;
    createMut.mutate(newCategoryName);
  };

  const handleUpdate = (id: string) => {
    if (!editingName.trim()) return;
    updateMut.mutate({ id, name: editingName });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-end">
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            {t("add")}
          </Button>
        )}
      </div>

      <Separator />

      <div className="settings-item-grid">
        {isAdding && (
          <CategoryFormRow
            name={newCategoryName}
            onNameChange={setNewCategoryName}
            onSubmit={handleAdd}
            onCancel={() => setIsAdding(false)}
          />
        )}

        {isLoading ? (
          <div className="contents">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 && !isAdding ? (
          <div className="col-span-full text-center py-12 border border-dashed rounded-3xl text-muted-foreground">
            <Tag className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>{t("no_categories")}</p>
          </div>
        ) : (
          categories.map((cat) =>
            editingId === cat.id ? (
              <CategoryFormRow
                key={cat.id}
                name={editingName}
                onNameChange={setEditingName}
                onSubmit={() => handleUpdate(cat.id)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <CategoryListItem
                key={cat.id}
                categoryName={categoryLabel(cat, t)}
                subscriptionCount={
                  subscriptions ? (subscriptionCounts.get(cat.id) ?? 0) : undefined
                }
                subscriptionCountError={subscriptionsError}
                onEdit={() => {
                  setEditingId(cat.id);
                  setEditingName(categoryLabel(cat, t));
                }}
                onDelete={() => {
                  setPendingDeleteId(cat.id);
                }}
              />
            ),
          )
        )}
      </div>

      <ConfirmDialog
        confirmOnEnter
        open={!!pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title={t("delete")}
        description={
          categoryUsageLoading ? (
            t("loading")
          ) : categoryUsage.isError ? (
            t("category_usage_load_error")
          ) : categoryUsageCount > 0 ? (
            <Trans
              t={t}
              i18nKey="category_delete_confirm"
              count={categoryUsageCount}
              components={{ strong: <strong className="font-bold" /> }}
            />
          ) : (
            t("confirm_delete")
          )
        }
        confirmDisabled={categoryUsageLoading || categoryUsage.isError}
        onConfirm={() => {
          if (!pendingDeleteId || categoryUsageLoading || categoryUsage.isError) return;
          deleteMut.mutate(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
