import "./finance-sheet.css";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Lightbulb,
  Plus,
  Redo2,
  RefreshCw,
  Scissors,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";

import { FinanceCardStatement } from "@/components/FinanceCardStatement";
import { FinanceCellTag } from "@/components/FinanceCellTag";
import { FinanceEditor, type FinanceEditorState as Editor } from "@/components/FinanceEditor";
import { FinanceQuickAmount } from "@/components/FinanceQuickAmount";
import { FinanceQuickName } from "@/components/FinanceQuickName";
import { createFinanceQuickSavers } from "@/components/financeQuickSaves";
import { FinanceRowTag } from "@/components/FinanceRowTag";
import { FinanceSalaryComparison } from "@/components/FinanceSalaryComparison";
import { FinanceStatementLinkDialog } from "@/components/FinanceStatementLinkDialog";
import { FinanceVerificationDialog } from "@/components/FinanceVerificationDialog";
import { StatementLink } from "@/components/StatementLink";
import { MerchantProviderDialog } from "@/components/subscriptions/MerchantProviderDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { type FinanceGrid, useFinanceGrid } from "@/hooks/useFinanceGrid";
import { useFinanceHistory } from "@/hooks/useFinanceHistory";
import { useLocalToday } from "@/hooks/useLocalToday";
import { LS_KEYS } from "@/lib/constants";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { INCOME_ROW_TAGS, ROW_TAGS } from "@/lib/finance";
import {
  canTagPayment,
  type FinanceData,
  type FinanceEntry,
  financeMonths,
  type FinanceRow,
  financeRowsForYear,
  financeRowTag,
  financeStartYear,
  type FinanceStatementLink,
  isCardPaid,
  isFinanceCarryoverRow,
  sumEntries,
} from "@/lib/finance";
import { resolveLocale } from "@/lib/locale";
import { spendingKey } from "@/lib/spending";
import { cn, formatCurrency } from "@/lib/utils";
import { financeService } from "@/services/finance";

const EMPTY: FinanceData = {
  finance_rows: [],
  finance_entries: [],
  salary_history: [],
  finance_benchmarks: [],
};
type SummaryField = "received" | "paid" | "remaining";
const SUMMARY_LABEL_KEYS: Record<SummaryField, string> = {
  received: "sheet_income",
  paid: "expense",
  remaining: "sheet_cash",
};
type SummaryColumn = number | "total" | "average";
type SummaryTrace = { field: SummaryField; column: SummaryColumn };

function contributesToSummary(row: FinanceRow, entry: FinanceEntry, field: SummaryField) {
  if (entry.status !== "settled") return false;
  return row.kind === "expense"
    ? field !== "received" && !isCardPaid(entry, row)
    : field !== "paid";
}

function savedFinanceYear(userId: string, today: string) {
  try {
    const value = userId ? Number(localStorage.getItem(LS_KEYS.financeYear(userId))) : NaN;
    if (Number.isInteger(value) && value >= 1970 && value <= 2200) return value;
  } catch {
    /* The current year remains available when browser storage is disabled. */
  }
  return Number(today.slice(0, 4));
}

function savedDecimalPlaces() {
  try {
    const stored = localStorage.getItem(LS_KEYS.FINANCE_DECIMALS);
    const value = stored === null ? NaN : Number(stored);
    if (Number.isInteger(value) && value >= 0 && value <= 6) return value;
  } catch {
    /* Display preferences also work without browser storage. */
  }
  return 2;
}

