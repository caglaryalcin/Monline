import { type SetStateAction, useCallback, useRef, useState } from "react";

import { LS_KEYS } from "@/lib/constants";

function readPreference<T>(
  key: string | undefined,
  fallback: T,
  valid: (value: unknown) => value is T,
): T {
  if (!key) return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const value: unknown = JSON.parse(stored);
      if (valid(value)) return value;
    }
  } catch {
    // A missing or unavailable preference must not block the page.
  }
  return fallback;
}

function usePreference<T>(
  key: string | undefined,
  fallback: T,
  valid: (value: unknown) => value is T,
) {
  const [state, setState] = useState(() => ({
    key,
    value: readPreference(key, fallback, valid),
  }));
  const value = state.key === key ? state.value : readPreference(key, fallback, valid);
  const current = useRef({ key, value });
  current.current = { key, value };

  const setValue = useCallback((update: SetStateAction<T>) => {
    const previous = current.current.key === key
      ? current.current.value
      : readPreference(key, fallback, valid);
    const next = typeof update === "function"
      ? (update as (value: T) => T)(previous)
      : update;
    const selection = { key, value: next };
    current.current = selection;
    setState(selection);
    try {
      if (key) localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Keep the current page usable when browser storage is disabled or full.
    }
  }, [key, fallback, valid]);

  return [value, setValue] as const;
}

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const EMPTY_ITEMS: string[] = [];

export function usePersistentDisclosure(
  userId: string | undefined,
  section: string,
  defaultOpen = false,
) {
  return usePreference(userId ? LS_KEYS.disclosure(userId, section) : undefined, defaultOpen, isBoolean);
}

export function usePersistentExpandedItems(userId: string | undefined, section: string) {
  const [items, setItems] = usePreference(
    userId ? LS_KEYS.disclosure(userId, section) : undefined,
    EMPTY_ITEMS,
    isStringList,
  );
  const toggleItem = (id: string) => setItems((previous) =>
    previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
  );
  return [new Set(items), toggleItem] as const;
}
