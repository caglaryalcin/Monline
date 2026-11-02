import {
  type AriaAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { useNumberLocale } from "@/hooks/useNumberLocale";
import { formatNumber, parseNumberInput } from "@/lib/numberFormat";
import { cn, getCurrencyFractionDigits, getCurrencySymbol } from "@/lib/utils";

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
    const locale = useNumberLocale();
    const formatRaw = useCallback(
      (value: number) =>
        formatNumber(value, { useGrouping: false, maximumFractionDigits: 20 }, locale),
      [locale],
    );
    const numeric = typeof value === "string" ? parseFloat(value) || 0 : (value ?? 0);
    // Forms can distinguish a missing amount from an explicitly entered zero.
    const hasValue =
      Number.isFinite(numeric) && (numeric !== 0 || (!!onEmpty && value !== null && value !== ""));
    const [focused, setFocused] = useState(false);
    const [raw, setRaw] = useState(hasValue ? formatRaw(numeric) : "");
    const editingLocale = useRef(locale);
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current!);

    // Sync raw when value changes externally (e.g. form reset)
    useEffect(() => {
      if (!focused) {
        setRaw(hasValue ? formatRaw(numeric) : "");
      }
    }, [numeric, focused, hasValue, formatRaw]);

    const handleFocus = () => {
      editingLocale.current = locale;
      setFocused(true);
      setRaw(hasValue ? formatRaw(numeric) : "");
      // Select all on focus for easy replacement
      setTimeout(() => inputRef.current?.select(), 0);
    };

    const handleBlur = () => {
      setFocused(false);
      if (onEmpty && !/\p{Nd}/u.test(raw)) {
        onEmpty();
        setRaw("");
        onBlur?.();
        return;
      }
      const parsed = parseNumberInput(raw, editingLocale.current);
      onChange(parsed);
      setRaw(parsed > 0 || onEmpty ? formatRaw(parsed) : "");
      onBlur?.();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const str = e.target.value;
      setRaw(str);
      if (onEmpty && !/\p{Nd}/u.test(str)) {
        onEmpty();
        return;
      }
      const parsed = parseNumberInput(str, focused ? editingLocale.current : locale);
      onChange(parsed);
    };

    const fractionDigits = getCurrencyFractionDigits(code);
    const displayValue = focused
      ? raw
      : hasValue
        ? formatNumber(
            numeric,
            { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits },
            locale,
          )
        : "";
    const resolvedPlaceholder =
      placeholder ??
      formatNumber(
        0,
        {
          useGrouping: false,
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        },
        locale,
      );
    const currencySuffix = getCurrencySymbol(code || symbol || "", locale);

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
          className={cn(
            "flex-1 min-w-0 bg-transparent px-2 py-2 text-sm font-semibold outline-none placeholder:text-muted-foreground/50",
            currencySuffix && "pr-0 text-right",
          )}
        />
        {currencySuffix && (
          <span
            className="pr-3 text-muted-foreground text-sm font-medium select-none shrink-0"
            title={code}
          >
            {currencySuffix}
          </span>
        )}
      </div>
    );
  },
);
