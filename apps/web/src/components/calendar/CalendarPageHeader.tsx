import { History, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface CalendarPageHeaderProps {
  onAddHistorical?: () => void;
  onClearAll?: () => void;
  clearDisabled?: boolean;
}

export function CalendarPageHeader({
  onAddHistorical,
  onClearAll,
  clearDisabled,
}: CalendarPageHeaderProps) {
  const { t } = useTranslation();
  if (!onAddHistorical && !onClearAll) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
      {onClearAll && (
        <Button
          variant="outline"
          className="rounded-xl border-destructive/40 text-destructive"
          disabled={clearDisabled}
          onClick={onClearAll}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("calendar_clear_payments")}
        </Button>
      )}
      {onAddHistorical && (
        <Button onClick={onAddHistorical} className="rounded-xl">
          <History className="mr-2 h-4 w-4" />
          {t("historical_add")}
        </Button>
      )}
    </div>
  );
}
