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
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 transition-colors group">
      <span className="min-w-0 break-words text-sm font-medium">{categoryName}</span>
      <div className="flex shrink-0 justify-end gap-1">
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
