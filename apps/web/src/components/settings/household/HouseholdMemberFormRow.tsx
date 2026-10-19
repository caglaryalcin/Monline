import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HouseholdMemberFormRowProps {
  name: string;
  onCancel: () => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
}

export function HouseholdMemberFormRow({
  name,
  onCancel,
  onNameChange,
  onSubmit,
}: HouseholdMemberFormRowProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-border bg-card">
      <Input
        autoFocus
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("member_name_placeholder")}
        className="min-w-0 flex-1 rounded-xl border-input bg-background text-sm focus-visible:ring-ring"
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      />
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 text-primary"
        onClick={onSubmit}
      >
        <Check className="w-5 h-5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 text-muted-foreground"
        onClick={onCancel}
      >
        <X className="w-5 h-5" />
      </Button>
    </div>
  );
}