export function FinancePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const today = useLocalToday();
  const yearOwner = user?.id || "";
  const [yearSelection, setYearSelection] = useState(() => ({
    owner: yearOwner,
    value: savedFinanceYear(yearOwner, today),
  }));
  const year =
    yearSelection.owner === yearOwner ? yearSelection.value : savedFinanceYear(yearOwner, today);
  const setYear = (value: number) => {
    if (!Number.isInteger(value) || value < 1970 || value > 2200) return;
    setYearSelection({ owner: yearOwner, value });
    try {
      if (yearOwner) localStorage.setItem(LS_KEYS.financeYear(yearOwner), String(value));
    } catch {
      /* Keep the selected year in memory when browser storage is disabled. */
    }
  };
  const [sheet, setSheet] = useState("ledger");
  const [summaryTrace, setSummaryTrace] = useState<SummaryTrace | null>(null);
  useEffect(() => setSummaryTrace(null), [year, sheet]);
  useEffect(() => {
    if (!summaryTrace) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-finance-summary-trigger]"))
        return;
      setSummaryTrace(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSummaryTrace(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [summaryTrace]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deletingRows, setDeletingRows] = useState<{ year: number; rows: FinanceRow[] } | null>(
    null,
  );
  const [providerFor, setProviderFor] = useState<{
    name: string;
    month?: string;
    year?: number;
    rowId: string;
  } | null>(null);
  const [decimalPlaces, setDecimalPlaces] = useState(savedDecimalPlaces);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.FINANCE_DECIMALS, String(decimalPlaces));
    } catch {
      /* Keep the display setting for this session. */
    }
  }, [decimalPlaces]);
  const [noteEntries, setNoteEntries] = useState<FinanceEntry[] | null>(null);
  const [noteText, setNoteText] = useState("");
  const [statement, setStatement] = useState<{ rowId: string; month: number } | null>(null);
  const [linking, setLinking] = useState<{ row: FinanceRow; month: number } | null>(null);
  const [verifying, setVerifying] = useState<{ row: FinanceRow; month: number } | null>(null);
  const [cardLinkDraft, setCardLinkDraft] = useState<{ rowId: string; month: number } | null>(null);
  const queryClient = useQueryClient();
  const key = ["finance", user?.id];
  const query = useQuery({ queryKey: key, queryFn: financeService.get, enabled: !!user?.id });
  const refreshLock = useRef(false);
  const rawData = query.data ?? EMPTY;
  const data = {
    ...rawData,
    finance_rows: financeRowsForYear(rawData.finance_rows, year, rawData),
  };
  const carryoverRow = data.finance_rows.find(isFinanceCarryoverRow);
  const firstFinanceYear = financeStartYear(rawData) ?? Number(today.slice(0, 4));
  const openingDeficitEntries = rawData.finance_entries.filter(
    (entry) =>
      entry.date.startsWith(`${year}-01`) &&
      rawData.finance_rows.some((row) => row.id === entry.row_id && isFinanceCarryoverRow(row)),
  );
  const linkedStatement = (rowId: string, month: number) =>
    data.finance_statement_links?.find(
      (link) => link.row_id === rowId && link.month === `${year}-${String(month).padStart(2, "0")}`,
    );
  const months = financeMonths(rawData, year);
  const language = resolveLocale(i18n);
  const money = (value: number) =>
    formatCurrency(value, "TRY", {
      locale: language,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  const monthName = (index: number, short = false) =>
    new Intl.DateTimeFormat(language, { month: short ? "short" : "long" }).format(
      new Date(year, index, 1),
    );
  const label = (name: string) => t(`finance_${name}`);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: spendingKey(yearOwner) }),
      queryClient.invalidateQueries({ queryKey: ["budget"] }),
    ]);
  };
  const history = useFinanceHistory(user?.id ? `${user.id}:${year}` : undefined, refresh);
  const visibleRows = [
    ...data.finance_rows.filter((row) => row.kind !== "expense"),
    ...data.finance_rows.filter((row) => row.kind === "expense"),
  ];
  const grid = useFinanceGrid({
    rows: visibleRows.filter((row) => row.id !== carryoverRow?.id),
    entries: data.finance_entries,
    year,
    language,
    locked: history.busy,
    ownerId: user?.id,
    statementLinks: data.finance_statement_links,
    applyCellAction: (action, cells, targets) =>
      history.execute(() => financeService.cellAction(action, cells, targets)),
    applyPaste: (pasteYear, cells, pastedRows) =>
      history.execute(() =>
        pastedRows
          ? financeService.pasteCells(pasteYear, cells, pastedRows)
          : financeService.pasteCells(pasteYear, cells),
      ),
    onSaved: refresh,
    onEdit: (row, month) => setEditor({ type: "cell", row, month }),
    onEditRow: (row) => setEditor({ type: "row", row }),
  });
  const context = grid.context;
  const contextCell =
    context?.row && context.month ? { row: context.row, month: context.month } : null;
  const providerContext =
    context?.row?.kind === "expense" && context.row.bill_type
      ? {
          name: context.row.name,
          rowId: context.row.origin_row || context.row.id,
          ...(context.scope === "row"
            ? { year }
            : { month: year + "-" + String(context.month).padStart(2, "0") }),
        }
      : null;
  const contextRows = visibleRows.filter(
    (row) => (row.kind === "expense") === (context?.row?.kind === "expense"),
  );
  const contextRowIndex = contextRows.findIndex((row) => row.id === context?.row?.id);
  const contextSelectedRows = grid.selectedRows.length
    ? grid.selectedRows
    : context?.row
      ? [context.row]
      : [];
  const contextTagRows = contextSelectedRows.filter(
    (row) => (row.kind === "expense") === (context?.row?.kind === "expense"),
  );
  const firstContextRow = contextSelectedRows[0];
  const requestRowDeletion = firstContextRow
    ? () => {
        if (contextSelectedRows.length > 1)
          setDeletingRows({ year, rows: [...contextSelectedRows] });
        else setEditor({ type: "row", row: firstContextRow, confirmDelete: true });
      }
    : undefined;
  const refreshTable = async () => {
    if (refreshLock.current || query.isFetching || grid.busy || grid.quickEdit || grid.quickName)
      return;
    refreshLock.current = true;
    try {
      await query.refetch({ cancelRefetch: false, throwOnError: true });
    } catch {
      toast.error(label("refresh_error"));
    } finally {
      refreshLock.current = false;
    }
  };
  const taggableEntries = grid.selectedEntries.filter((entry) => {
    const row = data.finance_rows.find((row) => row.id === entry.row_id);
    return row && canTagPayment(row);
  });
  const canTagSelection =
    taggableEntries.length > 0 && taggableEntries.length === grid.selectedEntries.length;
  const mutate = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => history.execute(action),
    onSuccess: (result) => {
      const deletedRows = (result as { deleted_rows?: number } | null)?.deleted_rows;
      if (typeof deletedRows === "number") {
        toast.success(t("finance_rows_deleted", { count: deletedRows }));
        return;
      }
      const taggedRows = (result as { tagged_rows?: number } | null)?.tagged_rows;
      toast.success(
        typeof taggedRows === "number"
          ? taggedRows
            ? t("finance_rows_tagged", { count: taggedRows })
            : label("row_tags_unchanged")
          : label("success"),
      );
    },
    onError: (error) =>
      toast.error(
        label(
          error instanceof Error &&
            [
              "finance_import_too_large",
              "finance_card_type_in_use",
              "finance_statement_row_in_use",
              "finance_invalid_payment_tag",
              "finance_payment_tag_in_use",
              "finance_history_conflict",
              "finance_opening_deficit_locked",
            ].includes(error.message)
            ? error.message.replace("finance_", "")
            : "error",
        ),
      ),
  });
  const run = async (action: () => Promise<unknown>, close = true) => {
    try {
      await mutate.mutateAsync(action);
      if (close) setEditor(null);
      return true;
    } catch {
      /* Keep the form open for correction. */
      return false;
    }
  };
  const updateEntries = async (
    entries: FinanceEntry[],
    patch: Partial<Pick<FinanceEntry, "notes" | "status" | "settled_date" | "payment_tag">>,
  ) => {
    try {
      await history.update(entries, patch);
      setNoteEntries(null);
      toast.success(label("success"));
    } catch (error) {
      toast.error(
        label(
          error instanceof Error && error.message === "finance_history_conflict"
            ? "history_conflict"
            : "error",
        ),
      );
    }
  };
  const { saveQuickAmounts, saveQuickName } = createFinanceQuickSavers(grid, { year, today, run });
  const yearRates = useMutation({
    mutationFn: async (requestedYears: number[] = [year]) => {
      const result = { updated: 0, failed: 0, partial: 0, unchanged: true };
      let completed = 0;
      let lastError: unknown;
      const currentYear = Number(today.slice(0, 4));
      for (const requestedYear of [...new Set(requestedYears)]
        .filter((value) => value >= 1970 && value <= currentYear)
        .sort((a, b) => a - b)) {
        try {
          const saved = await financeService.ratesYear(requestedYear);
          result.updated += saved.updated;
          result.failed += saved.failed;
          result.partial += saved.partial;
          result.unchanged = result.unchanged && saved.unchanged;
          completed++;
        } catch (error) {
          lastError = error;
          result.failed += requestedYear === currentYear ? Number(today.slice(5, 7)) : 12;
          result.unchanged = false;
        }
      }
      if (!completed && lastError) throw lastError;
      return result;
    },
    onSuccess: async (result) => {
      await refresh();
      if (result.failed) toast.error(t("finance_year_rates_partial", result));
      else if (result.partial) toast.warning(t("finance_year_rates_partial", result));
      else
        toast.success(
          result.unchanged ? label("rates_unchanged") : t("finance_year_rates_done", result),
        );
    },
    onError: () => toast.error(label("rates_error")),
  });
  const annualIncome = months.reduce((sum, month) => sum + Math.round(month.received * 100), 0);
  const annualExpense =
    months.reduce((sum, month) => sum + Math.round(month.paid * 100), 0) +
    months.reduce((sum, month) => sum + Math.round(month.openingCarryover * 100), 0);
  const total = (field: SummaryField) =>
    (field === "received"
      ? annualIncome
      : field === "paid"
        ? annualExpense
        : annualIncome - annualExpense) / 100;
  const cellEntries = (row: FinanceRow, month: number) =>
    data.finance_entries.filter(
      (entry) =>
        entry.row_id === row.id &&
        entry.date.startsWith(`${year}-${String(month).padStart(2, "0")}`),
    );
  const summaryRows = ["received", "paid", "remaining"] as const;
  const sheetMoney = (value: number) =>
    formatCurrency(value, "TRY", {
      locale: language,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  const summaryLabel = (field: SummaryField) => label(SUMMARY_LABEL_KEYS[field]);

  const renderSummaryCell = (
    field: SummaryField,
    column: SummaryColumn,
    value: number,
    title: string,
  ) => {
    const active = summaryTrace?.field === field && summaryTrace.column === column;
    const source =
      summaryTrace &&
      typeof column === "number" &&
      (typeof summaryTrace.column !== "number"
        ? field === "received" && summaryTrace.field !== "paid"
        : summaryTrace.field === "remaining" &&
          column === summaryTrace.column &&
          field !== "remaining");
    return (
      <td
        key={column}
        className={cn(
          "finance-sheet__summary-cell",
          typeof column !== "number" && "finance-sheet__annual",
          active && "finance-sheet__summary-cell--active",
        )}
        data-summary-contributor={source || undefined}
        title={
          typeof column !== "number" && field !== "received"
            ? label(field === "remaining" ? "cash_annual_help" : "carryover_annual_help")
            : undefined
        }
      >
        <button
          type="button"
          className="finance-sheet__summary-button"
          data-finance-summary-trigger=""
          aria-label={summaryLabel(field) + " · " + title + " · " + label("highlight_sources")}
          aria-pressed={active}
          onClick={() => {
            grid.clearSelection();
            setSummaryTrace(active ? null : { field, column });
          }}
        >
          {sheetMoney(value)}
        </button>
      </td>
    );
  };

  if (query.isPending)
    return (
      <div role="status" className="py-20 text-center text-muted-foreground">
        {label("loading")}
      </div>
    );
  if (query.isError && !query.data)
    return (
      <div role="alert" className="space-y-4 py-16 text-center">
        <p>{label("load_error")}</p>
        <Button onClick={() => void query.refetch()}>{label("retry")}</Button>
      </div>
    );

  const workbookTools = (
    <div className="finance-workbook__toolbar">
      <div className="finance-workbook__actions">
        <div className="finance-workbook__year">
          <button
            disabled={year <= 1970 || grid.busy}
            aria-label={t("previous_year", { defaultValue: "Previous year" })}
            onClick={() => setYear(year - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <Input
            aria-label={t("year")}
            type="number"
            min={1970}
            max={2200}
            value={year}
            disabled={grid.busy}
            onChange={(event) => setYear(Number(event.target.value))}
          />
          <button
            disabled={year >= 2200 || grid.busy}
            aria-label={t("next_year", { defaultValue: "Next year" })}
            onClick={() => setYear(year + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div
          className="finance-workbook__decimals"
          role="group"
          aria-label={label("decimal_places")}
        >
          <Button
            size="icon"
            variant="ghost"
            aria-label={label("increase_decimals")}
            title={label("increase_decimals")}
            disabled={decimalPlaces >= 6}
            onClick={() => setDecimalPlaces((value) => Math.min(6, value + 1))}
          >
            <DecimalPlacesIcon increase />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={label("decrease_decimals")}
            title={label("decrease_decimals")}
            disabled={decimalPlaces <= 0}
            onClick={() => setDecimalPlaces((value) => Math.max(0, value - 1))}
          >
            <DecimalPlacesIcon />
          </Button>
        </div>
        {grid.enabled && (
          <>
            <Button
              size="icon"
              variant="ghost"
              aria-label={label("copy_cells")}
              title={label("copy_cells")}
              disabled={!grid.selection || grid.busy}
              onClick={() => void grid.copy()}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={label("paste_cells")}
              title={label("paste_cells")}
              disabled={!grid.selection || grid.busy}
              onClick={() => void grid.paste()}
            >
              <ClipboardPaste className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={label("cut_cells")}
              title={label("cut_cells")}
              disabled={!grid.selection || grid.busy}
              onClick={() => void grid.cut()}
            >
              <Scissors className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button
          size="icon"
          variant="outline"
          aria-label={label("undo")}
          title={label("undo")}
          disabled={!history.canUndo || grid.busy}
          onClick={() => void history.undo()}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label={label("redo")}
          title={label("redo")}
          disabled={!history.canRedo || grid.busy}
          onClick={() => void history.redo()}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => void refreshTable()}
          disabled={query.isFetching || grid.busy || !!grid.quickEdit || !!grid.quickName}
          aria-busy={query.isFetching}
          aria-label={label("refresh")}
          title={label(query.isFetching ? "refreshing" : "refresh")}
        >
          <RefreshCw
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5",
              query.isFetching && "animate-spin motion-reduce:animate-none",
            )}
          />
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className="finance-workbook"
      lang={language}
      style={
        {
          "--finance-extra-width": `${Math.max(0, decimalPlaces - 2) * 8}px`,
        } as React.CSSProperties
      }
    >
      <Tabs value={sheet} onValueChange={setSheet} className="finance-workbook__sheets">
        <TabsContent value="ledger" className="finance-workbook__ledger">
          <div
            ref={grid.containerRef}
            {...grid.containerProps}
            className="finance-sheet__scroll"
            role="region"
            aria-label={label("ledger")}
            tabIndex={0}
          >
            <table className="finance-sheet">
              <caption className="sr-only">
                {year} {label("ledger")}
              </caption>
              <colgroup>
                <col className="finance-sheet__name-column" />
                {months.map((month) => (
                  <col key={month.month} className="finance-sheet__month-column" />
                ))}
                <col className="finance-sheet__total-column" />
                <col className="finance-sheet__average-column" />
              </colgroup>
              <thead>
                <SheetHeader
                  title={label("sheet_summary")}
                  section="summary"
                  grid={grid}
                  label={label}
                  monthName={monthName}
                />
              </thead>
              <tbody>
                {summaryRows.map((field) => (
                  <tr
                    key={field}
                    className={cn(
                      "finance-sheet__summary-row",
                      "finance-sheet__summary-row--" + field,
                    )}
                  >
                    <th scope="row">{summaryLabel(field)}</th>
                    {months.map((month, index) =>
                      renderSummaryCell(
                        field,
                        index + 1,
                        month[field] + (field === "paid" ? month.carryover : 0),
                        monthName(index),
                      ),
                    )}
                    {renderSummaryCell(field, "total", total(field), label("total"))}
                    {renderSummaryCell(field, "average", total(field) / 12, label("average"))}
                  </tr>
                ))}
                <FinanceSection
                  section="income"
                  year={year}
                  summaryTrace={summaryTrace}
                  language={language}
                  saveQuickAmounts={saveQuickAmounts}
                  saveQuickName={saveQuickName}
                  grid={grid}
                  run={run}
                  pending={mutate.isPending || grid.busy}
                  rows={data.finance_rows.filter((row) => row.kind !== "expense")}
                  cellEntries={cellEntries}
                  verifications={data.entry_verifications}
                  linkedStatement={linkedStatement}
                  allRows={data.finance_rows}
                  money={sheetMoney}
                  label={label}
                  monthName={monthName}
                />
                <FinanceSection
                  section="expense"
                  year={year}
                  carryoverMonths={months}
                  carryoverRowId={carryoverRow?.id}
                  editableOpening={year === firstFinanceYear}
                  openingEntries={openingDeficitEntries}
                  paymentChecks={data.card_payment_checks}
                  summaryTrace={summaryTrace}
                  language={language}
                  saveQuickAmounts={saveQuickAmounts}
                  saveQuickName={saveQuickName}
                  grid={grid}
                  run={run}
                  pending={mutate.isPending || grid.busy}
                  rows={data.finance_rows.filter((row) => row.kind === "expense")}
                  cellEntries={cellEntries}
                  verifications={data.entry_verifications}
                  linkedStatement={linkedStatement}
                  allRows={data.finance_rows}
                  money={sheetMoney}
                  label={label}
                  monthName={monthName}
                />
              </tbody>
            </table>
            {data.finance_rows.length === 0 && (
              <div className="finance-sheet__empty">
                <p>{label("empty")}</p>
              </div>
            )}
          </div>
          {grid.enabled && (
            <div className="finance-workbook__selection-help">
              <div className="finance-workbook__selection-shortcuts">
                <span className="finance-workbook__selection-count" role="status">
                  {t("finance_selected_cells", { count: grid.count })}
                </span>
                {[
                  ["Ctrl+C / Ctrl+X / Ctrl+V", label("shortcut_clipboard")],
                  [label("shortcut_amount_keys"), label("shortcut_amount")],
                  ["Enter", label("shortcut_details")],
                ].map(([keys, description]) => (
                  <span key={keys} className="inline-flex items-center gap-1.5">
                    <kbd>{keys}</kbd>
                    <span>{description}</span>
                  </span>
                ))}
              </div>
              <div className="mt-3 border-t pt-3">
                <p className="leading-relaxed">
                  <span className="font-medium text-foreground">{label("copy_inside_title")}</span>{" "}
                  {label("copy_inside_help")}
                </p>
              </div>
            </div>
          )}
          <div className="mt-3 overflow-hidden rounded-xl border bg-card/20">
            <div className="flex flex-wrap items-center justify-between gap-4 px-3 py-2.5">
              <div className="finance-workbook__legend">
                <div className="finance-sheet__received">{label("income_received")}</div>
                <div className="finance-sheet__expected">{label("income_expected")}</div>
                <div className="finance-sheet__settled">{label("expense_paid")}</div>
                <div className="finance-sheet__pending">{label("expense_pending")}</div>
              </div>
            </div>
            <details open className="group border-t text-xs text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <Lightbulb
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <span>{label("tag_guide")}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-90"
                />
              </summary>
              <p className="px-3 pb-3 leading-relaxed">{label("card_totals_help")}</p>
              <div className="grid gap-3 px-3 pb-3 md:grid-cols-2">
                {[
                  { title: "bill_type", items: ["salary", "bills", "loans", "card_repayment"] },
                  { title: "payment_tag", items: ["calendar", "card_paid"] },
                ].map((group) => (
                  <section key={group.title} className="rounded-lg bg-muted/20 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-foreground">
                      {label(group.title)}
                    </h3>
                    <ul className="space-y-1.5 leading-relaxed">
                      {group.items.map((item) => (
                        <li key={item} className="flex flex-wrap items-center gap-2">
                          <span>
                            <Trans
                              i18nKey={"finance_flow_" + item}
                              components={{
                                strong: <strong className="font-semibold text-foreground" />,
                              }}
                            />
                          </span>
                          {item === "card_paid" && (
                            <FinanceCellTag
                              type="card"
                              inline
                              label={label("tag_credit_card")}
                              description={label("tag_credit_card_help")}
                            />
                          )}
                          {item === "salary" && (
                            <FinanceRowTag type="salary" label={label("salary")} />
                          )}
                          {item === "loans" && <FinanceRowTag type="loan" label={label("loan")} />}
                          {item === "card_repayment" && (
                            <span className="inline-flex">
                              <FinanceRowTag type="credit_card" label={label("credit_card")} />
                            </span>
                          )}
                          {item === "bills" && (
                            <span className="inline-flex items-center gap-1">
                              {ROW_TAGS.filter(
                                (tag) =>
                                  tag !== "" &&
                                  tag !== "loan" &&
                                  tag !== "credit_card" &&
                                  tag !== "rent",
                              ).map((tag) => (
                                <FinanceRowTag key={tag} type={tag} label={label(`bill_${tag}`)} />
                              ))}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </details>
          </div>
        </TabsContent>
        <TabsContent value="analysis" className="space-y-4">
          <FinanceSalaryComparison
            data={rawData}
            ownerId={yearOwner}
            year={year}
            today={today}
            decimalPlaces={decimalPlaces}
            loadingReferences={yearRates.isPending}
            referenceError={
              yearRates.isError || !!(yearRates.data?.failed && !yearRates.data.updated)
            }
            onYearChange={setYear}
            onOpenLedger={() => setSheet("ledger")}
            onFetchReferences={(years) => yearRates.mutate(years)}
            onEditReference={(month, referenceYear, field) =>
              setEditor({ type: "reference", month, year: referenceYear, field })
            }
          />
        </TabsContent>
        <div className="finance-workbook__footer">
          <TabsList className="finance-workbook__tabs">
            <TabsTrigger value="ledger">{label("ledger")}</TabsTrigger>
            <TabsTrigger value="analysis">{label("analysis")}</TabsTrigger>
          </TabsList>
          {workbookTools}
          {sheet === "ledger" &&
            grid.enabled &&
            grid.count > 1 &&
            grid.selectedEntries.length > 0 && (
              <div
                className="finance-workbook__selection-total"
                role="status"
                aria-label={label("selection_sum")}
                title={label("selection_sum_help")}
              >
                <span>{label("selection_sum")}</span>
                <strong>{money(sumEntries(grid.selectedEntries))}</strong>
              </div>
            )}
        </div>
      </Tabs>
      {context && (
        <DropdownMenu open onOpenChange={dialogDismissHandler(() => grid.closeContext())}>
          <DropdownMenuTrigger asChild>
            <button
              aria-hidden
              tabIndex={-1}
              style={{
                position: "fixed",
                left: context.x,
                top: context.y,
                width: 1,
                height: 1,
                pointerEvents: "none",
              }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={0}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            {providerContext && (
              <>
                <DropdownMenuItem onSelect={() => setProviderFor(providerContext)}>
                  <Building2 className="mr-2 h-4 w-4" />
                  {t("spending_provider_title")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {context.scope === "row" && context.row ? (
              <>
                <DropdownMenuItem onSelect={() => setEditor({ type: "row", row: context!.row })}>
                  {label("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setEditor({ type: "row", row: context!.row, focusNotes: true })}
                >
                  {label("edit_notes")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(["above", "below"] as const).map((side) => (
                  <DropdownMenuItem
                    key={side}
                    disabled={grid.busy}
                    onSelect={() => {
                      const row = context!.row!;
                      const position = {
                        rowId: row.id,
                        side,
                        expectedOrder: contextRows.map((item) => item.id),
                        kind: row.kind,
                      };
                      grid.clearSelection();
                      setEditor({ type: "row", position });
                    }}
                  >
                    {label(`insert_${side}`)}
                  </DropdownMenuItem>
                ))}
                {(["up", "down"] as const).map((direction) => (
                  <DropdownMenuItem
                    key={direction}
                    disabled={
                      grid.busy ||
                      (direction === "up"
                        ? contextRowIndex <= 0
                        : contextRowIndex >= contextRows.length - 1)
                    }
                    onSelect={() => {
                      const row = context!.row!;
                      void run(async () => {
                        const result = await financeService.rowAction(
                          row.id,
                          `move_${direction}`,
                          contextRows.map((item) => item.id),
                          undefined,
                          year,
                        );
                        grid.clearSelection();
                        return result;
                      }, false);
                    }}
                  >
                    {label(`move_${direction}`)}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setEditor({ type: "plan", row: context!.row! })}>
                  {label("plan")}
                </DropdownMenuItem>
                {context.row && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>{label("bill_type")}</DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {(context.row.kind === "expense" ? ROW_TAGS : INCOME_ROW_TAGS).map(
                          (tag) => (
                            <DropdownMenuItem
                              key={tag}
                              disabled={grid.busy}
                              onSelect={() => {
                                void run(
                                  () =>
                                    financeService.tagRows(
                                      year,
                                      contextTagRows.map((row) => ({
                                        id: row.id,
                                        tag: financeRowTag(row),
                                      })),
                                      tag,
                                    ),
                                  false,
                                );
                              }}
                            >
                              {label(
                                tag === "salary" ||
                                  tag === "loan" ||
                                  tag === "credit_card" ||
                                  tag === "rent"
                                  ? tag
                                  : tag
                                    ? `bill_${tag}`
                                    : "bill_none",
                              )}
                              {contextTagRows.length > 0 &&
                                contextTagRows.every((row) => financeRowTag(row) === tag) && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                            </DropdownMenuItem>
                          ),
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={grid.busy}
                  onSelect={requestRowDeletion}
                >
                  {contextSelectedRows.length > 1
                    ? t("finance_delete_rows", { count: contextSelectedRows.length })
                    : label("delete_row")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void grid.copy()} disabled={grid.busy}>
                  {label("copy_cells")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void grid.paste()} disabled={grid.busy}>
                  {label("paste_cells")}
                </DropdownMenuItem>
              </>
            ) : (
              <>
                {contextCell && (
                  <DropdownMenuItem
                    onSelect={() => {
                      const { row, month } = contextCell;
                      const entries = cellEntries(row, month);
                      setEditor({
                        type: "cell",
                        row,
                        month,
                        entryId: entries.length === 1 ? entries[0].id : undefined,
                      });
                    }}
                  >
                    {label("edit")}
                  </DropdownMenuItem>
                )}
                {contextCell?.row.kind === "expense" &&
                  contextCell.row.expense_type !== "credit_card" && (
                    <DropdownMenuItem
                      disabled={
                        !cellEntries(contextCell.row, contextCell.month).length || grid.busy
                      }
                      onSelect={() => {
                        setVerifying(contextCell);
                      }}
                    >
                      {label("verify_cell")}
                    </DropdownMenuItem>
                  )}
                {contextCell?.row.kind === "expense" &&
                  contextCell.row.expense_type === "credit_card" && (
                    <>
                      {linkedStatement(contextCell.row.id, contextCell.month) ? (
                        <DropdownMenuItem asChild>
                          <StatementLink
                            statementId={
                              linkedStatement(contextCell.row.id, contextCell.month)!.statement_id
                            }
                          >
                            {label("go_statement")}
                          </StatementLink>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() => {
                            setStatement({ rowId: contextCell.row.id, month: contextCell.month });
                          }}
                        >
                          {label("go_statement")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={() => {
                          setLinking(contextCell);
                        }}
                      >
                        {label("verify_cell")}
                      </DropdownMenuItem>
                    </>
                  )}
                {canTagSelection && (!context.row || canTagPayment(context.row)) && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger disabled={grid.busy}>
                      {label("payment_tag")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {(["credit_card", "direct", ""] as const).map((tag) => (
                          <DropdownMenuItem
                            key={tag}
                            disabled={grid.busy}
                            onSelect={() =>
                              void updateEntries(taggableEntries, { payment_tag: tag })
                            }
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3 w-3",
                                !taggableEntries.every(
                                  (entry) => (entry.payment_tag || "") === tag,
                                ) && "invisible",
                              )}
                            />
                            {label(
                              tag === "credit_card"
                                ? "tag_credit_card"
                                : tag === "direct"
                                  ? "tag_direct"
                                  : "tag_inherit",
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                )}
                <DropdownMenuItem
                  disabled={!grid.selectedEntries.length || grid.busy}
                  onSelect={() => {
                    const entries = grid.selectedEntries;
                    setNoteText(
                      entries.every((entry) => entry.notes === entries[0].notes)
                        ? entries[0].notes
                        : "",
                    );
                    setNoteEntries(entries);
                  }}
                >
                  {label("edit_notes")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="border border-emerald-500/50 bg-transparent data-[highlighted]:border-emerald-500 data-[highlighted]:bg-transparent data-[highlighted]:text-foreground"
                  disabled={
                    !grid.selectedEntries.some((entry) => entry.status === "planned") || grid.busy
                  }
                  onSelect={() =>
                    void updateEntries(
                      grid.selectedEntries.filter((entry) => entry.status === "planned"),
                      { status: "settled", settled_date: today },
                    )
                  }
                >
                  {label(
                    grid.selectedEntries.every(
                      (entry) =>
                        data.finance_rows.find((row) => row.id === entry.row_id)?.kind !==
                        "expense",
                    )
                      ? "mark_received"
                      : "mark_paid",
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={
                    !grid.selectedEntries.some((entry) => entry.status === "settled") || grid.busy
                  }
                  onSelect={() =>
                    void updateEntries(
                      grid.selectedEntries.filter((entry) => entry.status === "settled"),
                      { status: "planned", settled_date: "" },
                    )
                  }
                >
                  {label("mark_pending")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void grid.copy()} disabled={grid.busy}>
                  {label("copy_cells")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void grid.paste()} disabled={grid.busy}>
                  {label("paste_cells")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void history.undo()}
                  disabled={!history.canUndo || grid.busy}
                >
                  {label("undo")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void history.redo()}
                  disabled={!history.canRedo || grid.busy}
                >
                  {label("redo")}
                </DropdownMenuItem>
                {context.row && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      disabled={grid.busy}
                      onSelect={requestRowDeletion}
                    >
                      {contextSelectedRows.length > 1
                        ? t("finance_delete_rows", { count: contextSelectedRows.length })
                        : label("delete_row")}
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {deletingRows && (
        <Dialog open onOpenChange={dialogDismissHandler(() => setDeletingRows(null), history.busy)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {t("finance_delete_rows", { count: deletingRows.rows.length })}
              </DialogTitle>
              <DialogDescription>
                {t("finance_delete_rows_help", { year: deletingRows.year })}
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border bg-muted/10 p-3 text-sm">
              {deletingRows.rows.map((row) => (
                <li key={row.id} className="break-words">
                  {row.name}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={history.busy}
                onClick={() => setDeletingRows(null)}
              >
                {label("cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={history.busy}
                onClick={() => {
                  const selection = deletingRows;
                  if (history.busy) return;
                  void run(
                    () =>
                      financeService.removeRows(
                        selection.year,
                        selection.rows.map((row) => row.id),
                      ),
                    false,
                  ).then((success) => {
                    if (success) {
                      setDeletingRows(null);
                      grid.clearSelection();
                    }
                  });
                }}
              >
                {label("confirm_delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {providerFor && (
        <MerchantProviderDialog {...providerFor} onClose={() => setProviderFor(null)} />
      )}
      {verifying && user && (
        <FinanceVerificationDialog
          key={`${verifying.row.id}-${year}-${verifying.month}`}
          userId={user.id}
          row={verifying.row}
          month={`${year}-${String(verifying.month).padStart(2, "0")}`}
          monthLabel={`${monthName(verifying.month - 1)} ${year}`}
          entries={cellEntries(verifying.row, verifying.month)}
          onCardPayment={() => {
            setCardLinkDraft({ rowId: verifying.row.id, month: verifying.month });
            setEditor({ type: "row", row: { ...verifying.row, expense_type: "credit_card" } });
            setVerifying(null);
          }}
          onClose={() => setVerifying(null)}
        />
      )}
      {linking && user && (
        <FinanceStatementLinkDialog
          key={`${linking.row.id}-${year}-${linking.month}`}
          userId={user.id}
          row={linking.row}
          month={`${year}-${String(linking.month).padStart(2, "0")}`}
          monthLabel={`${monthName(linking.month - 1)} ${year}`}
          links={data.finance_statement_links || []}
          onClose={() => setLinking(null)}
        />
      )}
      {noteEntries && (
        <Dialog open onOpenChange={dialogDismissHandler(() => setNoteEntries(null), history.busy)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{label("edit_notes")}</DialogTitle>
              <DialogDescription>
                {t("finance_notes_help", { count: noteEntries.length })}
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void updateEntries(noteEntries, { notes: noteText });
              }}
            >
              <Label htmlFor="finance-selection-notes">{label("notes")}</Label>
              <textarea
                id="finance-selection-notes"
                autoFocus
                className="min-h-28 w-full rounded-md border bg-background p-3 text-sm"
                maxLength={2000}
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={history.busy}
              />
              <Button type="submit" disabled={history.busy}>
                {label("save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      <Dialog
        open={!!statement}
        onOpenChange={dialogDismissHandler(() => setStatement(null), history.busy)}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {statement && data.finance_rows.find((row) => row.id === statement.rowId) && (
            <FinanceCardStatement
              key={`${statement.rowId}-${year}-${statement.month}`}
              row={data.finance_rows.find((row) => row.id === statement.rowId)!}
              month={`${year}-${String(statement.month).padStart(2, "0")}`}
              monthLabel={`${monthName(statement.month - 1)} ${year}`}
              transactions={(data.finance_card_transactions || []).filter(
                (item) =>
                  item.row_id === statement.rowId &&
                  item.month === `${year}-${String(statement.month).padStart(2, "0")}`,
              )}
              ledgerAmount={sumEntries(
                data.finance_entries.filter(
                  (item) =>
                    item.row_id === statement.rowId &&
                    item.date.startsWith(`${year}-${String(statement.month).padStart(2, "0")}`),
                ),
              )}
              today={today}
              money={money}
              label={label}
              pending={history.busy}
              run={(action) => run(action, false)}
              undo={history.undo}
              redo={history.redo}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editor}
        onOpenChange={dialogDismissHandler(() => {
          setEditor(null);
          setCardLinkDraft(null);
        }, mutate.isPending)}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
          onOpenAutoFocus={(event) => {
            if (editor?.type === "reference" && editor.field) {
              const target = document.getElementById(`finance-${editor.field}`);
              if (target) {
                event.preventDefault();
                target.focus();
              }
              return;
            }
            if (editor?.type !== "row") return;
            const target = editor.focusNotes
              ? document.getElementById("finance-notes")
              : editor.confirmDelete
                ? document.getElementById("finance-delete")
                : null;
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          {editor && (
            <FinanceEditor
              key={`${editor.type}-${"month" in editor ? editor.month : "row" in editor ? editor.row?.id : "new"}`}
              editor={editor}
              year={year}
              data={data}
              today={today}
              pending={mutate.isPending}
              run={run}
              onRowSaved={
                cardLinkDraft
                  ? (row) => {
                      if (
                        (row.id === cardLinkDraft.rowId ||
                          row.origin_row === cardLinkDraft.rowId) &&
                        row.kind === "expense" &&
                        row.expense_type === "credit_card"
                      )
                        setLinking({ row, month: cardLinkDraft.month });
                      setCardLinkDraft(null);
                    }
                  : undefined
              }
              label={label}
              money={money}
              monthName={monthName}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DecimalPlacesIcon({ increase = false }: { increase?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <text x="3" y="12" fill="currentColor" fontFamily="inherit" fontSize="12" fontWeight="500">
        {increase ? ".00" : ".0"}
      </text>
      <path
        d={increase ? "M19 18H5m0 0 3-3m-3 3 3 3" : "M5 18h14m0 0-3-3m3 3-3 3"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SheetHeader({
  title,
  section,
  label,
  monthName,
  onAdd,
  addDisabled,
  grid,
}: {
  title: string;
  section: "summary" | "income" | "expense";
  label: (key: string) => string;
  monthName: (index: number, short?: boolean) => string;
  onAdd?: () => void;
  addDisabled?: boolean;
  grid?: FinanceGrid;
}) {
  return (
    <tr className={"finance-sheet__header finance-sheet__header--" + section}>
      <th scope="row" className="finance-sheet__section-name">
        <div>
          {section === "summary" ? (
            title
          ) : (
            <button
              className="finance-sheet__name-button"
              title={label("select_names")}
              aria-label={label("select_names") + " · " + title}
              {...grid?.columnProps(section, -1)}
            >
              {title}
            </button>
          )}
          {onAdd && (
            <button
              className="finance-sheet__add"
              disabled={addDisabled}
              title={label("add_row") + " · " + title}
              aria-label={label("add_row") + " · " + title}
              onClick={onAdd}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </th>
      {Array.from({ length: 12 }, (_, index) => (
        <th key={index} scope="col">
          <button
            className="finance-sheet__month-button"
            aria-label={label("select_column") + " · " + title + " · " + monthName(index)}
            {...grid?.columnProps(section, index)}
          >
            {monthName(index, true)}
          </button>
        </th>
      ))}
      <th scope="col" className="finance-sheet__annual-heading">
        {label("total")}
      </th>
      <th scope="col" className="finance-sheet__annual-heading">
        {label("average")}
      </th>
    </tr>
  );
}

function FinanceSection({
  year,
  summaryTrace,
  carryoverMonths,
  carryoverRowId,
  editableOpening = false,
  openingEntries = [],
  paymentChecks,
  verifications,
  linkedStatement,
  allRows,
  section,
  language,
  saveQuickAmounts,
  saveQuickName,
  grid,
  run,
  pending,
  rows,
  cellEntries,
  money,
  label,
  monthName,
}: {
  year: number;
  summaryTrace: SummaryTrace | null;
  carryoverMonths?: ReturnType<typeof financeMonths>;
  carryoverRowId?: string;
  editableOpening?: boolean;
  openingEntries?: FinanceEntry[];
  paymentChecks?: FinanceData["card_payment_checks"];
  verifications?: FinanceData["entry_verifications"];
  linkedStatement: (rowId: string, month: number) => FinanceStatementLink | undefined;
  allRows: FinanceRow[];
  section: "income" | "expense";
  language: string;
  saveQuickAmounts: (amounts: (number | null)[], focus: boolean) => Promise<boolean>;
  saveQuickName: (name: string, focus: boolean) => Promise<boolean>;
  grid: FinanceGrid;
  run: (action: () => Promise<unknown>, close?: boolean) => Promise<boolean>;
  pending: boolean;
  rows: FinanceRow[];
  cellEntries: (row: FinanceRow, month: number) => FinanceEntry[];
  money: (value: number) => string;
  label: (key: string) => string;
  monthName: (index: number, short?: boolean) => string;
}) {
  const { t } = useTranslation();
  const [draftName, setDraftName] = useState<string | null>(null);
  const draftInput = useRef<HTMLInputElement>(null);
  const [editingOpening, setEditingOpening] = useState(false);
  useEffect(() => setEditingOpening(false), [year]);
  const openingCarryover =
    (carryoverMonths ?? []).reduce(
      (sum, month) => sum + Math.round(month.openingCarryover * 100),
      0,
    ) / 100;
  const title = label(section === "income" ? "sheet_incomes" : "expense");
  const editableRows = rows.filter((row) => row.id !== carryoverRowId);
  const carryoverRow = rows.find((row) => row.id === carryoverRowId);
  const saveDraft = async () => {
    const name = draftName?.trim();
    if (!name || pending) return;
    const saved = await run(
      () =>
        financeService.save("finance_rows", { name, kind: section, notes: "" }, undefined, year),
      false,
    );
    if (saved) setDraftName(null);
  };
  return (
    <>
      <SheetHeader
        title={title}
        section={section}
        grid={grid}
        label={label}
        monthName={monthName}
        addDisabled={pending}
        onAdd={() => {
          if (draftName !== null) draftInput.current?.focus();
          else setDraftName("");
        }}
      />
      {editableRows.map((row) => {
        const entries = Array.from({ length: 12 }, (_, index) => cellEntries(row, index + 1));
        const actual = sumEntries(entries.flat().filter((entry) => entry.status === "settled"));
        const planned = sumEntries(entries.flat().filter((entry) => entry.status === "planned"));
        return (
          <tr key={row.id} className="finance-sheet__data-row" data-finance-kind={row.kind}>
            <th scope="row" {...grid.rowProps(row)}>
              <div className="finance-sheet__row-name">
                {grid.quickName?.id === row.id ? (
                  <FinanceQuickName
                    key={row.id}
                    name={grid.quickName.name}
                    label={
                      label(row.kind === "expense" ? "expense_name" : "income_name") +
                      " · " +
                      row.name
                    }
                    requiredLabel={label("name_required")}
                    pending={pending}
                    onSave={saveQuickName}
                    onCancel={grid.finishQuickName}
                  />
                ) : (
                  <>
                    <button {...grid.cellProps(row, -1)} title={row.notes || label("edit")}>
                      {row.name}
                    </button>
                    {row.kind === "salary" && (
                      <FinanceRowTag type="salary" label={label("salary")} />
                    )}
                    {row.is_loan && <FinanceRowTag type="loan" label={label("loan")} />}
                    {row.is_rent && <FinanceRowTag type="rent" label={label("rent")} />}
                    {row.bill_type && (
                      <FinanceRowTag type={row.bill_type} label={label(`bill_${row.bill_type}`)} />
                    )}
                    {row.expense_type === "credit_card" && (
                      <FinanceRowTag type="credit_card" label={label("credit_card")} />
                    )}
                  </>
                )}
              </div>
              {row.payment_card && (
                <p className="finance-sheet__card-detail">
                  {label("default_card")} ·{" "}
                  {allRows.find((card) => card.id === row.payment_card)?.name}
                </p>
              )}
            </th>
            {entries.map((cell, index) => {
              const paid = cell.filter((entry) => entry.status === "settled"),
                planned = cell.filter((entry) => entry.status === "planned");
              const cardTagged = cell.some((entry) => isCardPaid(entry, row));
              const cardTagLabel = label(
                cell.every((entry) => isCardPaid(entry, row))
                  ? "tag_card_short"
                  : "tag_mixed_short",
              );
              const directTagged = cell.some((entry) => entry.payment_tag === "direct");
              const statementLink =
                row.expense_type === "credit_card" ? linkedStatement(row.id, index + 1) : undefined;
              const paymentCheck = statementLink ? paymentChecks?.[statementLink.id] : undefined;
              const tagDescription = [
                cardTagged && cardTagLabel,
                directTagged && label("tag_direct"),
                statementLink && label("statement_linked"),
              ]
                .filter(Boolean)
                .join(" · ");
              const hasTags = cell.some((entry) => verifications?.[entry.id]);
              const quickEditing =
                grid.quickEdit?.row.id === row.id && grid.quickEdit.month === index + 1;
              const contributingEntries =
                summaryTrace &&
                (typeof summaryTrace.column !== "number" || summaryTrace.column === index + 1)
                  ? cell.filter((entry) => contributesToSummary(row, entry, summaryTrace.field))
                  : [];
              const contribution = sumEntries(contributingEntries);
              const contributionTitle = contributingEntries.length
                ? t("finance_summary_contribution", {
                    amount: money(
                      summaryTrace?.field === "remaining" && row.kind === "expense"
                        ? -contribution
                        : contribution,
                    ),
                  })
                : undefined;
              return (
                <td
                  key={index}
                  className="finance-sheet__month-cell"
                  data-summary-contributor={contributingEntries.length > 0 || undefined}
                  title={contributionTitle}
                >
                  {quickEditing && grid.quickEdit ? (
                    <FinanceQuickAmount
                      key={`${row.id}-${index}`}
                      row={row}
                      entries={grid.quickEdit.entries}
                      title={row.name + " · " + monthName(index)}
                      language={language}
                      label={label}
                      pending={pending}
                      onSave={saveQuickAmounts}
                      onCancel={grid.finishQuickEdit}
                    />
                  ) : (
                    <button
                      {...grid.cellProps(row, index)}
                      data-has-note={cell.some((entry) => entry.notes) || undefined}
                      title={
                        cell
                          .filter((entry) => entry.notes)
                          .map((entry) => entry.notes)
                          .join("\n") || undefined
                      }
                      aria-label={row.name + " · " + monthName(index) + " · " + label("detail")}
                      aria-description={tagDescription || undefined}
                    >
                      {paid.length > 0 && (
                        <span
                          className={
                            row.kind === "expense"
                              ? "finance-sheet__settled"
                              : "finance-sheet__received"
                          }
                          title={
                            contributionTitle ||
                            paid
                              .map((entry) => entry.notes)
                              .filter(Boolean)
                              .join("\n") ||
                            label(row.kind === "expense" ? "expense_paid" : "income_received")
                          }
                        >
                          {money(sumEntries(paid))}
                        </span>
                      )}
                      {planned.length > 0 && (
                        <span
                          className={
                            row.kind === "expense"
                              ? "finance-sheet__pending"
                              : "finance-sheet__expected"
                          }
                          title={
                            planned
                              .map((entry) => entry.notes)
                              .filter(Boolean)
                              .join("\n") ||
                            label(row.kind === "expense" ? "expense_pending" : "income_expected")
                          }
                        >
                          {money(sumEntries(planned))}
                        </span>
                      )}
                      {cell.length === 0 && <span className="sr-only">{label("empty_cell")}</span>}
                      {hasTags && (
                        <span className="finance-sheet__tags">
                          {cell.length > 0 &&
                            cell.every((entry) => verifications?.[entry.id] === "verified") && (
                              <span
                                className="text-xs text-emerald-700 dark:text-emerald-300"
                                title={label("statement_verified")}
                              >
                                ✓
                              </span>
                            )}
                          {cell.some((entry) => verifications?.[entry.id] === "verified") &&
                            cell.some((entry) => !verifications?.[entry.id]) &&
                            !cell.some((entry) => verifications?.[entry.id] === "changed") && (
                              <span
                                className="text-xs text-amber-700 dark:text-amber-300"
                                title={label("statement_partial")}
                              >
                                ◐
                              </span>
                            )}
                          {cell.some((entry) => verifications?.[entry.id] === "changed") && (
                            <span
                              className="text-xs text-amber-700 dark:text-amber-300"
                              title={label("statement_changed")}
                            >
                              !
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  )}
                  {cardTagged && !quickEditing && (
                    <FinanceCellTag
                      type="card"
                      label={cardTagLabel}
                      description={label("tag_credit_card_help")}
                    />
                  )}
                  {statementLink && !quickEditing && (
                    <FinanceCellTag
                      type="statement"
                      statementId={statementLink.statement_id}
                      label={
                        paymentCheck
                          ? label(`card_payment_status_${paymentCheck.status}`)
                          : label("statement_linked")
                      }
                      paymentCheck={paymentCheck}
                    />
                  )}
                </td>
              );
            })}
            <td
              className="finance-sheet__annual"
              title={
                label("confirmed") +
                ": " +
                money(actual) +
                (planned ? " · " + label("planned") + ": " + money(planned) : "")
              }
            >
              {money(actual)}
            </td>
            <td className="finance-sheet__annual">{money(actual / 12)}</td>
          </tr>
        );
      })}
      {draftName !== null ? (
        <tr className="finance-sheet__draft">
          <th scope="row" colSpan={3}>
            <form
              className="finance-sheet__draft-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveDraft();
              }}
            >
              <Input
                ref={draftInput}
                autoFocus
                aria-label={
                  label(section === "income" ? "income_name" : "expense_name") + " · " + title
                }
                placeholder={label(section === "income" ? "income_name" : "expense_name")}
                value={draftName}
                maxLength={160}
                required
                disabled={pending}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !pending) {
                    event.preventDefault();
                    setDraftName(null);
                  }
                }}
              />
              <button
                type="submit"
                disabled={pending || !draftName.trim()}
                aria-label={label("save") + " · " + title}
                title={label("save")}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setDraftName(null)}
                aria-label={label("cancel") + " · " + title}
                title={label("cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          </th>
          <td colSpan={12} />
        </tr>
      ) : editableRows.length === 0 ? (
        <tr className="finance-sheet__data-row finance-sheet__append-row">
          <th scope="row">
            <button
              type="button"
              {...grid.appendRowProps(section)}
              aria-label={label("blank_row") + " · " + title}
              title={label("blank_row_help")}
              onDoubleClick={() => setDraftName("")}
              onKeyDown={(event) => {
                if (["Enter", "F2"].includes(event.key)) {
                  event.preventDefault();
                  event.stopPropagation();
                  setDraftName("");
                }
              }}
            >
              {label("blank_row")}
            </button>
          </th>
          {Array.from({ length: 12 }, (_, index) => (
            <td key={index}>
              <button
                type="button"
                {...grid.appendRowProps(section, index)}
                aria-label={`${label("blank_row")} · ${title} · ${monthName(index)}`}
              >
                <span className="sr-only">{label("empty_cell")}</span>
              </button>
            </td>
          ))}
          <td className="finance-sheet__annual" />
          <td className="finance-sheet__annual" />
        </tr>
      ) : null}
      {carryoverRow && carryoverMonths && (
        <tr key={carryoverRow.id} className="finance-sheet__data-row">
          <th scope="row" title={label("carryover_help")}>
            <div className="finance-sheet__row-name">
              <span className="min-w-0 truncate">{label("previous_month_deficit")}</span>
              <span className="shrink-0 rounded border border-border/60 px-1 text-[9px] font-normal text-muted-foreground">
                {label("automatic")}
              </span>
            </div>
          </th>
          {carryoverMonths.map((month, index) => {
            const highlighted =
              month.carryover > 0 &&
              summaryTrace &&
              summaryTrace.field !== "received" &&
              (typeof summaryTrace.column === "number"
                ? summaryTrace.column === index + 1
                : month.openingCarryover > 0);
            return (
              <td
                key={month.month}
                data-summary-contributor={highlighted || undefined}
                title={label(
                  editableOpening && index === 0 ? "opening_deficit_help" : "carryover_help",
                )}
              >
                {editableOpening && index === 0 ? (
                  editingOpening ? (
                    <FinanceQuickAmount
                      key={`${year}-opening`}
                      row={carryoverRow}
                      entries={
                        openingEntries.length
                          ? [{ ...openingEntries[0], amount: sumEntries(openingEntries) }]
                          : []
                      }
                      title={`${label("previous_month_deficit")} · ${monthName(0)}`}
                      language={language}
                      label={label}
                      pending={pending}
                      onSave={async (amounts) => {
                        const saved = await run(
                          () =>
                            financeService.setOpeningDeficit(
                              year,
                              amounts[0],
                              sumEntries(openingEntries),
                            ),
                          false,
                        );
                        if (saved) setEditingOpening(false);
                        return saved;
                      }}
                      onCancel={() => setEditingOpening(false)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="finance-sheet__cell"
                      disabled={pending}
                      aria-label={`${label("previous_month_deficit")} · ${monthName(0)} · ${label("edit")}`}
                      onClick={() => setEditingOpening(true)}
                    >
                      {month.carryover > 0 ? money(month.carryover) : "—"}
                    </button>
                  )
                ) : month.carryover > 0 ? (
                  money(month.carryover)
                ) : (
                  "—"
                )}
              </td>
            );
          })}
          <td className="finance-sheet__annual" title={label("carryover_annual_help")}>
            {money(openingCarryover)}
          </td>
          <td className="finance-sheet__annual" title={label("carryover_annual_help")}>
            {money(openingCarryover / 12)}
          </td>
        </tr>
      )}
    </>
  );
}
