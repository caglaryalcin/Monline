import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export function SettingsDisclosureButton({
  name,
  expanded,
  controls,
  disabled,
  onToggle,
}: {
  name: string;
  expanded: boolean;
  controls: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const label = `${name} · ${t(expanded ? "collapse_settings" : "expand_settings")}`;
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-8 w-8 shrink-0 text-muted-foreground"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      aria-controls={controls}
      disabled={disabled}
      onClick={onToggle}
    >
      <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </Button>
  );
}
