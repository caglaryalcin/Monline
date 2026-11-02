import { useEffect, useState } from "react";

import { LS_KEYS } from "@/lib/constants";

function readRows(key: string | null): string[] {
  if (!key) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** A display preference scoped to the account and year; financial data stays intact. */
export function useHiddenFinanceRows(userId: string | undefined, year: number) {
  const key = userId ? LS_KEYS.financeHiddenRows(userId, year) : null;
  const [saved, setSaved] = useState(() => ({ key, rows: readRows(key) }));
  const rows = saved.key === key ? saved.rows : readRows(key);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setSaved({ key, rows: readRows(key) });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  const update = (next: string[]) => {
    setSaved({ key, rows: next });
    try {
      if (key) localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Keep the preference in memory when browser storage is unavailable.
    }
  };
  return {
    hiddenRowIds: new Set(rows),
    hideRows: (ids: string[]) => update([...new Set([...rows, ...ids])]),
    showRow: (id: string) => update(rows.filter((row) => row !== id)),
    showAllRows: () => update([]),
  };
}
