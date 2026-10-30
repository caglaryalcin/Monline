import { type FinanceEntry, type FinanceRow, sumEntries } from "./finance";

export interface GridPoint {
  row: number;
  col: number;
}
export interface GridSelection {
  anchor: GridPoint;
  focus: GridPoint;
  columns?: number[];
  cells?: GridPoint[];
}
export interface CopiedRecord {
  amount: number;
  status: "planned" | "settled";
  settled_date: string;
  payment_tag?: FinanceEntry["payment_tag"];
}
export interface FinanceClipboard {
  cutId?: string;
  format: "monline-finance-cells";
  version: 1;
  cells: CopiedRecord[][][];
  rowNames?: string[];
}
export const FINANCE_CLIPBOARD_TYPE = "application/x-monline-finance-cells";
export interface PastedCell {
  row_id: string;
  month: number;
  amount: number;
  entry_id: string | null;
  expected_amount: number | null;
  records?: CopiedRecord[];
}
export interface PastedRow {
  row_id: string;
  name: string;
  kind: FinanceRow["kind"];
  expected?: Required<Omit<FinanceRow, "payment_card" | "bill_type" | "row_order" | "is_loan" | "is_rent" | "is_auto_carryover" | "loan_id" | "year" | "origin_row" | "is_deleted">> &
    Pick<FinanceRow, "payment_card" | "bill_type" | "row_order" | "is_loan" | "is_rent" | "is_auto_carryover" | "loan_id" | "year" | "origin_row" | "is_deleted">;
}
export function selectionBounds(selection: GridSelection) {
  if (selection.cells?.length) return {
    top: Math.min(...selection.cells.map((cell) => cell.row)),
    bottom: Math.max(...selection.cells.map((cell) => cell.row)),
    left: Math.min(...selection.cells.map((cell) => cell.col)),
    right: Math.max(...selection.cells.map((cell) => cell.col)),
  };
  return {
    top: Math.min(selection.anchor.row, selection.focus.row),
    bottom: Math.max(selection.anchor.row, selection.focus.row),
    left: selection.columns?.length
      ? Math.min(...selection.columns)
      : Math.min(selection.anchor.col, selection.focus.col),
    right: selection.columns?.length
      ? Math.max(...selection.columns)
      : Math.max(selection.anchor.col, selection.focus.col),
  };
}
export function selectionColumns(selection: GridSelection) {
  if (selection.cells?.length) return [...new Set(selection.cells.map((cell) => cell.col))].sort((a, b) => a - b);
  const bounds = selectionBounds(selection);
  return selection.columns?.length
    ? [...selection.columns].sort((a, b) => a - b)
    : Array.from({ length: bounds.right - bounds.left + 1 }, (_, i) => bounds.left + i);
}
export function selectionRows(selection: GridSelection) {
  if (selection.cells?.length) return [...new Set(selection.cells.map((cell) => cell.row))].sort((a, b) => a - b);
  const { top, bottom } = selectionBounds(selection);
  return Array.from({ length: bottom - top + 1 }, (_, index) => top + index);
}
export function selectionContains(selection: GridSelection, point: GridPoint) {
  if (selection.cells) return selection.cells.some((cell) => cell.row === point.row && cell.col === point.col);
  const bounds = selectionBounds(selection);
  return point.row >= bounds.top && point.row <= bounds.bottom && selectionColumns(selection).includes(point.col);
}
export function selectionPoints(selection: GridSelection): GridPoint[] {
  return selection.cells
    ? [...selection.cells].sort((a, b) => a.row - b.row || a.col - b.col)
    : selectionRows(selection).flatMap((row) => selectionColumns(selection).map((col) => ({ row, col })));
}
export function toggleSelectionCells(selection: GridSelection | null, targets: GridPoint[]): GridSelection | null {
  if (!targets.length) return selection;
  const key = (point: GridPoint) => `${point.row}:${point.col}`;
  const previous = selection ? selectionPoints(selection).filter((point) => (point.col === -1) === (targets[0].col === -1)) : [];
  const previousKeys = new Set(previous.map(key)), targetKeys = new Set(targets.map(key));
  const remove = targets.every((point) => previousKeys.has(key(point)));
  const cells = remove ? previous.filter((point) => !targetKeys.has(key(point)))
    : [...previous, ...targets.filter((point) => !previousKeys.has(key(point)))];
  if (!cells.length) return null;
  const anchor = selection && cells.some((point) => key(point) === key(selection.anchor)) ? selection.anchor : cells[0];
  return { anchor, focus: remove ? cells[cells.length - 1] : targets[targets.length - 1], cells };
}
export function copyFinanceMetadata(
  rows: FinanceRow[],
  entries: FinanceEntry[],
  year: number,
  selection: GridSelection,
): FinanceClipboard {
  const selectedRows = selectionRows(selection),
    columns = selectionColumns(selection);
  return {
    format: "monline-finance-cells",
    version: 1,
    cells: selectedRows.map((row) =>
      columns
        .filter((col) => col >= 0)
        .map((col) =>
          (selectionContains(selection, { row, col }) ? cellEntries(entries, rows[row].id, year, col) : []).map(
            ({ amount, status, settled_date, payment_tag }) => ({
              amount,
              status,
              settled_date,
              ...(payment_tag ? { payment_tag } : {}),
            }),
          ),
        ),
    ),
    ...(columns.includes(-1)
      ? { rowNames: selectedRows.map((index) => rows[index].name) }
      : {}),
  };
}
export function clipboardHtml(payload: FinanceClipboard) {
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `<table data-monline-finance="${encodeURIComponent(JSON.stringify(payload))}">${payload.cells.map((row, index) => `<tr>${payload.rowNames ? `<td>${escape(payload.rowNames[index])}</td>` : ""}${row.map((records) => `<td>${records.reduce((sum, record) => sum + Math.round(record.amount * 100), 0) / 100}</td>`).join("")}</tr>`).join("")}</table>`;
}
export function readFinanceMetadata(json: string, html = ""): FinanceClipboard | undefined {
  if (json.length + html.length > 2000000) return undefined;
  try {
    const encoded = html.match(/data-monline-finance=["']([^"']+)["']/)?.[1];
    const value = JSON.parse(json || (encoded ? decodeURIComponent(encoded) : "null"));
    if (
      value?.format !== "monline-finance-cells" ||
      value.version !== 1 ||
      !Array.isArray(value.cells) ||
      !value.cells.length ||
      value.cells.length > 1200
    )
      return undefined;
    const width = value.cells[0]?.length;
    if (
      value.rowNames &&
      (!Array.isArray(value.rowNames) ||
        value.rowNames.length !== value.cells.length ||
        value.rowNames.some(
          (name: unknown) => typeof name !== "string" || !name.trim() || name.length > 160,
        ))
    )
      return undefined;
    if (
      (width === 0 && !value.rowNames) ||
      width > 12 ||
      value.cells.length * (width + (value.rowNames ? 1 : 0)) > 1200
    )
      return undefined;
    let count = 0;
    for (const row of value.cells) {
      if (!Array.isArray(row) || row.length !== width) return undefined;
      for (const records of row) {
        if (!Array.isArray(records)) return undefined;
        for (const record of records) {
          count++;
          if (
            count > 1200 ||
            typeof record.amount !== "number" ||
            !Number.isFinite(record.amount) ||
            record.amount < 0 ||
            record.amount > 1e12 ||
            Math.abs(record.amount * 100 - Math.round(record.amount * 100)) > 0.001 ||
            !["planned", "settled"].includes(record.status) ||
            (record.payment_tag !== undefined &&
              !["", "credit_card", "direct"].includes(record.payment_tag)) ||
            typeof record.settled_date !== "string" ||
            (record.status === "settled" && !/^\d{4}-\d{2}-\d{2}$/.test(record.settled_date)) ||
            (record.status === "planned" && record.settled_date !== "")
          )
            return undefined;
        }
      }
    }
    return value;
  } catch {
    return undefined;
  }
}
export function cellEntries(entries: FinanceEntry[], row: string, year: number, col: number) {
  const prefix = `${year}-${String(col + 1).padStart(2, "0")}`;
  return entries.filter((entry) => entry.row_id === row && entry.date.startsWith(prefix));
}
export function copyFinanceCells(
  rows: FinanceRow[],
  entries: FinanceEntry[],
  year: number,
  selection: GridSelection,
  language: string,
) {
  const selectedRows = selectionRows(selection),
    columns = selectionColumns(selection);
  const format = new Intl.NumberFormat(language, {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return selectedRows.map((row) =>
    columns
      .map((col) => {
        if (!selectionContains(selection, { row, col })) return "";
        if (col === -1) {
          const name = rows[row].name;
          return /[\t\r\n"]/.test(name) ? `"${name.replace(/"/g, '""')}"` : name;
        }
        const values = cellEntries(entries, rows[row].id, year, col);
        return values.length ? format.format(sumEntries(values)) : "";
      })
      .join("\t"),
  ).join("\r\n");
}
export function parseClipboardAmount(raw: string): number | null {
  let value = raw.trim();
  if (!value) return null;
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).trim();
  value = value
    .replace(/^(?:TRY|TL|₺)\s*|\s*(?:TRY|TL|₺)$/gi, "")
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/^\+/, "");
  if (!/^(?:\d+(?:[.,]\d+)*|[.,]\d{1,2})$/.test(value))
    throw new Error("finance_clipboard_invalid");
  const comma = value.lastIndexOf(","),
    dot = value.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".",
      group = decimal === "," ? "." : ",";
    const parts = value.split(decimal);
    if (
      parts.length !== 2 ||
      !/^\d{1,2}$/.test(parts[1]) ||
      !new RegExp("^\\d{1,3}(\\" + group + "\\d{3})+$").test(parts[0])
    )
      throw new Error("finance_clipboard_invalid");
    value = parts[0].split(group).join("") + "." + parts[1];
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? "," : ".",
      parts = value.split(separator);
    if (parts.length === 2 && parts[1].length <= 2) value = (parts[0] || "0") + "." + parts[1];
    else if (/^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((part) => /^\d{3}$/.test(part)))
      value = parts.join("");
    else throw new Error("finance_clipboard_invalid");
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1e12)
    throw new Error("finance_clipboard_invalid");
  return Math.round(number * 100) / 100;
}
export function prepareFinancePaste(
  text: string,
  rows: FinanceRow[],
  entries: FinanceEntry[],
  year: number,
  selection: GridSelection,
  metadata?: FinanceClipboard,
  section?: "income" | "expense",
  appendName?: string,
) {
  if (text.length > 250000) throw new Error("finance_clipboard_too_large");
  if (selectionBounds(selection).left === -1)
    return prepareNamedPaste(text, rows, entries, year, selection, metadata, section);
  if (metadata?.rowNames) throw new Error("finance_clipboard_name_target");
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  if (lines.length > 1200) throw new Error("finance_clipboard_too_large");
  const width = metadata
    ? metadata.cells[0].length
    : Math.max(...lines.map((line) => line.split("\t").length));
  if (lines.length * width > 1200) throw new Error("finance_clipboard_too_large");
  const matrix = metadata
    ? metadata.cells.map((row) =>
        row.map((records) =>
          records.length
            ? records.reduce((sum, record) => sum + Math.round(record.amount * 100), 0) / 100
            : null,
        ),
      )
    : lines.map((line) => line.split("\t").map(parseClipboardAmount));
  let appendedRows: PastedRow[] | undefined;
  if (appendName && section && selectionBounds(selection).top === rows.length) {
    appendedRows = matrix.map((_, index) => ({
      row_id: `new:${index}`,
      name: matrix.length === 1 ? appendName : `${appendName} ${index + 1}`,
      kind: section,
    }));
    rows = [...rows, ...appendedRows.map((row) => ({ id: row.row_id, name: row.name, kind: row.kind, notes: "" }))];
  }
  if (selection.cells) {
    const points = selectionPoints(selection), selectedRows = selectionRows(selection), columns = selectionColumns(selection);
    if (points.length > 1200) throw new Error("finance_clipboard_too_large");
    const single = matrix.length === 1 && width === 1;
    const linear = matrix.length * width === points.length;
    const tile = selectedRows.length % matrix.length === 0 && columns.length % width === 0;
    if (!single && !linear && !tile) throw new Error("finance_clipboard_selection");
    const cells: PastedCell[] = [];
    points.forEach((point, index) => {
      const y = single ? 0 : linear ? Math.floor(index / width) : selectedRows.indexOf(point.row) % matrix.length;
      const x = single ? 0 : linear ? index % width : columns.indexOf(point.col) % width;
      const amount = matrix[y][x] ?? null;
      if (amount === null) return;
      const row = rows[point.row];
      if (!row || point.col < 0 || point.col > 11) throw new Error("finance_clipboard_bounds");
      const existing = cellEntries(entries, row.id, year, point.col);
      if (existing.length > 1) throw new Error("finance_clipboard_multiple");
      cells.push({ row_id: row.id, month: point.col + 1, amount, entry_id: existing[0]?.id ?? null,
        expected_amount: existing[0]?.amount ?? null, ...(metadata ? { records: metadata.cells[y][x] } : {}) });
    });
    if (!cells.length) throw new Error("finance_clipboard_empty");
    return { cells, rows: appendedRows, selection };
  }
  const { top, bottom, left } = selectionBounds(selection);
  const selectedColumns = selectionColumns(selection),
    selectedHeight = bottom - top + 1;
  const tile =
    selectedHeight >= matrix.length &&
    selectedColumns.length >= width &&
    selectedHeight % matrix.length === 0 &&
    selectedColumns.length % width === 0;
  const height = tile ? selectedHeight : matrix.length,
    columns = tile ? selectedColumns.length : width;
  const targetColumns =
    tile || selectedColumns.length === width
      ? selectedColumns
      : Array.from({ length: columns }, (_, i) => left + i);
  if (top + height > rows.length || Math.max(...targetColumns) > 11)
    throw new Error("finance_clipboard_bounds");
  if (height * columns > 1200) throw new Error("finance_clipboard_too_large");
  const cells: PastedCell[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < columns; x++) {
      const amount = matrix[y % matrix.length][x % width] ?? null;
      if (amount === null) continue;
      const row = rows[top + y],
        existing = cellEntries(entries, row.id, year, targetColumns[x]);
      if (existing.length > 1) throw new Error("finance_clipboard_multiple");
      cells.push({
        row_id: row.id,
        month: targetColumns[x] + 1,
        amount,
        entry_id: existing[0]?.id ?? null,
        expected_amount: existing[0]?.amount ?? null,
        ...(metadata ? { records: metadata.cells[y % matrix.length][x % width] } : {}),
      });
    }
  if (!cells.length) throw new Error("finance_clipboard_empty");
  return {
    cells,
    rows: appendedRows,
    selection: {
      anchor: { row: top, col: left },
      focus: { row: top + height - 1, col: targetColumns[targetColumns.length - 1] },
      columns: targetColumns,
    },
  };
}

// Excel quotes names containing tabs, line breaks or quote characters.
function parseTsv(text: string) {
  const result: string[][] = [[]];
  let field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && (quoted || !field)) {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === "\t" || char === "\r" || char === "\n")) {
      result[result.length - 1].push(field);
      field = "";
      if (char !== "\t") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        result.push([]);
      }
    } else field += char;
    if (result.length > 1202) throw new Error("finance_clipboard_too_large");
  }
  if (quoted) throw new Error("finance_clipboard_invalid");
  result[result.length - 1].push(field);
  while (result.length && result[result.length - 1].every((value) => !value.trim())) result.pop();
  return result;
}
function prepareNamedPaste(
  text: string,
  rows: FinanceRow[],
  entries: FinanceEntry[],
  year: number,
  selection: GridSelection,
  metadata?: FinanceClipboard,
  section?: "income" | "expense",
) {
  if (metadata && !metadata.rowNames) throw new Error("finance_clipboard_name_target");
  const matrix = metadata?.rowNames
    ? metadata.rowNames.map((name, index) => [name, ...metadata.cells[index].map(() => "")])
    : parseTsv(text).filter((row) => row.some((value) => value.trim()));
  if (!metadata && /^(oca(k)?|jan(uary|uar)?)\.?$/i.test(matrix[0]?.[1]?.trim() || ""))
    matrix.shift();
  if (!matrix.length) throw new Error("finance_clipboard_empty");
  const width = Math.max(...matrix.map((line) => line.length));
  if (width > 15) throw new Error("finance_clipboard_bounds");
  const amountWidth = Math.min(12, width - 1);
  const selectedMonths = selectionColumns(selection).filter((col) => col >= 0);
  const targetColumns =
    selectedMonths.length === amountWidth
      ? selectedMonths
      : Array.from({ length: amountWidth }, (_, index) => index);
  if (matrix.length * (amountWidth + 1) > 1200) throw new Error("finance_clipboard_too_large");
  const { top } = selectionBounds(selection);
  const kind = section || (rows[top]?.kind === "expense" ? "expense" : "income");
  const targets = (selection.cells ? selectionRows(selection).map((index) => rows[index]) : rows.slice(top))
    .filter((row) => (kind === "expense" ? row.kind === "expense" : row.kind !== "expense"));
  const changes: PastedRow[] = [],
    cells: PastedCell[] = [];
  for (let y = 0; y < matrix.length; y++) {
    const name = matrix[y][0].trim();
    if (!name && matrix[y].every((value) => !value.trim())) continue;
    if (!name || name.length > 160) throw new Error("finance_clipboard_name_invalid");
    const target = targets[y],
      rowId = target?.id || `new:${y}`;
    changes.push({
      row_id: rowId,
      name,
      kind: target?.kind || kind,
      ...(target
        ? {
            expected: {
              ...target,
              expense_type: target.expense_type || "",
              source_subscription: target.source_subscription || "",
            },
          }
        : {}),
    });
    for (let col = 0; col < amountWidth; col++) {
      const records = metadata?.cells[y][col];
      const amount = records
        ? records.length
          ? records.reduce((sum, record) => sum + Math.round(record.amount * 100), 0) / 100
          : null
        : parseClipboardAmount(matrix[y][col + 1] || "");
      if (amount === null) continue;
      const existing = target ? cellEntries(entries, target.id, year, targetColumns[col]) : [];
      if (existing.length > 1) throw new Error("finance_clipboard_multiple");
      cells.push({
        row_id: rowId,
        month: targetColumns[col] + 1,
        amount,
        entry_id: existing[0]?.id || null,
        expected_amount: existing[0]?.amount ?? null,
        ...(records ? { records } : {}),
      });
    }
  }
  if (!changes.length) throw new Error("finance_clipboard_empty");
  return {
    rows: changes,
    cells,
    selection: selection.cells && changes.length <= targets.length ? selection : {
      anchor: { row: top, col: -1 },
      focus: { row: top + matrix.length - 1, col: targetColumns.at(-1) ?? -1 },
      columns: [-1, ...targetColumns],
    },
  };
}
