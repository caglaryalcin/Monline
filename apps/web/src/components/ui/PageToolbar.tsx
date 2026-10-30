import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PageToolbar({
  primaryAction,
  actions,
  children,
}: {
  primaryAction?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {primaryAction}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl border bg-card/40 shadow-sm backdrop-blur-md sm:min-w-[min(100%,240px)]">
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ToolbarSearch({
  value,
  onChange,
  label,
  placeholder = label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative min-w-[140px] flex-1">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        className="h-[42px] rounded-xl border-transparent bg-background/50 pl-10 pr-10 text-base placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/50 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("calendar_clear_search")}
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
