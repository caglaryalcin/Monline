import { useEffect, useRef, useState } from "react";

export function FinanceQuickName({
  name,
  label,
  requiredLabel,
  pending,
  onSave,
  onCancel,
}: {
  name: string;
  label: string;
  requiredLabel: string;
  pending: boolean;
  onSave: (name: string, focus: boolean) => Promise<boolean>;
  onCancel: (focus: boolean) => void;
}) {
  const [value, setValue] = useState(name);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const commit = async (focus: boolean) => {
    if (saving.current || cancelled.current || pending) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setInvalid(true);
      return;
    }
    saving.current = true;
    try {
      await onSave(trimmed, focus);
    } finally {
      saving.current = false;
    }
  };
  return (
    <form
      className="finance-sheet__quick-name"
      onSubmit={(event) => {
        event.preventDefault();
        void commit(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) void commit(false);
      }}
      onContextMenu={(event) => event.stopPropagation()}
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
      <input
        ref={input}
        type="text"
        aria-label={label}
        value={value}
        maxLength={160}
        disabled={pending}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          setValue(event.target.value);
          setInvalid(false);
        }}
      />
      {invalid && <span role="alert">{requiredLabel}</span>}
    </form>
  );
}
