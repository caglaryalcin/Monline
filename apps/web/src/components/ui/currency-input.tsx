import {
  type AriaAttributes,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { cn, getCurrencyFractionDigits } from "@/lib/utils";

interface CurrencyInputProps {
  value: number | string | null;
  onChange: (value: number) => void;
  onEmpty?: () => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  "aria-describedby"?: string;
  symbol?: string;
  code?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function formatNumber(val: number, code?: string): string {
  if (!Number.isFinite(val)) return "";
  const fractionDigits = getCurrencyFractionDigits(code);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(val);
}

function parseRaw(raw: string): number {
  // Allow both . and , as decimal separator; strip thousands separators
  const cleaned = raw
    .replace(/[^\d.,]/g, "")
    // If both . and , exist, the last one is the decimal separator
    .replace(/[.,](?=.*[.,])/g, ""); // remove all but last separator
  const normalized = cleaned.replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    {
      value,
      onChange,
      onEmpty,
      onBlur,
      id,
      name,
      "aria-invalid": invalid,
      "aria-describedby": describedBy,
      symbol,
      code,
      placeholder,
      className,
      disabled,
    },
    ref,
  ) {
    const numeric = typeof value === "string" ? parseFloat(value) || 0 : (value ?? 0);
    // Forms can distinguish a missing amount from an explicitly entered zero.
    const hasValue = numeric > 0 || (!!onEmpty && value !== null && value !== "");
    const [focused, setFocused] = useState(false);
    const [raw, setRaw] = useState(hasValue ? String(numeric) : "");
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current!);

    // Sync raw when value changes externally (e.g. form reset)
    useEffect(() => {
      if (!focused) {
        setRaw(hasValue ? String(numeric) : "");
      }
    }, [numeric, focused, hasValue]);

    const handleFocus = () => {
      setFocused(true);
      setRaw(hasValue ? String(numeric) : "");
      // Select all on focus for easy replacement
      setTimeout(() => inputRef.current?.select(), 0);
    };

    const handleBlur = () => {
      setFocused(false);
      if (onEmpty && !/\d/.test(raw)) {
        onEmpty();
        setRaw("");
        onBlur?.();
        return;
      }
      const parsed = parseRaw(raw);
      onChange(parsed);
      setRaw(parsed > 0 || onEmpty ? String(parsed) : "");
      onBlur?.();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const str = e.target.value;
      setRaw(str);
      if (onEmpty && !/\d/.test(str)) {
        onEmpty();
        return;
      }
      const parsed = parseRaw(str);
      onChange(parsed);
    };

    const fractionDigits = getCurrencyFractionDigits(code);
    const displayValue = focused ? raw : hasValue ? formatNumber(numeric, code) : "";
    const resolvedPlaceholder = placeholder ?? (fractionDigits === 0 ? "0" : "0,00");

    return (
      <div
        className={cn(
          "flex items-center h-10 rounded-xl border bg-muted/50 transition-colors",
          "focus-within:bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
          invalid &&
            invalid !== "false" &&
            "border-destructive bg-destructive/5 focus-within:ring-destructive",
          disabled && "opacity-50 pointer-events-none",
          className,
        )}
      >
        {symbol && (
          <span className="pl-3 pr-1 text-muted-foreground text-sm font-medium select-none shrink-0">
            {symbol}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          name={name}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={resolvedPlaceholder}
          disabled={disabled}
          className="flex-1 min-w-0 bg-transparent px-2 py-2 text-sm font-semibold outline-none placeholder:text-muted-foreground/50"
        />
        {code && (
          <span className="pr-3 pl-1 text-muted-foreground/60 text-xs font-medium uppercase tracking-wider select-none shrink-0">
            {code}
          </span>
        )}
      </div>
    );
  },
);
