import { joinStatementFragments, parseStatementAmount } from "./statementAmounts";
import { normalizeMerchant } from "./statementCategories";
import type { StatementLine } from "./statements";

export interface StatementPdfFragment {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type PhysicalRow = { y: number; items: StatementPdfFragment[] };
type LogicalRow = { y: number; items: StatementPdfFragment[]; text?: string; issue?: boolean };
const currency = /(?:TRY|TL|₺|USD|EUR|GBP|\$|€|£)/i;
const moneyFragment = /^[\d.,\s+−\-₺$€£]*(?:(?:TRY|TL|USD|EUR|GBP)[\d.,\s+−\-₺$€£]*)?$/i;
const dateText = /^\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?$/;
const partialDate = /^\d{1,2}[./-](?:\d{1,2}[./-])?$/;
const ordered = (items: readonly StatementPdfFragment[]) =>
  [...items].sort((a, b) => (Math.abs(a.y - b.y) < 2.5 ? a.x - b.x : b.y - a.y));

function moneyCell(items: readonly StatementPdfFragment[]) {
  if (!items.length || items.some((item) => !moneyFragment.test(item.text.trim()))) return null;
  const sorted = ordered(items);
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1],
      current = sorted[index];
    // Widely separated numeric fields must not be concatenated into a larger
    // number merely because both happen to lie under the same heading.
    if (
      Math.abs(previous.y - current.y) < 2.5 &&
      /\d/.test(previous.text) &&
      /\d/.test(current.text) &&
      current.x - previous.x - previous.width > Math.max(previous.height, current.height)
    )
      return null;
  }
  const raw = sorted
    .map((item) => item.text.trim())
    .join("")
    .replace(/\s+/g, "");
  let value = parseStatementAmount(raw);
  if (
    !value &&
    (raw.match(/[+−-]/g) || []).length === 1 &&
    sorted.some((item) =>
      /^(?:[+−-]\s*(?:TRY|TL|₺|USD|EUR|GBP|\$|€|£)?|(?:TRY|TL|₺|USD|EUR|GBP|\$|€|£)\s*[+−-])$/i.test(
        item.text.trim(),
      ),
    )
  ) {
    // A separately drawn sign can sit beside the currency on its wrapped line.
    // Move only that isolated sign, never a minus embedded between two numbers.
    value = parseStatementAmount(`${raw.match(/[+−-]/)![0]}${raw.replace(/[+−-]/, "")}`);
  }
  if (!value) return null;
  const explicitCurrency = currency.test(raw);
  const digits = raw.replace(/TRY|TL|USD|EUR|GBP|₺|\$|€|£/gi, "").replace(/[+−-]/g, "");
  // Preserve the printed numeric characters. No rounding, balancing or digit
  // inference is involved in joining an explicitly identified monetary cell.
  return {
    ...value,
    explicitCurrency,
    text: `${value.credit ? "-" : ""}${digits}${explicitCurrency ? ` ${value.currency === "TRY" ? "TL" : value.currency}` : ""}`,
  };
}

function summaryRows(rows: PhysicalRow[]): LogicalRow[] {
  const items = rows.flatMap((row) => row.items);
  const labels = [
    /\bonceki\b/,
    /^odemeler$/,
    /^harcamalar\b/,
    /^nakit avans\b/,
    /^faiz[, ]/,
    /^ekstre borcu$/,
  ];
  for (const firstRow of rows) {
    const first = firstRow.items.find((item) => labels[0].test(normalizeMerchant(item.text)));
    if (!first) continue;
    const anchors: StatementPdfFragment[] = [first];
    for (const label of labels.slice(1)) {
      const previous = anchors[anchors.length - 1];
      const found = items
        .filter(
          (item) =>
            item.x > previous.x + 12 &&
            Math.abs(item.y - first.y) <= Math.max(first.height, item.height) * 3 &&
            label.test(normalizeMerchant(item.text).trim()),
        )
        .sort((a, b) => Math.abs(a.y - first.y) - Math.abs(b.y - first.y))[0];
      if (!found) break;
      anchors.push(found);
    }
    if (anchors.length !== 6) continue;
    const centers = anchors.map((item) => item.x + item.width / 2);
    const boundaries = centers.slice(1).map((center, index) => (center + centers[index]) / 2);
    const top = Math.min(...anchors.map((item) => item.y)) - first.height * 0.75;
    const bottom = top - first.height * 5;
    const cells: StatementPdfFragment[][] = Array.from({ length: 6 }, () => []);
    for (const row of rows) {
      if (row.y > top || row.y < bottom) continue;
      for (const item of row.items) {
        if (!moneyFragment.test(item.text.trim()) || !item.text.trim()) continue;
        const center = item.x + item.width / 2;
        const column = boundaries.findIndex((edge) => center < edge);
        cells[column < 0 ? 5 : column].push(item);
      }
    }
    const values = cells.map(moneyCell);
    if (
      values.some(
        (value) => !value || !value.explicitCurrency || value.currency !== "TRY" || value.credit,
      )
    )
      continue;
    const consumed = new Set(cells.flat());
    const merged: LogicalRow = {
      y: Math.max(...cells.flat().map((item) => item.y)),
      items: [],
      text: values.map((value) => value!.text).join("\u2003"),
    };
    return [
      ...rows
        .map((row) => ({ ...row, items: row.items.filter((item) => !consumed.has(item)) }))
        .filter((row) => row.items.length),
      merged,
    ].sort((a, b) => b.y - a.y);
  }
  return rows;
}

