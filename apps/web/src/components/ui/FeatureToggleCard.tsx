import { Power } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Props {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  description?: string;
  disabled?: boolean;
}

export function FeatureToggleCard({ enabled, onEnabledChange, description, disabled }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-4 transition-colors",
        enabled
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100"
          : "border-border bg-muted/30 text-muted-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          enabled ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted",
        )}
      >
        <Power className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="font-semibold">
          {t(enabled ? "enabled" : "disabled")}
        </Label>
        {description && (
          <p
            id={`${id}-description`}
            className={cn(
              "mt-0.5 text-xs leading-relaxed",
              enabled ? "text-emerald-800 dark:text-emerald-200/80" : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={enabled}
        onCheckedChange={onEnabledChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-description` : undefined}
        className="data-[state=checked]:bg-emerald-600 dark:data-[state=checked]:bg-emerald-500"
      />
    </div>
  );
}
