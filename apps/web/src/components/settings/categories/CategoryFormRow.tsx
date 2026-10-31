import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CategoryFormRowProps {
  name: string;
  onCancel: () => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
}

export function CategoryFormRow({ name, onCancel, onNameChange, onSubmit }: CategoryFormRowProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("category_name_placeholder")}
        className="h-8 min-w-0 flex-1 rounded-lg border-input bg-background text-sm focus-visible:ring-ring"
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      />
      <div className="flex shrink-0 justify-end gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-primary"
          onClick={onSubmit}
          aria-label={t("save")}
        >
          <Check className="w-5 h-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          onClick={onCancel}
          aria-label={t("cancel")}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