interface TableColumns {
  description: number;
  installment: number | null;
  amount: number;
  height: number;
  currency?: string;
}
function tableColumns(row: LogicalRow): TableColumns | null {
  const find = (pattern: RegExp) =>
    row.items.find((item) => pattern.test(normalizeMerchant(item.text).trim()));
  const date = find(/^(?:islem tarihi|tarih|transaction date|date)$/);
  const description = find(/^(?:aciklama|isyeri|description|merchant)$/);
  const amount = find(/^(?:tutar|amount)(?:\s*\([^)]*\))?$/);
  const installment = find(/^(?:taksit|installment)$/);
  if (
    !date ||
    !description ||
    !amount ||
    date.x >= description.x ||
    description.x >= amount.x ||
    (installment && (installment.x <= description.x || installment.x >= amount.x))
  )
    return null;
  const height = Math.max(date.height, description.height, amount.height);
  const declaredCurrency = amount.text.match(/\b(?:TL|TRY|USD|EUR|GBP)\b|[₺$€£]/i)?.[0];
  return {
    description: description.x - height,
    installment: installment ? installment.x - height : null,
    amount: installment
      ? (installment.x + amount.x) / 2
      : Math.max(description.x + height * 2, amount.x - height * 6),
    height,
    currency: declaredCurrency,
  };
}

function labelledRows(rows: LogicalRow[]): LogicalRow[] {
  const consumed = new Set<StatementPdfFragment>();
  const merged: LogicalRow[] = [];
  const tableY = rows.find((row) => tableColumns(row))?.y ?? -Infinity;
  const isLabel =
    /^(?:ekstre borcu|donem borcu|hesap ozeti borcu|(?:minimum|asgari) odeme tutari|(?:bir )?onceki (?:ekstre|donem) (?:borcu|bakiyesi)|devreden bakiye|yapilan odemeler|toplam harcamalar?|toplam nakit avans|toplam faiz ve (?:vergiler|ucretler))$/;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.y <= tableY) break;
    for (const label of row.items) {
      if (!isLabel.test(normalizeMerchant(label.text).trim())) continue;
      const left = label.x + label.width;
      const right = Math.min(
        ...row.items
          .filter(
            (item) =>
              item.x > left && /\p{L}{3}/u.test(item.text) && !moneyFragment.test(item.text.trim()),
          )
          .map((item) => item.x),
        Infinity,
      );
      const candidates: StatementPdfFragment[] = [];
      for (const part of rows.slice(index, index + 4)) {
        if (part.y <= tableY || row.y - part.y > label.height * 3.6) break;
        if (part !== row && part.items.some((item) => item.x < left && /\p{L}/u.test(item.text)))
          break;
        candidates.push(
          ...part.items.filter(
            (item) =>
              item.x >= left &&
              item.x < right &&
              moneyFragment.test(item.text.trim()) &&
              !consumed.has(item),
          ),
        );
      }
      const value = moneyCell(candidates);
      if (!value?.explicitCurrency || value.credit) continue;
      consumed.add(label);
      candidates.forEach((item) => consumed.add(item));
      merged.push({ y: row.y, items: [], text: `${label.text}\u2003${value.text}` });
    }
  }
  if (!merged.length) return rows;
  return [
    ...rows
      .map((row) => ({ ...row, items: row.items.filter((item) => !consumed.has(item)) }))
      .filter((row) => row.items.length || row.text),
    ...merged,
  ].sort((a, b) => b.y - a.y);
}

function rowCells(row: LogicalRow, columns: TableColumns) {
  const cells: StatementPdfFragment[][] = [[], [], [], []];
  for (const item of row.items) {
    const column =
      item.x < columns.description
        ? 0
        : item.x >= columns.amount
          ? 3
          : columns.installment !== null && item.x >= columns.installment
            ? 2
            : 1;
    cells[column].push(item);
  }
  return cells;
}

