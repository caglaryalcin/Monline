import { Check, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CurrencyFlag, CurrencyLabel, FLAG_CURRENCY_CODES } from "@/components/CurrencyLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [manualCode, setManualCode] = useState(!!code && !FLAG_CURRENCY_CODES.includes(code.toUpperCase()));

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 p-3 rounded-2xl border border-border bg-card">
      {manualCode ? <div className="flex min-w-0 items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center"><CurrencyFlag code={code} /></span>
          <Input autoFocus value={code} onChange={event => onCodeChange(event.target.value)} placeholder={t("currency_code_placeholder")} aria-label={t("currency_code_placeholder")} className="h-10 min-w-0 bg-background pl-11" />
        </div>
        <Button type="button" size="icon" variant="ghost" className="h-10 w-8 shrink-0" aria-label={t("currency_choose_list")} title={t("currency_choose_list")} onClick={() => setManualCode(false)}><ChevronDown className="h-4 w-4" /></Button>
      </div> : <Select value={code.toUpperCase()} onValueChange={value => {
        if (value === "__manual__") setManualCode(true);
        else onCodeChange(value);
      }}>
        <SelectTrigger autoFocus={autoFocusCode} aria-label={t("currency_code_placeholder")} className="h-10 min-w-0 gap-2 bg-background"><SelectValue placeholder={t("currency_code_placeholder")} /></SelectTrigger>
        <SelectContent>
          {code && !FLAG_CURRENCY_CODES.includes(code.toUpperCase()) && <SelectItem value={code.toUpperCase()} textValue={code}><CurrencyLabel code={code.toUpperCase()} /></SelectItem>}
          {FLAG_CURRENCY_CODES.map(value => <SelectItem key={value} value={value} textValue={value}><CurrencyLabel code={value} /></SelectItem>)}
          <SelectItem value="__manual__">{t("currency_enter_code")}</SelectItem>
        </SelectContent>
      </Select>}
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
