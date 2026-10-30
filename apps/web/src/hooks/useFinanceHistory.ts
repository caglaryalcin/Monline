import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { FinanceEntry } from "@/lib/finance";
import { type FinanceHistory, financeService } from "@/services/finance";

export function useFinanceHistory(owner: string | undefined, onSaved: () => Promise<unknown>) {
  const { t } = useTranslation();
  const undoStack = useRef<FinanceHistory[]>([]);
  const redoStack = useRef<FinanceHistory[]>([]);
  const accountGeneration = useRef(0);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [, render] = useState(0);
  useEffect(() => {
    accountGeneration.current++;
    undoStack.current = [];
    redoStack.current = [];
    render((value) => value + 1);
  }, [owner]);
  const execute = async <T>(action: () => Promise<T>): Promise<T> => {
    if (locked.current) throw new Error("finance_history_busy");
    locked.current = true;
    setBusy(true);
    const generation = accountGeneration.current;
    try {
      const result = await action();
      // A delayed response from a previous account must not become undoable
      // in the account now being viewed, even if the user switched back again.
      if (generation !== accountGeneration.current) return result;
      const history = (result as { history?: FinanceHistory } | null)?.history;
      if (
        history &&
        (history.before.length ||
          history.after.length ||
          history.rows?.before.length ||
          history.rows?.after.length ||
          history.transactions?.before.length ||
          history.transactions?.after.length ||
          history.links?.before.length || history.links?.after.length ||
          history.matches?.before.length || history.matches?.after.length ||
          history.moves?.before.length || history.moves?.after.length)
      ) {
        undoStack.current = [...undoStack.current.slice(-49), history];
        redoStack.current = [];
        render((value) => value + 1);
      }
      await onSaved();
      return result;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const restore = async (redo = false) => {
    if (locked.current) return;
    const from = redo ? redoStack : undoStack,
      to = redo ? undoStack : redoStack;
    const change = from.current.at(-1);
    if (!change) return;
    locked.current = true;
    setBusy(true);
    const generation = accountGeneration.current;
    try {
      const result = await financeService.restore(change);
      if (generation !== accountGeneration.current) return;
      from.current.pop();
      to.current.push(result.history);
      render((value) => value + 1);
      await onSaved();
      toast.success(t(redo ? "finance_redone" : "finance_undone"));
    } catch (error) {
      if (generation !== accountGeneration.current) return;
      toast.error(
        t(
          error instanceof Error && error.message === "finance_history_conflict"
            ? "finance_history_conflict"
            : "finance_history_failed",
        ),
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.defaultPrevented) return;
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        target.closest("input,textarea,select,[contenteditable='true']") ||
        document.querySelector("[role='dialog'][data-state='open']")
      )
        return;
      if (
        target !== document.body &&
        target !== document.documentElement &&
        !target.closest(".finance-workbook")
      )
        return;
      if (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y") {
        event.preventDefault();
        event.stopPropagation();
        void restore(event.shiftKey || event.key.toLowerCase() === "y");
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  });
  return {
    busy,
    execute,
    undo: () => restore(),
    redo: () => restore(true),
    canUndo: !!undoStack.current.length,
    canRedo: !!redoStack.current.length,
    update: (
      entries: FinanceEntry[],
      patch: Partial<Pick<FinanceEntry, "notes" | "status" | "settled_date" | "payment_tag">>,
    ) => {
      const normalize = (entry: FinanceEntry) => ({
        ...entry,
        source_payment: entry.source_payment || "",
      });
      return execute(() =>
        financeService.restore({
          before: entries.map((entry) => normalize({ ...entry, ...patch })),
          after: entries.map(normalize),
        }),
      );
    },
  };
}
