import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface DisplayToggleCardProps {
  checked: boolean;
  description: string;
  label: string;
  onToggle: () => void;
}

export function DisplayToggleCard({
  checked,
  description,
  label,
  onToggle,
}: DisplayToggleCardProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="flex h-full min-w-0 items-start justify-between gap-4 rounded-2xl border bg-card p-4 transition-colors">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="text-sm font-medium leading-snug cursor-pointer">
          {label}
        </Label>
        <p id={`${id}-description`} className="text-sm leading-relaxed text-muted-foreground">
          {description || t("display_desc")}
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-description`}
        checked={checked}
        onCheckedChange={onToggle}
        className="shrink-0 mt-0.5"
      />
    </div>
  );
}
