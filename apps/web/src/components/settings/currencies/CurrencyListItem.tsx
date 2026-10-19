import { Edit2, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SelectionCheckbox } from "@/components/settings/shared/BulkSettingsActions";
import { Button } from "@/components/ui/button";
import type { Currency } from "@/types";

interface CurrencyListItemProps {
  currency: Currency;
  onDelete: () => void;
  onEdit: () => void;
  onSetMain: () => void;
  selected?: boolean;
  onSelect?: () => void;
}

export function CurrencyListItem({
  currency,
  onDelete,
  onEdit,
  onSetMain,
  selected = false,
  onSelect,
}: CurrencyListItemProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex min-h-32 min-w-0 flex-col justify-between gap-3 p-4 rounded-2xl border transition-colors group ${
        currency.is_main ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-card "
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        {onSelect && (
          <SelectionCheckbox
            name={currency.code}
            checked={selected}
            disabled={currency.is_main}
            onChange={onSelect}
          />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-semibold tracking-tight">{currency.code}</span>
            <span className="rounded-lg bg-muted px-2.5 py-1 text-base font-medium text-foreground">
              {currency.symbol}
            </span>
          </div>
          {currency.name && (
            <p className="mt-1.5 break-words text-sm text-muted-foreground">{currency.name}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => !currency.is_main && onSetMain()}
          className={`shrink-0 p-1.5 rounded-lg transition-colors focus-visible:outline focus-visible:outline-ring ${
            currency.is_main ? "text-primary bg-primary/10 " : "text-muted-foreground "
          }`}
          title={t(currency.is_main ? "main_currency" : "set_as_main")}
          aria-label={t(currency.is_main ? "main_currency" : "set_as_main")}
          aria-pressed={currency.is_main}
        >
          <Star className={`w-4 h-4 ${currency.is_main ? "fill-current" : ""}`} />
        </button>
      </div>
      <div className="flex min-h-8 shrink-0 justify-end gap-1">
        {!currency.is_main && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground "
            aria-label={t("edit")}
            onClick={onEdit}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        )}
        {!currency.is_main && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive/70 "
            aria-label={t("delete")}
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
