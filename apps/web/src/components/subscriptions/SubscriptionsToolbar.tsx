import { ArrowUpDown, Filter, LayoutGrid, List, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { PageToolbar, ToolbarSearch } from "@/components/ui/PageToolbar";
import { cn } from "@/lib/utils";

interface SubscriptionsToolbarProps {
  searchTerm: string;
  showFilters: boolean;
  view: "grid" | "list";
  onSearchChange: (value: string) => void;
  onToggleFilters: () => void;
  onCycleSort: () => void;
  onViewChange: (view: "grid" | "list") => void;
  onDeleteAll?: () => void;
  deleteAllDisabled?: boolean;
  transferActions?: ReactNode;
  primaryAction?: ReactNode;
}

export function SubscriptionsToolbar({
  searchTerm,
  showFilters,
  view,
  onSearchChange,
  onToggleFilters,
  onCycleSort,
  onViewChange,
  onDeleteAll,
  deleteAllDisabled,
  transferActions,
  primaryAction,
}: SubscriptionsToolbarProps) {
  const { t } = useTranslation();

  return (
    <PageToolbar
      primaryAction={primaryAction}
      actions={
        <>
          {onDeleteAll && (
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-xl border-destructive/40 text-destructive"
              disabled={deleteAllDisabled}
              onClick={onDeleteAll}
              title={t("delete_all_subscriptions")}
              aria-label={t("delete_all_subscriptions")}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden xl:inline">{t("delete_all_subscriptions")}</span>
            </Button>
          )}
          {transferActions}
        </>
      }
    >
      <ToolbarSearch
        value={searchTerm}
        onChange={onSearchChange}
        label={t("search")}
        placeholder={t("search") + "..."}
      />
      <div className="flex rounded-lg bg-background/50 p-[3px]" role="group" aria-label={t("view")}>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9", view === "grid" && "bg-accent text-primary shadow-sm")}
          aria-label={t("grid_view")}
          title={t("grid_view")}
          aria-pressed={view === "grid"}
          onClick={() => onViewChange("grid")}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9", view === "list" && "bg-accent text-primary shadow-sm")}
          aria-label={t("list_view")}
          title={t("list_view")}
          aria-pressed={view === "list"}
          onClick={() => onViewChange("list")}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
      <Button
        variant="outline"
        className={cn(
          "h-[42px] gap-2 border-transparent bg-background/50 px-4",
          showFilters && "border-border bg-accent/80",
        )}
        onClick={onToggleFilters}
      >
        <Filter className={cn("h-4 w-4", showFilters ? "text-primary" : "text-muted-foreground")} />
        <span className="hidden sm:inline">{t("filter")}</span>
      </Button>

      <Button
        variant="outline"
        className="h-[42px] gap-2 border-transparent bg-background/50 px-4"
        onClick={onCycleSort}
      >
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">{t("sort")}</span>
      </Button>
    </PageToolbar>
  );
}
