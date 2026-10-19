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
    <div className="flex min-w-0 flex-col gap-3 p-4 rounded-2xl border border-border bg-card">
      <Input
        autoFocus
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("category_name_placeholder")}
        className="rounded-xl border-input bg-background text-sm focus-visible:ring-ring"
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      />
      <div className="flex justify-end gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 text-primary"
          onClick={onSubmit}
          aria-label={t("save")}
        >
          <Check className="w-5 h-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 text-muted-foreground"
          onClick={onCancel}
          aria-label={t("cancel")}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
