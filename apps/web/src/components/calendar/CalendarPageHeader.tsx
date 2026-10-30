import { History, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { PageToolbar, ToolbarSearch } from "@/components/ui/PageToolbar";

interface CalendarPageHeaderProps {
  onAddHistorical?: () => void;
  onClearAll?: () => void;
  clearDisabled?: boolean;
  transferActions?: ReactNode;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
}

export function CalendarPageHeader({
  onAddHistorical,
  onClearAll,
  clearDisabled,
  transferActions,
  searchTerm = "",
  onSearchChange,
}: CalendarPageHeaderProps) {
  const { t } = useTranslation();
  if (!onAddHistorical && !onClearAll && !onSearchChange) return null;
  return (
    <PageToolbar
      primaryAction={
        onAddHistorical && (
          <Button
            onClick={onAddHistorical}
            className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-primary/90 to-primary font-semibold shadow-md transition-all"
          >
            <History className="mr-1.5 h-5 w-5" />
            {t("historical_add")}
          </Button>
        )
      }
      actions={
        <>
          {onClearAll && (
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-xl border-destructive/40 text-destructive"
              title={t("calendar_clear_payments")}
              aria-label={t("calendar_clear_payments")}
              disabled={clearDisabled}
              onClick={onClearAll}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden xl:inline">{t("calendar_clear_payments")}</span>
            </Button>
          )}
          {transferActions}
        </>
      }
    >
      {onSearchChange && (
        <ToolbarSearch value={searchTerm} onChange={onSearchChange} label={t("calendar_search")} />
      )}
    </PageToolbar>
  );
}