function transactionRows(rows: LogicalRow[]): LogicalRow[] {
  const result: LogicalRow[] = [];
  let columns: TableColumns | null = null;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const header = tableColumns(row);
    if (header) {
      columns = header;
      result.push(row);
      continue;
    }
    if (!columns || !row.items.length) {
      result.push(row);
      continue;
    }
    const firstCells = rowCells(row, columns);
    let date = ordered(firstCells[0])
      .map((item) => item.text.trim())
      .join("");
    if (!dateText.test(date) && !partialDate.test(date)) {
      result.push(row);
      continue;
    }
    const block = [row];
    let last = index;
    for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex++) {
      const next = rows[nextIndex];
      if (!next.items.length || tableColumns(next)) break;
      const cells = rowCells(next, columns);
      const nextDate = ordered(cells[0])
        .map((item) => item.text.trim())
        .join("");
      if (nextDate) {
        if (!partialDate.test(date) || !dateText.test(date + nextDate)) break;
      }
      const height = Math.max(columns.height, ...next.items.map((item) => item.height));
      if (block[block.length - 1].y - next.y > height * 1.8) break;
      const text = normalizeMerchant(joinStatementFragments(next.items));
      if (
        /^(?:(?:(?:aylik|yillik) )?faiz|anapara|kkdf|bsmv|sayfa|page|toplam|total|bir sonraki|kart sahibi)\b/.test(
          text.replace(/^\(+\s*/, ""),
        )
      )
        break;
      block.push(next);
      last = nextIndex;
      date += nextDate;
    }
    // Leave ordinary one-line rows exactly as extracted, including their source
    // text. Reflow only actual continuations supported by the learned columns.
    if (block.length === 1) {
      result.push(row);
      continue;
    }
    const cells: StatementPdfFragment[][] = [[], [], [], []];
    for (const part of block)
      rowCells(part, columns).forEach((items, column) => cells[column].push(...items));
    let amount = moneyCell(cells[3]);
    if (amount && !amount.explicitCurrency && columns.currency) {
      // Both the monetary text and column currency have already been recognized.
      const declared = parseStatementAmount(`${amount.text} ${columns.currency}`)!;
      amount = { ...declared, explicitCurrency: true, text: `${amount.text} ${columns.currency}` };
    }
    const plan = ordered(cells[2])
      .map((item) => item.text.trim())
      .join("")
      .replace(/\s+/g, "");
    const merchant = block
      .map((part) => joinStatementFragments(rowCells(part, columns!)[1]))
      .filter(Boolean)
      .join(" ");
    const validPlan = !plan || /^\d{1,3}\/\d{1,3}$/.test(plan);
    if (dateText.test(date) && merchant && amount?.explicitCurrency && validPlan) {
      result.push({
        y: row.y,
        items: [],
        text: [date, merchant, plan, amount.text].filter(Boolean).join("\u2003"),
      });
      index = last;
    } else {
      // An extra amount without a date must remain visible for review. Do not
      // drop it or choose the number that happens to balance the statement.
      const hasExtraAmount = block.slice(1).some((part) => rowCells(part, columns!)[3].length > 0);
      if (hasExtraAmount) {
        result.push({
          y: row.y,
          items: [],
          text: block.map((part) => joinStatementFragments(part.items)).join("\n"),
          issue: true,
        });
        index = last;
      } else result.push(row);
    }
  }
  return result;
}

/** Geometry-only assembly: never infer monetary digits from balance differences. */
export function statementPageLines(
  items: readonly StatementPdfFragment[],
  page: number,
): StatementLine[] {
  const seen = new Set<string>();
  const sorted = items
    .filter((item) => {
      if (![item.x, item.y, item.width, item.height].every(Number.isFinite))
        throw new Error("statement_read_failed");
      // Identical text painted twice at the exact same position is one visible
      // fragment. Equal purchases on different rows must remain separate.
      const key = JSON.stringify([item.text, item.x, item.y, item.width, item.height]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PhysicalRow[] = [];
  for (const item of sorted) {
    const previous = rows[rows.length - 1];
    if (previous && Math.abs(previous.y - item.y) < 2.5) previous.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return transactionRows(labelledRows(summaryRows(rows))).flatMap((row) => {
    const text = row.text ?? joinStatementFragments(row.items.sort((a, b) => a.x - b.x));
    return text ? [{ page, text, ...(row.issue ? { layout_issue: true } : {}) }] : [];
  });
}
