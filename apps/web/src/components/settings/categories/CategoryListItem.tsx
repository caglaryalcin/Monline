import { Edit2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface CategoryListItemProps {
  categoryName: string;
  onDelete: () => void;
  onEdit: () => void;
}

export function CategoryListItem({ categoryName, onDelete, onEdit }: CategoryListItemProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-24 min-w-0 flex-col justify-between gap-3 p-4 rounded-2xl border bg-card transition-colors group">
      <span className="break-words text-sm font-medium">{categoryName}</span>
      <div className="flex shrink-0 justify-end gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground "
          aria-label={t("edit")}
          onClick={onEdit}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive/70 "
          aria-label={t("delete")}
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
