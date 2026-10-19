import { Edit2, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface HouseholdMemberListItemProps {
  memberName: string;
  onDelete: () => void;
  onEdit: () => void;
  isMain?: boolean;
  onSetMain?: () => void;
  mainPending?: boolean;
}

export function HouseholdMemberListItem({
  memberName,
  onDelete,
  onEdit,
  isMain = false,
  onSetMain,
  mainPending = false,
}: HouseholdMemberListItemProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl border bg-card transition-colors group">
      <span className="min-w-0 break-words font-medium text-lg">{memberName}</span>
      <div className="flex opacity-100 transition-opacity">
        {onSetMain && (
          <Button
            size="icon"
            variant="ghost"
            className={isMain ? "text-primary" : "text-muted-foreground"}
            aria-label={t(isMain ? "main_household_member" : "set_as_main_household_member")}
            title={t(isMain ? "main_household_member" : "set_as_main_household_member")}
            aria-pressed={isMain}
            disabled={isMain || mainPending}
            onClick={onSetMain}
          >
            <Star className={`h-4 w-4 ${isMain ? "fill-current" : ""}`} />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground "
          onClick={onEdit}
          aria-label={t("edit")}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive/70 "
          onClick={onDelete}
          aria-label={t("delete")}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
