import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function SpreadsheetInfo({ title, children, disabled = false }: {
  title: string; children: ReactNode; disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon"
          disabled={disabled}
          className="h-7 w-7 shrink-0 rounded-full text-muted-foreground"
          aria-label={t("spreadsheet_schedule_info", { section: title })}>
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12}
        className="w-80 max-w-[calc(100vw-1.5rem)] max-h-[min(28rem,var(--radix-popover-content-available-height))] overflow-y-auto p-4">
        <h4 className="mb-2 text-sm font-semibold">{title}</h4>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
