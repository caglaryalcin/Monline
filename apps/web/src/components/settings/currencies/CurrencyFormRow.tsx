import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CurrencyFormRowProps {
  code: string;
  symbol: string;
  name: string;
  autoFocusCode?: boolean;
  onCodeChange: (value: string) => void;
  onSymbolChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CurrencyFormRow({
  code,
  symbol,
  name,
  autoFocusCode = false,
  onCodeChange,
  onSymbolChange,
  onNameChange,
  onSubmit,
  onCancel,
}: CurrencyFormRowProps) {
  const { t } = useTranslation();

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 p-3 rounded-2xl border border-border bg-card">
      <Input
        autoFocus={autoFocusCode}
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder={t("currency_code_placeholder")}
        className="min-w-0 bg-background h-10"
      />
      <Input
        value={symbol}
        onChange={(e) => onSymbolChange(e.target.value)}
        placeholder={t("currency_symbol_placeholder")}
        className="min-w-0 bg-background h-10"
      />
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("currency_name_placeholder")}
        className="col-span-2 min-w-0 bg-background h-10"
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      />
      <div className="col-span-2 flex justify-end gap-1">
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
