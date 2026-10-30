import type { ClipboardEvent, KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { FinanceData, FinanceEntry, FinanceRow } from "@/lib/finance";
import {
  clipboardHtml,
  copyFinanceCells,
  copyFinanceMetadata,
  FINANCE_CLIPBOARD_TYPE,
  type FinanceClipboard,
  type GridPoint,
  type GridSelection,
  prepareFinancePaste,
  readFinanceMetadata,
  selectionBounds,
  selectionColumns,
  selectionContains,
  selectionPoints,
  selectionRows,
  toggleSelectionCells,
} from "@/lib/financeClipboard";
import { type FinanceCellSnapshot, financeService } from "@/services/finance";

type GridContext = {x:number;y:number} & (
 | {row:FinanceRow;month:number;scope?:undefined}
 | {row:FinanceRow;scope:"row";month?:undefined}
 | {row?:undefined;month?:undefined;scope?:undefined}
);

type Section = "summary" | "income" | "expense";
type Drag = { type: "cell"; anchor: GridPoint } | { type: "column"; section: Section; col: number };
type CutBuffer = { cells: FinanceCellSnapshot[]; height: number; width: number; layout?: GridPoint[]; text: string; metadata: FinanceClipboard };
let internalClipboard: { text: string; metadata: FinanceClipboard; timestamp: number } | null =
  null;

export function useFinanceGrid({
  rows,
  entries,
  year,
  language,
  locked = false,
  applyPaste = financeService.pasteCells,
  applyCellAction = financeService.cellAction,
  statementLinks = [],
  ownerId,
  onEdit,
  onEditRow,
  onSaved,
}: {
  rows: FinanceRow[];
  entries: FinanceEntry[];
  year: number;
  language: string;
  locked?: boolean;
  applyPaste?: typeof financeService.pasteCells;
  applyCellAction?: typeof financeService.cellAction;
  statementLinks?: FinanceData["finance_statement_links"];
  ownerId?: string;
  onEdit: (row: FinanceRow, month: number) => void;
  onEditRow: (row: FinanceRow) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [selection, setSelection] = useState<GridSelection | null>(null);
  const [cutBuffer, setCutBuffer] = useState<CutBuffer | null>(null);
  useEffect(() => setCutBuffer(null), [ownerId]);
  useEffect(() => {
    if (!cutBuffer) return;
    const cancelCut = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setCutBuffer(null);
    };
    window.addEventListener("keydown", cancelCut, true);
    return () => window.removeEventListener("keydown", cancelCut, true);
  }, [cutBuffer]);
  const cutCells = new Set(cutBuffer?.cells.map((cell) => `${cell.row_id}:${cell.month}`));
  const [isSaving, setBusy] = useState(false);
  const [quickName, setQuickName] = useState<FinanceRow | null>(null);
  const [quickEdit, setQuickEdit] = useState<{
    row: FinanceRow;
    month: number;
    year: number;
    entries: FinanceEntry[];
  } | null>(null);
  const busy = isSaving || locked;
  const [context, setContext] = useState<GridContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const moved = useRef(false);
  const columnAnchor = useRef<{ section: Section; col: number; append?: boolean } | null>(null);
  const saving = useRef(false);
  const columnPointerHandled = useRef(false);
  const cellPointerHandled = useRef(false);
  const selectionEpoch = useRef(0);
  const clearSelection = useCallback(() => {
    setEnabled(false);
    setSelection(null);
    setContext(null);
    columnAnchor.current = null;
    drag.current = null;
    moved.current = false;
    selectionEpoch.current++;
  }, []);
  useEffect(() => {
    const outside = (event: globalThis.PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      // Toolbar controls and portaled menus/dialogs keep the current selection.
      if (
        event.target.closest(
          "button,a,input,textarea,select,label,[role='button'],[role='menu'],[role='dialog'],[contenteditable='true']",
        )
      )
        return;
      clearSelection();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [clearSelection]);
  const rowKey = rows.map((row) => row.id).join(",");
  useEffect(() => {
    setSelection(null);
    columnAnchor.current = null;
    drag.current = null;
    selectionEpoch.current++;
    setContext(null);
    setQuickEdit(null);
    setQuickName(null);
  }, [year, rowKey]);
  useEffect(() => {
    const release = () => {
      drag.current = null;
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, []);
  const point = (id: string, col: number) => ({ row: rows.findIndex((row) => row.id === id), col });
  const focusCell = (at: GridPoint) => {
    const cell = [
      ...(containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-finance-cell]") || []),
    ].find(
      (element) =>
        element.dataset.financeRow === rows[at.row]?.id &&
        Number(element.dataset.financeCol) === at.col,
    );
    cell?.focus();
  };
  const selectCell = (at: GridPoint, extend: boolean, additive = false) => {
    columnAnchor.current = null;
    setSelection((current) => additive ? toggleSelectionCells(current, [at]) : { anchor: extend && current ? current.anchor : at, focus: at });
  };
  const startQuickEdit = (row: FinanceRow, month: number) => {
    if (busy) return;
    selectCell(point(row.id, month - 1), false);
    setEnabled(true);
    setContext(null);
    setQuickName(null);
    setQuickEdit({
      row,
      month,
      year,
      entries: entries.filter(
        (entry) =>
          entry.row_id === row.id &&
          entry.date.startsWith(`${year}-${String(month).padStart(2, "0")}`),
      ),
    });
  };
  const startQuickName = (row: FinanceRow) => {
    if (busy) return;
    selectCell(point(row.id, -1), false);
    setEnabled(true);
    setContext(null);
    setQuickEdit(null);
    setQuickName(row);
  };
  const selectColumn = (section: Section, col: number, extend: boolean, additive = false) => {
    if (columnAnchor.current?.append) columnAnchor.current = null;
    const indexes = rows.flatMap((row, index) =>
      section === "summary" ||
      (section === "expense" ? row.kind === "expense" : row.kind !== "expense")
        ? [index]
        : [],
    );
    if (!indexes.length) {
      if (col !== -1 || section === "summary") return;
      columnAnchor.current = { section, col };
      setEnabled(true);
      const row = section === "expense" ? rows.length : 0;
      setSelection({ anchor: { row, col }, focus: { row, col } });
      return;
    }
    if (additive) {
      columnAnchor.current = { section, col };
      setEnabled(true);
      setSelection((current) => toggleSelectionCells(current, indexes.map((row) => ({ row, col }))));
      return;
    }
    const previous =
      extend && columnAnchor.current?.section === section ? columnAnchor.current.col : col;
    if (!extend || columnAnchor.current?.section !== section)
      columnAnchor.current = { section, col };
    setEnabled(true);
    setSelection({
      anchor: { row: indexes[0], col: previous },
      focus: { row: indexes[indexes.length - 1], col },
    });
  };
  const cellProps = (row: FinanceRow, col: number) => {
    const at = point(row.id, col);
    const selected = enabled && !!selection && selectionContains(selection, at);
    return {
      "data-finance-cell": "",
      "data-finance-row": row.id,
      "data-finance-col": col,
      "aria-pressed": enabled ? selected : undefined,
      onContextMenu: (event: MouseEvent<HTMLButtonElement>) => {
        if (col === -1) return;
        event.preventDefault();
        if (busy) return;
        if (!selected) selectCell(at, false);
        setEnabled(true);
        setContext({ x: event.clientX, y: event.clientY, row, month: col + 1 });
      },
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        cellPointerHandled.current = false;
        if (busy || event.button !== 0 || event.pointerType === "touch") return;
        moved.current = false;
        if (event.ctrlKey || event.metaKey) {
          cellPointerHandled.current = true;
          drag.current = null;
          setEnabled(true);
          selectCell(at, false, true);
          return;
        }
        drag.current = {
          type: "cell",
          anchor: event.shiftKey && selection ? selection.anchor : at,
        };
        if (enabled || event.shiftKey) {
          setEnabled(true);
          selectCell(at, event.shiftKey);
        }
      },
      onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => {
        if (busy || !(event.buttons & 1) || drag.current?.type !== "cell") return;
        if (drag.current.anchor.row === at.row && drag.current.anchor.col === at.col) return;
        moved.current = true;
        setEnabled(true);
        setSelection({ anchor: drag.current.anchor, focus: at });
      },
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        if (busy) return;
        if (cellPointerHandled.current && event.detail > 0) {
          cellPointerHandled.current = false;
          return;
        }
        if (moved.current) {
          moved.current = false;
          event.preventDefault();
          return;
        }
        if (event.detail === 0 && !enabled) {
          if (col === -1) onEditRow(row);
          else onEdit(row, col + 1);
        } else {
          setEnabled(true);
          selectCell(at, event.shiftKey, event.ctrlKey || event.metaKey);
        }
      },
      onDoubleClick: () => {
        if (col === -1) startQuickName(row);
        else startQuickEdit(row, col + 1);
      },
      className:
        (col === -1 ? "finance-sheet__name-cell" : "finance-sheet__cell") +
        (selected ? " is-selected" : "") +
        (col >= 0 && cutCells.has(`${row.id}:${year}-${String(col + 1).padStart(2, "0")}`) ? " is-cut" : ""),
    };
  };
  const rowProps = (row: FinanceRow) => ({
    onContextMenu: (event: MouseEvent<HTMLTableCellElement>) => {
      event.preventDefault();
      if (busy) return;
      if (
        !selection ||
        !selectionContains(selection, point(row.id, -1))
      )
        selectCell(point(row.id, -1), false);
      setEnabled(true);
      setContext({ x: event.clientX, y: event.clientY, row, scope: "row" });
    },
  });
  const appendRowProps = (section: "income" | "expense", col = -1) => {
    const selected =
      enabled &&
      !!selection &&
      columnAnchor.current?.append === true &&
      columnAnchor.current.section === section &&
      selectionContains(selection, { row: rows.length, col });
    const select = () => {
      if (busy) return;
      // A virtual row beyond all stored rows always creates new items, in either section.
      const at = { row: rows.length, col };
      columnAnchor.current = { section, col, append: true };
      drag.current = null;
      setContext(null);
      setEnabled(true);
      setSelection({ anchor: at, focus: at });
    };
    return {
      "data-finance-cell": "",
      "data-finance-col": col,
      "aria-pressed": selected,
      className:
        (col === -1 ? "finance-sheet__name-cell finance-sheet__append-cell" : "finance-sheet__cell") +
        (selected ? " is-selected" : ""),
      disabled: busy,
      onFocus: select,
      onClick: select,
    };
  };
  const columnProps = (section: Section, col: number) => ({
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (busy) return;
      if (
        !enabled ||
        !selection ||
        !rows.some((row, index) => (section === "summary" ||
          (section === "expense" ? row.kind === "expense" : row.kind !== "expense")) &&
          selectionContains(selection, { row: index, col }))
      )
        selectColumn(section, col, false);
      setContext({ x: event.clientX, y: event.clientY });
    },
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      columnPointerHandled.current = false;
      if (busy || event.button !== 0 || event.pointerType === "touch") return;
      columnPointerHandled.current = true;
      moved.current = false;
      drag.current = event.ctrlKey || event.metaKey ? null : { type: "column", section, col };
      selectColumn(section, col, event.shiftKey, event.ctrlKey || event.metaKey);
    },
    onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => {
      if (
        busy ||
        !(event.buttons & 1) ||
        drag.current?.type !== "column" ||
        drag.current.section !== section
      )
        return;
      moved.current = true;
      selectColumn(section, col, true);
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (busy) return;
      if ((moved.current || columnPointerHandled.current) && event.detail > 0) {
        moved.current = false;
        columnPointerHandled.current = false;
        return;
      }
      moved.current = false;
      columnPointerHandled.current = false;
      selectColumn(section, col, event.shiftKey, event.ctrlKey || event.metaKey);
    },
    disabled:
      busy ||
      (col !== -1 &&
        !rows.some(
          (row) =>
            section === "summary" ||
            (section === "expense" ? row.kind === "expense" : row.kind !== "expense"),
        )),
  });
  const hasSelectedRows = () =>
    selection &&
    rows[selectionBounds(selection).top] &&
    (columnAnchor.current?.section !== "income" || rows.some((row) => row.kind !== "expense")) &&
    (columnAnchor.current?.section !== "expense" || rows.some((row) => row.kind === "expense"));
  const clipboardText = () =>
    selection && hasSelectedRows()
      ? copyFinanceCells(rows, entries, year, selection, language)
      : "";
  const clipboardPayload = () =>
    selection && hasSelectedRows()
      ? copyFinanceMetadata(rows, entries, year, selection)
      : undefined;
  const rememberCopy = (value?: { text: string; metadata?: FinanceClipboard }) => {
    setCutBuffer(null);
    const metadata = value?.metadata ?? clipboardPayload(),
      text = value?.text ?? clipboardText();
    if (metadata) internalClipboard = { text, metadata, timestamp: Date.now() };
    return { text, metadata };
  };
  const metadataFor = (text: string, json = "", html = "") =>
    readFinanceMetadata(json, html) ||
    (!json &&
    !html &&
    internalClipboard?.text === text &&
    Date.now() - internalClipboard.timestamp < 900000
      ? internalClipboard.metadata
      : undefined);
  const showError = (error: unknown) => {
    const code =
      error instanceof Error && error.message.startsWith("finance_clipboard_")
        ? error.message
        : "finance_clipboard_failed";
    toast.error(t(code));
  };
  const pasteText = async (text: string, metadata?: FinanceClipboard) => {
    if (!selection || busy || saving.current) return;
    if (cutBuffer && text === cutBuffer.text && metadata?.cutId === cutBuffer.metadata.cutId) {
      await moveCut(cutBuffer,selection);
      return;
    }
    setCutBuffer(null);
    const epoch = selectionEpoch.current;
    try {
      const section = columnAnchor.current?.section;
      const plan = prepareFinancePaste(
        text,
        rows,
        entries,
        year,
        selection,
        metadata,
        section === "summary" ? undefined : section,
        columnAnchor.current?.append
          ? t(section === "expense" ? "finance_new_expense" : "finance_new_income")
          : undefined,
      );
      saving.current = true;
      setBusy(true);
      const result = plan.rows
        ? await applyPaste(year, plan.cells, plan.rows)
        : await applyPaste(year, plan.cells);
      await onSaved();
      if (epoch === selectionEpoch.current) setSelection(plan.selection);
      toast.success(t("finance_clipboard_pasted", { count: result.updated }));
    } catch (error) {
      showError(error);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const editable = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    !!target.closest("input,textarea,select,[contenteditable='true']");
  const writeTransfer = (transfer: DataTransfer, value?: { text: string; metadata?: FinanceClipboard }) => {
    const { text, metadata } = rememberCopy(value);
    transfer.setData("text/plain", text);
    if (metadata) {
      transfer.setData(FINANCE_CLIPBOARD_TYPE, JSON.stringify(metadata));
      transfer.setData("text/html", clipboardHtml(metadata));
    }
  };
  const copy = async (value?: { text: string; metadata?: FinanceClipboard }, silent = false) => {
    const { text, metadata } = rememberCopy(value);
    try {
      if (metadata && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write)
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([clipboardHtml(metadata)], { type: "text/html" }),
          }),
        ]);
      else await navigator.clipboard.writeText(text);
      if (!silent) toast.success(t("finance_clipboard_copied"));
      return true;
    } catch {
      /* Webviews may expose only the text clipboard or the copy event. */
    }
    try {
      await navigator.clipboard.writeText(text);
      if (!silent) toast.success(t("finance_clipboard_copied"));
      return true;
    } catch {
      /* Use the native copy event as a final fallback. */
    }
    const focused = document.activeElement,
      input = document.createElement("textarea");
    input.value = text;
    input.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.append(input);
    input.select();
    const nativeCopy = (event: globalThis.ClipboardEvent) => {
      if (event.clipboardData) {
        event.preventDefault();
        writeTransfer(event.clipboardData, { text, metadata });
      }
    };
    document.addEventListener("copy", nativeCopy, true);
    let copied = false;
    try {
      copied = !!document.execCommand?.("copy");
    } finally {
      document.removeEventListener("copy", nativeCopy, true);
      input.remove();
      if (focused instanceof HTMLElement) focused.focus();
    }
    if (copied) {
      if (!silent) toast.success(t("finance_clipboard_copied"));
    } else toast.error(t("finance_clipboard_copy_key"));
    return copied;
  };
  const snapshotCell = (rowId: string, col: number): FinanceCellSnapshot => {
    const month = `${year}-${String(col + 1).padStart(2, "0")}`;
    const link = statementLinks.find((link) => link.row_id === rowId && link.month === month);
    return {
      row_id: rowId,
      month,
      entries: entries.filter((entry) => entry.row_id === rowId && entry.date.startsWith(month + "-")).map((entry) => ({ ...entry })),
      statement_link: link ? { id: link.id, statement_id: link.statement_id } : null,
    };
  };
  const selectedCells = (selected: GridSelection) => {
    const points = selectionPoints(selected).filter((point) => rows[point.row] && point.col >= 0 && point.col < 12);
    if (points.length > 1200) throw new Error("finance_clipboard_too_large");
    return points.map((point) => snapshotCell(rows[point.row].id, point.col));
  };
  const makeCutBuffer = (): CutBuffer => {
    if (!selection || selectionColumns(selection).includes(-1)) throw new Error("finance_clipboard_payments_only");
    const cells = selectedCells(selection), payload = clipboardPayload();
    if (!payload || !cells.some((cell) => cell.entries.length || cell.statement_link)) throw new Error("finance_clipboard_empty");
    const selectedRows = selectionRows(selection), columns = selectionColumns(selection);
    return {
      cells, height: selectedRows.length, width: columns.length,
      ...(selection.cells ? { layout: selectionPoints(selection).map((point) => ({ row: selectedRows.indexOf(point.row), col: columns.indexOf(point.col) })) } : {}),
      text: clipboardText(), metadata: { ...payload, cutId: crypto.randomUUID() },
    };
  };
  const cut = async () => {
    if (busy || saving.current || quickEdit || quickName) return;
    try {
      const value = makeCutBuffer(), epoch = selectionEpoch.current;
      if (await copy(value, true) && epoch === selectionEpoch.current) {
        setCutBuffer(value);
        toast.success(t("finance_clipboard_cut"));
      }
    } catch (error) { showError(error); }
  };
  const cutTransfer = (transfer: DataTransfer) => {
    if (busy || quickEdit || quickName) return;
    try {
      const value = makeCutBuffer();
      writeTransfer(transfer, value);
      setCutBuffer(value);
      toast.success(t("finance_clipboard_cut"));
    } catch (error) { showError(error); }
  };
  const moveCut = async (value: CutBuffer, targetSelection: GridSelection) => {
    const epoch = selectionEpoch.current;
    try {
      const bounds = selectionBounds(targetSelection), selectedColumns = selectionColumns(targetSelection);
      if (bounds.left < 0) throw new Error("finance_clipboard_payments_only");
      if (value.layout || targetSelection.cells) {
        const picked = selectionPoints(targetSelection);
        let points: GridPoint[];
        if (targetSelection.cells && picked.length === value.cells.length) points = picked;
        else {
          if (targetSelection.cells && picked.length > 1) throw new Error("finance_clipboard_selection");
          const pickedRows = selectionRows(targetSelection);
          const targetRows = pickedRows.length === value.height ? pickedRows : Array.from({ length: value.height }, (_, index) => bounds.top + index);
          const targetColumns = selectedColumns.length === value.width ? selectedColumns : Array.from({ length: value.width }, (_, index) => bounds.left + index);
          const layout = value.layout || Array.from({ length: value.height }, (_, row) => Array.from({ length: value.width }, (_, col) => ({ row, col }))).flat();
          points = layout.map((point) => ({ row: targetRows[point.row], col: targetColumns[point.col] }));
        }
        if (points.some((point) => !rows[point.row] || point.col < 0 || point.col > 11)) throw new Error("finance_clipboard_bounds");
        const targets = points.map((point) => snapshotCell(rows[point.row].id, point.col));
        saving.current = true;
        setBusy(true);
        const result = await applyCellAction("move", value.cells, targets);
        setCutBuffer(null);
        await onSaved();
        if (epoch === selectionEpoch.current) setSelection({ anchor: points[0], focus: points[points.length - 1], cells: points });
        toast.success(t("finance_clipboard_moved", { count: result.updated }));
        return;
      }
      const columns = selectedColumns.length === value.width ? selectedColumns : Array.from({ length: value.width }, (_, index) => bounds.left + index);
      if (bounds.top + value.height > rows.length || Math.max(...columns) > 11) throw new Error("finance_clipboard_bounds");
      const targets = rows.slice(bounds.top, bounds.top + value.height).flatMap((row) => columns.map((col) => snapshotCell(row.id, col)));
      saving.current = true;
      setBusy(true);
      const result = await applyCellAction("move", value.cells, targets);
      setCutBuffer(null);
      await onSaved();
      if (epoch === selectionEpoch.current) setSelection({ anchor: { row: bounds.top, col: columns[0] }, focus: { row: bounds.top + value.height - 1, col: columns[columns.length - 1] }, columns });
      toast.success(t("finance_clipboard_moved", { count: result.updated }));
    } catch (error) { showError(error); }
    finally { saving.current = false; setBusy(false); }
  };
  const clearCells = async () => {
    if (!selection || busy || saving.current || quickEdit || quickName) return;
    try {
      const cells = selectedCells(selection);
      if (!cells.some((cell) => cell.entries.length || cell.statement_link)) return;
      saving.current = true;
      setBusy(true);
      const result = await applyCellAction("clear", cells);
      setCutBuffer(null);
      setContext(null);
      await onSaved();
      toast.success(t("finance_clipboard_cleared", { count: result.updated }));
    } catch (error) { showError(error); }
    finally { saving.current = false; setBusy(false); }
  };
  const readClipboard = async () => {
    if (navigator.clipboard?.read) {
      try {
        const items = await navigator.clipboard.read();
        let text = "",
          html = "";
        for (const item of items) {
          if (item.types.includes("text/plain"))
            text = await (await item.getType("text/plain")).text();
          if (item.types.includes("text/html"))
            html = await (await item.getType("text/html")).text();
        }
        if (text || html) return { text, metadata: metadataFor(text, "", html) };
      } catch {
        /* A text-only clipboard may still be available. */
      }
    }
    const text = await navigator.clipboard.readText();
    return { text, metadata: metadataFor(text) };
  };
  const paste = async () => {
    if (!selection || busy || saving.current) return;
    const epoch = selectionEpoch.current;
    try {
      const value = await readClipboard();
      if (epoch !== selectionEpoch.current) return;
      await pasteText(value.text, value.metadata);
    } catch {
      toast.error(t("finance_clipboard_paste_key"));
    }
  };
  const acceptNativePaste = (transfer: DataTransfer) => {
    const text = transfer.getData("text/plain");
    void pasteText(
      text,
      metadataFor(text, transfer.getData(FINANCE_CLIPBOARD_TYPE), transfer.getData("text/html")),
    );
  };
  useEffect(() => {
    if (!enabled || !selection) return;
    const allowed = (target: EventTarget | null): target is HTMLElement =>
      !!containerRef.current &&
      !editable(target) &&
      !window.getSelection()?.toString() &&
      !document.querySelector("[role='dialog'][data-state='open']") &&
      (target === document.body ||
        target === document.documentElement ||
        (target instanceof HTMLElement && !!target.closest(".finance-workbook")));
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.altKey || !allowed(event.target) || busy) return;
      const key = event.key.toLowerCase();
      if (key === "delete") {
        const button = event.target.closest("button");
        if (button && !button.hasAttribute("data-finance-cell") && !button.classList.contains("finance-sheet__month-button") && !button.classList.contains("finance-sheet__name-button")) return;
        event.preventDefault(); event.stopPropagation();
        void clearCells();
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (key === "x") {
        event.preventDefault(); event.stopPropagation();
        void cut();
        return;
      }
      if (key === "c") {
        event.preventDefault();
        event.stopPropagation();
        void copy();
      }
      // Ctrl+V uses the native paste event and its clipboardData directly.
      // An additional async clipboard read can open a browser permission menu.
    };
    const nativeCopy = (event: globalThis.ClipboardEvent) => {
      if (allowed(event.target) && event.clipboardData) {
        event.preventDefault();
        writeTransfer(event.clipboardData);
      }
    };
    const nativePaste = (event: globalThis.ClipboardEvent) => {
      if (allowed(event.target) && event.clipboardData) {
        event.preventDefault();
        acceptNativePaste(event.clipboardData);
      }
    };
    const nativeCut = (event: globalThis.ClipboardEvent) => {
      if (allowed(event.target) && event.clipboardData && !busy) {
        event.preventDefault(); event.stopPropagation();
        cutTransfer(event.clipboardData);
      }
    };
    window.addEventListener("keydown", keydown, true);
    document.addEventListener("copy", nativeCopy);
    document.addEventListener("paste", nativePaste);
    document.addEventListener("cut", nativeCut);
    return () => {
      window.removeEventListener("keydown", keydown, true);
      document.removeEventListener("copy", nativeCopy);
      document.removeEventListener("paste", nativePaste);
      document.removeEventListener("cut", nativeCut);
    };
  });
  const containerProps = {
    onCut: (event: ClipboardEvent<HTMLDivElement>) => {
      if (!enabled || !selection || editable(event.target)) return;
      event.preventDefault(); event.stopPropagation();
      cutTransfer(event.clipboardData);
    },
    onCopy: (event: ClipboardEvent<HTMLDivElement>) => {
      if (!enabled || !selection || editable(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      writeTransfer(event.clipboardData);
    },
    onPaste: (event: ClipboardEvent<HTMLDivElement>) => {
      if (!enabled || !selection || editable(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      acceptNativePaste(event.clipboardData);
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (!enabled || !selection || editable(event.target) || busy) return;
      const button = event.target instanceof HTMLElement ? event.target.closest("button") : null;
      if (
        button &&
        !button.hasAttribute("data-finance-cell") &&
        !button.classList.contains("finance-sheet__month-button") &&
        !button.classList.contains("finance-sheet__name-button")
      )
        return;
      if (
        (button?.classList.contains("finance-sheet__month-button") ||
          button?.classList.contains("finance-sheet__name-button")) &&
        ["Enter", " "].includes(event.key)
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        if (rows.length) {
          const section = columnAnchor.current?.section;
          const expense = section
            ? section === "expense"
            : rows[selection.focus.row]?.kind === "expense";
          const indexes = rows.flatMap((row, index) =>
            section === "summary" || (expense ? row.kind === "expense" : row.kind !== "expense")
              ? [index]
              : [],
          );
          if (indexes.length)
            setSelection({
              anchor: { row: indexes[0], col: section === "summary" ? 0 : -1 },
              focus: { row: indexes[indexes.length - 1], col: 11 },
            });
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearSelection();
        return;
      }
      if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        if (!rows[selection.focus.row]) return;
        if (selection.focus.col === -1) {
          if (event.key === "F2") startQuickName(rows[selection.focus.row]);
          else onEditRow(rows[selection.focus.row]);
        } else if (event.key === "F2")
          startQuickEdit(rows[selection.focus.row], selection.focus.col + 1);
        else onEdit(rows[selection.focus.row], selection.focus.col + 1);
        return;
      }
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
      };
      const step = delta[event.key];
      if (step) {
        event.preventDefault();
        const next = {
          row: Math.max(0, Math.min(rows.length - 1, selection.focus.row + step[0])),
          col: Math.max(-1, Math.min(11, selection.focus.col + step[1])),
        };
        selectCell(next, event.shiftKey);
        focusCell(next);
      }
    },
  };
  const count = selection ? selectionPoints(selection).length : 0;
  return {
    quickName,
    finishQuickName: (focus = false) => {
      setQuickName(null);
      if (focus && quickName) requestAnimationFrame(() => focusCell(point(quickName.id, -1)));
    },
    quickEdit,
    finishQuickEdit: (focus = false) => {
      setQuickEdit(null);
      if (focus && quickEdit)
        requestAnimationFrame(() => focusCell(point(quickEdit.row.id, quickEdit.month - 1)));
    },
    context,
    closeContext: () => setContext(null),
    selectedRows: selection && enabled && selectionColumns(selection).includes(-1)
      ? selectionRows(selection).filter((row) => selectionContains(selection, { row, col: -1 })).map((index) => rows[index]).filter(Boolean)
      : [],
    selectedEntries:
      selection && enabled
        ? entries.filter((entry) => {
            const at = point(entry.row_id, Number(entry.date.slice(5, 7)) - 1);
            return (
              entry.date.startsWith(`${year}-`) &&
              selectionContains(selection, at)
            );
          })
        : [],
    enabled,
    selection,
    count,
    busy,
    containerRef,
    containerProps,
    cellProps,
    appendRowProps,
    rowProps,
    columnProps,
    toggle: () => {
      setEnabled((value) => !value);
      if (!enabled && rows.length)
        setSelection({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } });
    },
    copy,
    cut,
    clearCells,
    paste,
    clearSelection,
  };
}
export type FinanceGrid = ReturnType<typeof useFinanceGrid>;
