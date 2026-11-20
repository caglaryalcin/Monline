import {
  type AriaAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useNumberLocale } from "@/hooks/useNumberLocale";
import { formatNumber, numberFormatter, parseNumberInput } from "@/lib/numberFormat";
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
  groupWhileEditing?: boolean;
}

function editingSeparators(locale: string) {
  const parts = numberFormatter({}, locale).formatToParts(12345.6);
  return {
    decimal: parts.find(part => part.type === "decimal")?.value || ".",
    group: parts.find(part => part.type === "group")?.value || ",",
  };
}

function groupedEditingValue(value: string, locale: string) {
  const { decimal, group } = editingSeparators(locale);
  const ungrouped = value.split(group).join("");
  const decimalIndex = ungrouped.indexOf(decimal);
  const integer = (decimalIndex < 0 ? ungrouped : ungrouped.slice(0, decimalIndex)).replace(/[^\p{Nd}]/gu, "");
  const fraction = decimalIndex < 0 ? "" : ungrouped.slice(decimalIndex + decimal.length).replace(/[^\p{Nd}]/gu, "");
  const sign = value.trim().startsWith("-") ? "-" : "";
  if (!integer && decimalIndex < 0) return sign;
  return sign + formatNumber(parseNumberInput(integer, locale), { maximumFractionDigits: 0 }, locale)
    + (decimalIndex < 0 ? "" : decimal + fraction);
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
      groupWhileEditing = false,
    },
    ref,
  ) {
    const locale = useNumberLocale();
    const formatRaw = useCallback(
      (value: number) =>
        formatNumber(value, { useGrouping: groupWhileEditing, maximumFractionDigits: 20 }, locale),
      [locale, groupWhileEditing],
    );
    const numeric = typeof value === "string" ? parseFloat(value) || 0 : (value ?? 0);
    // Forms can distinguish a missing amount from an explicitly entered zero.
    const hasValue =
      Number.isFinite(numeric) && (numeric !== 0 || (!!onEmpty && value !== null && value !== ""));
    const [focused, setFocused] = useState(false);
    const [raw, setRaw] = useState(hasValue ? formatRaw(numeric) : "");
    const editingLocale = useRef(locale);
    const inputRef = useRef<HTMLInputElement>(null);
    const pendingCaret = useRef<number | null>(null);
    useImperativeHandle(ref, () => inputRef.current!);
    useLayoutEffect(() => {
      if (focused && pendingCaret.current !== null) {
        inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
        pendingCaret.current = null;
      }
    });

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
      let str = e.target.value;
      const activeLocale = focused ? editingLocale.current : locale;
      if (groupWhileEditing) {
        const { decimal, group } = editingSeparators(activeLocale);
        let caret = e.target.selectionStart ?? str.length;
        const inputType = (e.nativeEvent as InputEvent).inputType;
        if (inputType === "insertFromPaste" && /\p{Nd}/u.test(str)) {
          str = formatRaw(parseNumberInput(str, activeLocale));
          caret = str.length;
        }
        // Deleting a separator should also delete the adjacent digit instead of restoring it.
        if (str.length === raw.length - group.length && raw.slice(caret, caret + group.length) === group
          && raw.slice(0, caret) + raw.slice(caret + group.length) === str) {
          if (inputType === "deleteContentBackward" && caret > 0) {
            str = str.slice(0, caret - 1) + str.slice(caret);
            caret--;
          } else if (inputType === "deleteContentForward") {
            str = str.slice(0, caret) + str.slice(caret + 1);
          }
        }
        const significant = (character: string) => /\p{Nd}/u.test(character) || character === decimal || character === "-";
        const beforeCaret = Array.from(str.slice(0, caret)).filter(significant).length;
        str = groupedEditingValue(str, activeLocale);
        let remaining = beforeCaret;
        let position = 0;
        for (const character of str) {
          if (remaining <= 0) break;
          position += character.length;
          if (significant(character)) remaining--;
        }
        pendingCaret.current = position;
      }
      setRaw(str);
      if (onEmpty && !/\p{Nd}/u.test(str)) {
        onEmpty();
        return;
      }
      const parsed = parseNumberInput(str, activeLocale);
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
