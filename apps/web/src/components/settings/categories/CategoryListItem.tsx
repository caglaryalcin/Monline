import { Edit2, Trash2 } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface CategoryListItemProps {
  categoryName: string;
  subscriptionCount?: number;
  subscriptionCountError?: boolean;
  onDelete: () => void;
  onEdit: () => void;
}

export function CategoryListItem({
  categoryName,
  subscriptionCount,
  subscriptionCountError,
  onDelete,
  onEdit,
}: CategoryListItemProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-card px-3 py-3 transition-colors group">
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <span className="max-w-full break-words text-sm font-medium">{categoryName}</span>
        <span
          className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground tabular-nums"
          aria-busy={subscriptionCount === undefined && !subscriptionCountError}
          title={
            subscriptionCountError
              ? t("error")
              : subscriptionCount === undefined
                ? t("loading")
                : undefined
          }
        >
          {subscriptionCount === undefined ? (
            "—"
          ) : (
            <Trans
              t={t}
              i18nKey="category_subscription_count"
              count={subscriptionCount}
              components={{ strong: <strong className="font-bold" /> }}
            />
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground"
          aria-label={t("edit")}
          onClick={onEdit}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive/70"
          aria-label={t("delete")}
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
