import { financeMonths, type FinanceRow,financeRowsForYear, financeRowTag, isCardPaid, isFinanceCarryoverRow,
  isFinanceDeficitRow, salaryAnalysis, sumEntries } from "./finance";
import { appearance, paint, paintFont } from "./spreadsheetAppearance";
import type { SpreadsheetLabel } from "./spreadsheetExportLabels";
import { applyLedgerAppearance, applyLedgerPaymentColors } from "./spreadsheetLedgerAppearance";
import type { SpreadsheetWorkbook } from "./spreadsheetWorkbook";
import { cellRef, dateCell, dateValue, type ExcelValue,FIRST_ROW, formula, literal, money, moneyFormat, numeric,
  quoteSheet, roundedSum } from "./spreadsheetWorkbook";

export interface LedgerIndex {
  years: number[];
  months: string[];
  loanKeys: Map<string, string>;
  entryCount: number;
}
const loanName = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");

export function buildLedger(book: SpreadsheetWorkbook): LedgerIndex {
  const { finance: data, spending, today } = book.snapshot;
  const l = book.label;
  const rawRows = data.finance_rows;
  const rowMap = new Map(rawRows.map((row) => [row.id, row]));
  const loanNames = new Map((spending.loans || []).map((loan, index) => [loanName(loan.name), `loan-${index + 1}`]));
  const loanKeys = new Map(rawRows.filter((row) => !row.is_deleted && row.is_loan && row.expense_type !== "credit_card")
    .map((row) => [row.id, loanNames.get(loanName(row.name)) || ""]));
  const kindLabel = (row?: FinanceRow) => row ? l(row.kind === "salary" ? "salaryType" : row.kind) : "";
  const tagLabel = (row: FinanceRow) => {
    const tag = financeRowTag(row);
    return tag ? l(tag === "salary" ? "salaryType" : tag === "credit_card" ? "card" : tag as SpreadsheetLabel) : "";
  };
  book.table("rows", [l("rowId"), l("year"), l("name"), l("type"), l("rowTag"), l("cardName"), l("carry"),
    l("loanId"), l("notes"), l("archived"), l("originRow")], rawRows.map((row) => [
      row.id, row.year || null, isFinanceCarryoverRow(row) ? l("carry") : row.name, kindLabel(row), tagLabel(row),
      rowMap.get(row.payment_card || "")?.name || row.payment_card || "", isFinanceDeficitRow(row) ? l("yes") : l("no"),
      loanKeys.get(row.id) || "", row.notes, row.is_deleted ? l("yes") : l("no"), row.origin_row || "",
    ]), { widths: [23, 10, 32, 16, 26, 28, 18, 18, 48, 18] });
  const lookupRange = `${quoteSheet(book.name("rows"))}!$A$${FIRST_ROW}:$K$${Math.max(FIRST_ROW, FIRST_ROW + rawRows.length - 1)}`;
  const entries = [...data.finance_entries].sort((a, b) => a.date.localeCompare(b.date) || a.row_id.localeCompare(b.row_id) || a.id.localeCompare(b.id));
  const entryPositions = new Map(entries.map((entry, i) => [entry.id, FIRST_ROW + i]));
  const salaryRowsByYear = new Map<number, Set<string>>();
  const entryRows: ExcelValue[][] = entries.map((entry, index) => {
    const r = FIRST_ROW + index, row = rowMap.get(entry.row_id), income = row && row.kind !== "expense";
    // T preserves literal text (including "0") while turning Excel's blank
    // VLOOKUP result, numeric zero, back into an actual empty string.
    const lookup = (column: number) => `IFERROR(T(VLOOKUP(K${r},${lookupRange},${column},FALSE)),"")`;
    const eligible = row?.kind === "expense" && !isFinanceDeficitRow(row) && !isCardPaid(entry, row) ? entry.amount : 0;
    const status = income ? l(entry.status === "settled" ? "received" : "expected") : l(entry.status === "settled" ? "paid" : "pending");
    const card = row && isCardPaid(entry, row) ? l("cardPaid") : "";
    const paymentTag = entry.payment_tag === "credit_card" ? l("cardPaid") : entry.payment_tag === "direct" ? l("direct") :
      formula(`IF(AND(I${r}=${literal(l("expense"))},J${r}<>${literal(l("card"))},${lookup(6)}<>""),${literal(l("cardPaid"))},"")`, card);
    const entryYear = Number(entry.date.slice(0, 4));
    if (!salaryRowsByYear.has(entryYear)) salaryRowsByYear.set(entryYear,
      new Set(financeRowsForYear(rawRows, entryYear, data).filter((item) => item.kind === "salary").map((item) => item.id)));
    // An unassigned year is exported as blank text. Excel's "" = 0 is
    // false, so normalize it explicitly before checking legacy shared rows.
    const configuredYear = `IFERROR(N(VLOOKUP(K${r},${lookupRange},2,FALSE)),0)`;
    const noFork = `COUNTIFS(${book.range("rows", "K", rawRows.length)},K${r},${book.range("rows", "B", rawRows.length)},YEAR(F${r}))=0`;
    return [
      formula(lookup(3), row ? isFinanceCarryoverRow(row) ? l("carry") : row.name : ""),
      formula(`IF(F${r}="","",DATE(YEAR(F${r}),MONTH(F${r}),1))`, dateValue(entry.date.slice(0, 7)) ?? "", "mmmm yyyy"),
      money(entry.amount), status, paymentTag, dateCell(entry.date), dateCell(entry.settled_date), entry.notes,
      formula(lookup(4), kindLabel(row)), formula(lookup(5), row ? tagLabel(row) : ""), entry.row_id, entry.id,
      formula(`IF(AND(I${r}=${literal(l("expense"))},N${r}<>${literal(l("yes"))},OR(J${r}=${literal(l("card"))},E${r}<>${literal(l("cardPaid"))})),C${r},0)`, eligible, moneyFormat()),
      formula(lookup(7), row && isFinanceDeficitRow(row) ? l("yes") : l("no")),
      formula(`IF(AND(OR(I${r}=${literal(l("income"))},I${r}=${literal(l("salaryType"))}),D${r}=${literal(l("received"))}),C${r},0)`, income && entry.status === "settled" ? entry.amount : 0, moneyFormat()),
      formula(`IF(AND(OR(I${r}=${literal(l("income"))},I${r}=${literal(l("salaryType"))}),D${r}=${literal(l("expected"))}),C${r},0)`, income && entry.status === "planned" ? entry.amount : 0, moneyFormat()),
      formula(`IF(D${r}=${literal(l("paid"))},M${r},0)`, entry.status === "settled" ? eligible : 0, moneyFormat()),
      formula(`IF(D${r}=${literal(l("pending"))},M${r},0)`, entry.status === "planned" ? eligible : 0, moneyFormat()),
      formula(`IF(AND(J${r}=${literal(l("loan"))},T${r}<>${literal(l("yes"))}),${lookup(8)},"")`, loanKeys.get(entry.row_id) || ""),
      formula(lookup(10), row?.is_deleted ? l("yes") : l("no")),
      formula(`IF(AND(I${r}=${literal(l("salaryType"))},T${r}<>${literal(l("yes"))},OR(${configuredYear}=YEAR(F${r}),AND(${configuredYear}=0,${noFork}))),${literal(l("yes"))},${literal(l("no"))})`, salaryRowsByYear.get(entryYear)!.has(entry.row_id) ? l("yes") : l("no")),
      formula(`IF(ISNUMBER(C${r}),1,0)`, 1, "0"),
    ];
  });
  book.table("entries", [l("name"), l("month"), l("amount"), l("status"), l("paymentTag"), l("budgetDate"), l("paidDate"),
    l("notes"), l("type"), l("rowTag"), l("rowId"), l("id"), l("includedExpense"), l("carry"), l("receivedIncome"),
    l("expected"), l("paidExpense"), l("pendingExpense"), l("loanId"), l("archived"), l("salaryType"), l("valuePresent")], entryRows,
  { note: l("viewHelp"), widths: [32, 19, 19, 22, 27, 19, 21, 48, 16, 26, 23, 23], hidden: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] });

  const yearValues = [...rawRows.map((row) => row.year || 0), ...entries.map((entry) => Number(entry.date.slice(0, 4))),
    ...data.finance_benchmarks.map((reference) => Number(reference.month.slice(0, 4)))];
  const years = [...new Set(yearValues.filter((year) => Number.isInteger(year) && year >= 1970 && year <= 2200))].sort((a, b) => a - b);
  if (!years.length) years.push(Number(today.slice(0, 4)));
  const months = Array.from({ length: (years[years.length - 1] - years[0] + 1) * 12 }, (_, index) =>
    `${years[0] + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`);
  const monthCache = new Map(Array.from({ length: years[years.length - 1] - years[0] + 1 }, (_, index) => years[0] + index)
    .flatMap((year) => financeMonths(data, year)).map((month) => [month.month, month]));
  const range = (column: string) => book.range("entries", column, entries.length);
  const summaryRows = months.map((month, index): ExcelValue[] => {
    const r = FIRST_ROW + index, cached = monthCache.get(month)!;
    const sum = (column: string) => `ROUND(SUMIFS(${range(column)},${range("B")},$A${r}),2)`;
    const manual = `IF(A${r}=MIN(${range("B")}),ABS(SUMIFS(${range("C")},${range("B")},A${r},${range("N")},${literal(l("yes"))})),0)`;
    return [dateCell(month, true), formula(sum("O"), cached.received, moneyFormat()), formula(sum("P"), cached.expected, moneyFormat()),
      formula(sum("Q"), cached.paid, moneyFormat()), formula(sum("R"), cached.pending, moneyFormat()),
      formula(`MAX(0,${index ? `-G${r - 1},` : ""}${manual})`, cached.carryover, moneyFormat()),
      formula(`ROUND(B${r}-D${r}-F${r},2)`, cached.remaining, moneyFormat()),
      formula(`ROUND(G${r}+C${r}-E${r},2)`, cached.forecast, moneyFormat()),
      formula(`ROUND(D${r}+E${r}+F${r},2)`, roundedSum([cached.paid, cached.pending, cached.carryover]), moneyFormat()),
      formula(`ROUND(B${r}+C${r},2)`, roundedSum([cached.received, cached.expected]), moneyFormat())];
  });
  const monthlySheet = book.table("monthly", [l("month"), l("receivedIncome"), l("expected"), l("paidExpense"), l("pendingExpense"),
    l("carry"), l("cash"), l("forecast"), l("totalExpenses"), l("totalIncome")], summaryRows, { note: l("cardHelp") });
  // The rollforward is chronological; this calculated build is not a sortable
  // input table. Source entry and reference tables remain filterable.
  delete monthlySheet["!autofilter"];

  for (const year of years) {
    const yearMonths = Array.from({ length: 12 }, (_, month) => `${year}-${String(month + 1).padStart(2, "0")}`);
    const summaryValue = (column: string, monthColumn: string) =>
      `SUMIFS(${book.range("monthly", column, months.length)},${book.range("monthly", "A", months.length)},${monthColumn}$4)`;
    const grid: ExcelValue[][] = [];
    const metrics: [SpreadsheetLabel, string, (month: ReturnType<typeof financeMonths>[number]) => number][] = [
      ["receivedIncome", "B", (m) => m.received], ["paidExpense", "D", (m) => m.paid + m.carryover],
      ["cash", "G", (m) => m.remaining],
    ];
    for (const [label, column, value] of metrics) {
      const r = FIRST_ROW + grid.length;
      const amounts = yearMonths.map((month) => value(monthCache.get(month)!));
      grid.push([l(label), ...yearMonths.map((_month, i) => {
        const monthColumn = cellRef(1, i + 1).replace(/\d+$/, "");
        return formula(`${summaryValue(column, monthColumn)}${label === "paidExpense" ? `+${summaryValue("F", monthColumn)}` : ""}`, amounts[i], moneyFormat());
      }),
        formula(`ROUND(SUM(B${r}:M${r}),2)`, roundedSum(amounts), moneyFormat()),
        formula(`AVERAGE(B${r}:M${r})`, roundedSum(amounts) / 12, moneyFormat()), null, null]);
    }
    const visible = financeRowsForYear(rawRows, year, data);
    for (const kind of ["income", "expense"] as const) {
      grid.push([]);
      grid.push([l(kind === "income" ? "incomeSection" : "expenseSection")]);
      for (const row of visible.filter((item) => kind === "expense" ? item.kind === "expense" : item.kind !== "expense")) {
        const r = FIRST_ROW + grid.length;
        const lookup = (column: number) => `IFERROR(T(VLOOKUP(${literal(row.id)},${lookupRange},${column},FALSE)),"")`;
        const selected = entries.filter((entry) => entry.row_id === row.id && entry.date.startsWith(`${year}-`));
        const values = yearMonths.map((month) => {
          const records = selected.filter((entry) => entry.date.startsWith(month));
          return isFinanceCarryoverRow(row) ? monthCache.get(month)!.carryover : records.length ? sumEntries(records) : null;
        });
        grid.push([formula(lookup(3), isFinanceCarryoverRow(row) ? l("carry") : row.name),
          ...yearMonths.map((_month, index) => isFinanceCarryoverRow(row)
            ? formula(summaryValue("F", cellRef(1, index + 1).replace(/\d+$/, "")), values[index]!, moneyFormat())
            : formula(`IF(COUNTIFS(${range("K")},${literal(row.id)},${range("B")},${cellRef(4, index + 1)},${range("V")},1)=0,"",ROUND(SUMIFS(${range("C")},${range("K")},${literal(row.id)},${range("B")},${cellRef(4, index + 1)}),2))`, values[index] ?? "", moneyFormat())),
          formula(`IF(COUNT(B${r}:M${r})=0,"",ROUND(SUM(B${r}:M${r}),2))`, values.some((value) => value != null) ? roundedSum(values.filter((value): value is number => value != null)) : "", moneyFormat()),
          formula(`IF(COUNT(B${r}:M${r})=0,"",AVERAGE(B${r}:M${r}))`, values.some((value) => value != null)
            ? roundedSum(values.filter((value): value is number => value != null)) / values.filter((value) => value != null).length : "", moneyFormat()),
          formula(lookup(5), tagLabel(row)), formula(lookup(9), row.notes)]);
      }
    }
    const headers = [l("name"), ...yearMonths.map((month) => ({ t: "n" as const, v: dateValue(month)!, z: "mmm" })), l("yearTotal"), l("average"), l("rowTag"), l("notes")];
    const sheet = book.table("ledger", headers.map((header) => typeof header === "string" ? header : ""), grid,
      { name: String(year), note: l("cardHelp"), widths: [29, ...Array(12).fill(13), 18, 18, 26, 48], hidden: [15, 16] });
    yearMonths.forEach((month, index) => { sheet[cellRef(4, index + 1)] = { t: "n", v: dateValue(month)!, z: book.monthFormat() }; });
    sheet.A4 = { t: "s", v: l("overview") };
    sheet["!merges"] = [1, 2].map((r) => ({ s: { r: r - 1, c: 0 }, e: { r: r - 1, c: 14 } }));
    const meta = appearance(sheet);
    meta.zoom = 80;
    meta.tab = "D9FF65";
    paint(sheet, "A5:O7", "total");
    paint(sheet, `A5:A${grid.length + 4}`, "label");
    const sourceSheet = book.workbook.Sheets[book.name("entries")];
    const paymentRows: { row: FinanceRow; sheetRow: number }[] = [];
    for (let i = 0; i < grid.length; i++) {
      const r = FIRST_ROW + i;
      if (grid[i][0] === l("incomeSection") || grid[i][0] === l("expenseSection")) {
        const income = grid[i][0] === l("incomeSection");
        paint(sheet, `A${r}:O${r}`, income ? "income" : "expense");
        yearMonths.forEach((month, j) => { sheet[cellRef(r, j + 1)] = { t: "n", v: dateValue(month)!, z: book.monthFormat() }; });
        sheet[`N${r}`] = { t: "s", v: l("yearTotal") };
        sheet[`O${r}`] = { t: "s", v: l("average") };
      }
      const nameCell = sheet[`A${r}`];
      if (!nameCell?.f) continue;
      const row = visible.find((item) => nameCell.f?.includes(literal(item.id)));
      if (!row || isFinanceCarryoverRow(row)) continue;
      if (!isFinanceDeficitRow(row)) paymentRows.push({ row, sheetRow: r });
      yearMonths.forEach((month, column) => {
        const matching = entries.filter((entry) => entry.row_id === row.id && entry.date.startsWith(month));
        const address = cellRef(r, column + 1), cell = sheet[address];
        if (matching.length === 1) {
          // The visible annual table is the editable amount input. Calculations
          // read it through the detail row, without a circular SUMIFS reference.
          delete cell.f;
          const sourceRow = entryPositions.get(matching[0].id)!;
          sourceSheet[`C${sourceRow}`] = formula(`IF(ISNUMBER(${quoteSheet(String(year))}!${address}),${quoteSheet(String(year))}!${address},"")`, matching[0].amount, moneyFormat());
        }
      });
    }
    sheet["!ref"] = `A1:Q${grid.length + 4}`;
    applyLedgerAppearance(sheet, book);
    applyLedgerPaymentColors(sheet, book, year, paymentRows, entries);
    delete sheet["!autofilter"];
  }
  return { years, months, loanKeys, entryCount: entries.length };
}

