import { useEffect, useRef, useState } from "react";

import type { FinanceEntry, FinanceRow } from "@/lib/finance";
import { parseClipboardAmount } from "@/lib/financeClipboard";

export function FinanceQuickAmount({
  row,
  entries,
  title,
  language,
  label,
  pending,
  onSave,
  onCancel,
}: {
  row: FinanceRow;
  entries: FinanceEntry[];
  title: string;
  language: string;
  label: (key: string) => string;
  pending: boolean;
  onSave: (amounts: (number | null)[], focus: boolean) => Promise<boolean>;
  onCancel: (focus: boolean) => void;
}) {
  const [values, setValues] = useState(() =>
    entries.length
      ? entries.map((entry) =>
          new Intl.NumberFormat(language, {
            useGrouping: false,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(entry.amount),
        )
      : [""],
  );
  const [invalid, setInvalid] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => {
    firstInput.current?.focus();
    firstInput.current?.select();
  }, []);
  const commit = async (focus: boolean) => {
    if (saving.current || cancelled.current || pending) return;
    if (!entries.length && !values[0].trim()) {
      cancelled.current = true;
      onCancel(focus);
      return;
    }
    let amounts: (number | null)[];
    try {
      amounts = values.map((value) => parseClipboardAmount(value));
    } catch {
      setInvalid(true);
      if (focus) firstInput.current?.focus();
      return;
    }
    setInvalid(false);
    saving.current = true;
    try {
      await onSave(amounts, focus);
    } finally {
      saving.current = false;
    }
  };
  return (
    <form
      className="finance-sheet__quick-edit"
      aria-label={title + " · " + label("quick_edit")}
      onSubmit={(event) => {
        event.preventDefault();
        void commit(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) void commit(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.stopPropagation();
          void commit(true);
        }
        if (event.key === "Escape" && !pending) {
          event.preventDefault();
          event.stopPropagation();
          cancelled.current = true;
          onCancel(true);
        }
      }}
    >
      {values.map((value, index) => {
        const entry = entries[index];
        const status =
          row.kind === "expense"
            ? entry?.status === "settled"
              ? "expense_paid"
              : "expense_pending"
            : entry?.status === "settled"
              ? "income_received"
              : "income_expected";
        return (
          <label key={entry?.id || "new"}>
            {entries.length > 1 && (
              <span className="finance-sheet__quick-label">
                {label(status)} · {entry.date}
              </span>
            )}
            <input
              ref={index === 0 ? firstInput : undefined}
              type="text"
              inputMode="decimal"
              value={value}
              maxLength={32}
              aria-label={
                title + " · " + label("amount") + (entries.length > 1 ? ` · ${index + 1}` : "")
              }
              aria-invalid={invalid || undefined}
              disabled={pending}
              onChange={(event) => {
                setValues((current) =>
                  current.map((old, at) => (at === index ? event.target.value : old)),
                );
                setInvalid(false);
              }}
            />
          </label>
        );
      })}
      {invalid && <span role="alert">{label("quick_invalid")}</span>}
    </form>
  );
}
