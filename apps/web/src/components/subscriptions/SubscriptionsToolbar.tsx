import { ArrowUpDown, Filter, LayoutGrid, List, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { SubscriptionSortKey } from "@/components/subscriptions/subscriptionsPage.types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageToolbar, ToolbarSearch } from "@/components/ui/PageToolbar";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<SubscriptionSortKey, string> = {
  name: "sort_by_name",
  date: "next_payment",
  price: "sort_by_price",
  status: "sort_by_status",
};

interface SubscriptionsToolbarProps {
  searchTerm: string;
  showFilters: boolean;
  view: "grid" | "list";
  sort: SubscriptionSortKey;
  sortDir: "asc" | "desc";
  onSortChange: (value: SubscriptionSortKey) => void;
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
  sort,
  sortDir,
  onSortChange,
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-[42px] gap-2 border-transparent bg-background/50 px-4"
            aria-label={t("sort")}
            title={`${t(SORT_LABELS[sort])} · ${t(sortDir === "asc" ? "sort_ascending" : "sort_descending")}`}
          >
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="hidden sm:inline">
              {t(sort === "name" ? "sort" : SORT_LABELS[sort])}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("sort")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sort}
            aria-label={t("sort")}
            onValueChange={(value) => onSortChange(value as SubscriptionSortKey)}
          >
            {(Object.keys(SORT_LABELS) as SubscriptionSortKey[]).map((key) => (
              <DropdownMenuRadioItem key={key} value={key}>
                {t(SORT_LABELS[key])}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("sort_order")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sortDir}
            aria-label={t("sort_order")}
            onValueChange={(value) => {
              if (value !== sortDir) onCycleSort();
            }}
          >
            <DropdownMenuRadioItem value="asc">{t("sort_ascending")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc">{t("sort_descending")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </PageToolbar>
  );
}