export function buildSalary(book: SpreadsheetWorkbook, index: LedgerIndex) {
  const l = book.label, data = book.snapshot.finance;
  const references = new Map(data.finance_benchmarks.map((reference) => [reference.month, reference]));
  if (references.size !== data.finance_benchmarks.length) throw new Error("spreadsheet_conflicting_references");
  const rateSheet = book.table("references", [l("month"), l("usd"), l("eur"), l("minimum"), l("rateDate"), l("source"), l("id")],
    index.months.map((month) => {
      const reference = references.get(month);
      return [dateCell(month, true), numeric(reference?.usd || null, "0.0000"), numeric(reference?.eur || null, "0.0000"),
        money(reference?.minimum_wage || null), dateCell(reference?.rate_date), reference?.source || "", reference?.id || ""];
    }), { widths: [19, 18, 18, 21, 18, 48, 23], hidden: [6] });
  // Remove the title/help content without shifting rate addresses used by formulas.
  delete rateSheet.A1;
  delete rateSheet.A2;
  rateSheet["!merges"] = [];
  for (let i = 0; i < 3; i++) rateSheet["!rows"]![i] = { hidden: true };
  paintFont(rateSheet, `B${FIRST_ROW}:D${FIRST_ROW + index.months.length - 1}`, "ledgerReceived");
  const cache = new Map(index.years.flatMap((year) => salaryAnalysis(data, year)).map((month) => [month.month, month]));
  const range = (column: string) => book.range("entries", column, index.entryCount);
  const referenceMonths = book.range("references", "A", index.months.length);
  book.table("salary", [l("month"), l("salaryType"), l("receivedIncome"), l("status"), l("usdValue"), l("eurValue"),
    l("multiplier"), l("salaryTag"), l("usd"), l("eur"), l("minimum"), l("firstSalary"), l("lastSalary")], index.months.map((month, position) => {
      const r = FIRST_ROW + position, value = cache.get(month);
      const firstRow = FIRST_ROW + position - Number(month.slice(5, 7)) + 1;
      const recordedMonths = [...cache.values()].filter((item) => item.month.startsWith(month.slice(0, 4)) && item.salary != null);
      const salaryTag = references.get(month)?.salary_tag;
      const criteria = `${range("B")},A${r},${range("U")},${literal(l("yes"))},${range("V")},1`;
      const count = `COUNTIFS(${criteria})`;
      return [dateCell(month, true),
        formula(`IF(${count}=0,"",ROUND(SUMIFS(${range("C")},${criteria}),2))`, value?.salary ?? "", moneyFormat()),
        formula(`IF(B${r}="","",ROUND(SUMIFS(${range("O")},${criteria}),2))`, value?.salary == null ? "" : value.received, moneyFormat()),
        formula(`IF(${count}=0,"",IF(COUNTIFS(${criteria},${range("D")},${literal(l("received"))})=${count},${literal(l("received"))},IF(COUNTIFS(${criteria},${range("D")},${literal(l("expected"))})=${count},${literal(l("expected"))},${literal(l("partialIncome"))})))`,
          value?.status ? l(value.status === "settled" ? "received" : value.status === "planned" ? "expected" : "partialIncome") : ""),
        formula(`IF(OR(B${r}="",I${r}="",I${r}<=0),"",B${r}/I${r})`, value?.usd ?? "", moneyFormat("USD")),
        formula(`IF(OR(B${r}="",J${r}="",J${r}<=0),"",B${r}/J${r})`, value?.eur ?? "", moneyFormat("EUR")),
        formula(`IF(OR(B${r}="",K${r}="",K${r}<=0),"",B${r}/K${r})`, value?.minimum ?? "", '"x"0.00'),
        salaryTag ? l(salaryTag) : "",
        ...(["B", "C", "D"] as const).map((column, idx) => {
          const ref = references.get(month), number = idx === 0 ? ref?.usd : idx === 1 ? ref?.eur : ref?.minimum_wage;
          const sum = `SUMIFS(${book.range("references", column, index.months.length)},${referenceMonths},A${r})`;
          return formula(`IF(OR(COUNTIFS(${referenceMonths},A${r})<>1,${sum}<=0),"",${sum})`, number || "", idx === 2 ? moneyFormat() : "0.0000");
        }),
        formula(`IF(AND(ISNUMBER(B${r}),COUNT(B${firstRow}:B${r})=1),A${r},0)`, recordedMonths[0]?.month === month ? dateValue(month)! : 0),
        formula(`IF(AND(ISNUMBER(B${r}),COUNT(B${r}:B${firstRow + 11})=1),A${r},0)`, recordedMonths[recordedMonths.length - 1]?.month === month ? dateValue(month)! : 0)];
    }), { note: l("ratesHelp"), widths: [19, 22, 22, 24, 21, 21, 22, 34, 18, 18, 22], hidden: [11, 12] });
  const salarySheet = book.workbook.Sheets[book.name("salary")];
  // First/last-period helpers rely on chronological order in this calculated view.
  delete salarySheet["!autofilter"];
  book.table("salaryYearly", [l("year"), l("start"), l("end"), l("firstSalary"), l("lastSalary"), l("salaryChange"), l("changeRate")],
    index.years.map((year, position) => {
      const r = FIRST_ROW + position, start = FIRST_ROW + index.months.indexOf(`${year}-01`), end = start + 11;
      const annual = (column: string) => `${quoteSheet(book.name("salary"))}!${column}${start}:${column}${end}`;
      const recorded = [...cache.values()].filter((month) => month.month.startsWith(`${year}-`) && month.salary != null);
      const first = recorded[0], last = recorded[recorded.length - 1];
      const monthValue = (column: string, month: string | undefined) => formula(`IF(COUNT(${annual("B")})=0,"",SUM(${annual(column)}))`, month ? dateValue(month)! : "", "mmmm yyyy");
      const salaryValue = (column: string, value: number | null | undefined) => formula(`IF(${column}${r}="","",SUMIFS(${book.range("salary", "B", index.months.length)},${book.range("salary", "A", index.months.length)},${column}${r}))`, value ?? "", moneyFormat());
      return [year, monthValue("L", first?.month), monthValue("M", last?.month), salaryValue("B", first?.salary), salaryValue("C", last?.salary),
        formula(`IF(OR(D${r}="",E${r}=""),"",ROUND(E${r}-D${r},2))`, first && last ? roundedSum([last.salary!, -first.salary!]) : "", moneyFormat()),
        formula(`IF(OR(D${r}="",E${r}="",D${r}<=0),"",E${r}/D${r}-1)`, first && last && first.salary! > 0 ? last.salary! / first.salary! - 1 : "", "0.0%")];
    }), { widths: [12, 22, 22, 24, 24, 24, 20] });
}
