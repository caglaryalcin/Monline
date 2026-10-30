import type { CellObject, WorkSheet } from "xlsx";

import { salaryAnalysis, type SalaryTag } from "./finance";
import { isBillRecord } from "./spending";
import {
  appearance,
  merge,
  outlineRange,
  paint,
  paintFont,
  put,
  type SheetTone,
} from "./spreadsheetAppearance";
import type { SpreadsheetLabel } from "./spreadsheetExportLabels";
import type { LedgerIndex } from "./spreadsheetLedger";
import type { SpreadsheetWorkbook } from "./spreadsheetWorkbook";
import {
  cellRef,
  FIRST_ROW,
  formula,
  linkedCell,
  literal,
  quoteSheet,
} from "./spreadsheetWorkbook";

/** Reader views follow the same layouts as the application; source sheets stay
 * separate so presentation never changes the meaning of the financial data. */
const SALARY_TAG_TONES: Record<SalaryTag, SheetTone> = {
  raise: "tagGreen",
  job_change: "tagSky",
  seniority_raise: "tagAmber",
  seniority_inflation_raise: "tagViolet",
};

export function buildReaderViews(book: SpreadsheetWorkbook, index: LedgerIndex) {
  const l = book.label,
    visible: string[] = [];
  const canvas = (key: SpreadsheetLabel, name: string, columns: number, widths?: number[]) => {
    const sheet = book.table(key, Array(columns).fill(""), [], {
      name,
      widths: widths || Array(columns).fill(15),
    });
    delete sheet["!autofilter"];
    sheet["!merges"] = [];
    sheet["!rows"] = [];
    paint(sheet, `A1:${cellRef(5, columns - 1)}`, "body");
    appearance(sheet).freeze = { row: 0, column: 0 };
    const finish = (lastRow: number) => {
      sheet["!ref"] = `A1:${cellRef(lastRow, columns - 1)}`;
      paintMissing(sheet, lastRow, columns);
      visible.push(name);
    };
    return { sheet, finish };
  };
  const sourceCell = (key: SpreadsheetLabel, address: string) =>
    book.workbook.Sheets[book.name(key)][address] as CellObject | undefined;
  const link = (key: SpreadsheetLabel, address: string, decimals?: number): CellObject =>
    linkedCell(book.name(key), address, sourceCell(key, address), decimals);
  const title = (
    sheet: WorkSheet,
    row: number,
    from: number,
    to: number,
    text: string,
    tone: SheetTone = "section",
  ) => {
    paint(sheet, `${cellRef(row, from)}:${cellRef(row, to)}`, tone);
    put(sheet, row, from, text, tone);
    merge(sheet, row, from, to);
    (sheet["!rows"] ||= [])[row - 1] = { hpt: tone === "title" ? 35 : 28 };
  };
  const cache = new Map(
    index.years
      .flatMap((year) => salaryAnalysis(book.snapshot.finance, year))
      .map((value) => [value.month, value]),
  );
  const salaryRows = new Map(index.months.map((month, i) => [month, FIRST_ROW + i]));
  const salaryYears = index.years.filter(
    (year) =>
      year <= Number(book.snapshot.today.slice(0, 4)) &&
      [...cache.values()].some(
        (value) => value.month.startsWith(`${year}-`) && value.salary != null,
      ),
  );

  if (salaryYears.length) {
    const columns = 1 + salaryYears.length * 4;
    const numberFormat = new Intl.NumberFormat(book.language.replace(/_/g, "-"), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const widths = [
      9.5,
      ...salaryYears.flatMap((year) =>
        ["salary", "usd", "eur", "minimum"].map((field, fieldIndex) => {
          let width = [10.5, 9, 9, 6.5][fieldIndex];
          for (const value of cache.values()) {
            if (!value.month.startsWith(`${year}-`)) continue;
            const amount = value[field as "salary" | "usd" | "eur" | "minimum"];
            if (amount == null) continue;
            const text =
              fieldIndex === 3
                ? `x${amount.toFixed(2)}`
                : `${numberFormat.format(amount)}${["₺", "$", "€"][fieldIndex]}`;
            width = Math.max(
              width,
              text.length * (value.reference?.salary_tag ? 12 / 10 : 1) + 1.5,
            );
          }
          return Math.ceil(width * 10) / 10;
        }),
      ),
    ];
    const { sheet, finish } = canvas("salaryView", l("salaryView"), columns, widths);
    appearance(sheet).blankTone = "canvas";
    appearance(sheet).clearBorders = true;
    appearance(sheet).fontSizes = {
      canvas: 10,
      body: 10,
      label: 10,
      ledgerReceived: 10,
      tagGreen: 12,
      tagSky: 12,
      tagAmber: 12,
      tagViolet: 12,
    };
    const salaryAlignment = (appearance(sheet).horizontal ||= {});
    // Begin directly with year/month headers, without a repeated title banner.
    put(sheet, 1, 0, "");
    (sheet["!rows"] ||= [])[0] = { hidden: true };
    sheet["!rows"]![1] = { hidden: true };
    put(sheet, 4, 0, l("month"), "salaryHeader");
    salaryYears.forEach((year, i) => {
      title(sheet, 3, 1 + i * 4, 4 + i * 4, String(year), "salaryYear");
      salaryAlignment[cellRef(3, 1 + i * 4)] = "center";
      const headingColors = [
        "ledgerReceived",
        "ledgerReceived",
        "ledgerReceived",
        "ledgerReceived",
      ] as const;
      ["salaryType", "usdValue", "eurValue", "multiplier"].forEach((field, j) => {
        const address = put(
          sheet,
          4,
          1 + i * 4 + j,
          l(field as SpreadsheetLabel).replace(/ /g, "\n"),
          "salaryHeader",
        );
        paintFont(sheet, address, headingColors[j]);
        salaryAlignment[address] = "center";
      });
      for (let month = 1; month <= 12; month++) {
        const period = `${year}-${String(month).padStart(2, "0")}`,
          row = salaryRows.get(period)!;
        const monthName = new Intl.DateTimeFormat(book.language.replace(/_/g, "-"), {
          month: "long",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(2000, month - 1, 1)));
        put(sheet, month + 4, 0, monthName, "label");
        ["B", "E", "F", "G"].forEach((column, j) => {
          const tag = cache.get(period)?.reference?.salary_tag;
          const source = `${quoteSheet(book.name("salary"))}!${column}${row}`;
          const value = link("salary", `${column}${row}`, 2);
          const currency = ["₺", "$", "€"][j];
          const formatted =
            j === 3
              ? `${literal("x")}&FIXED(ROUND(${source},2),2,TRUE)`
              : `FIXED(ROUND(${source},2),2,FALSE)&${literal(currency)}`;
          const text =
            typeof value.v === "number"
              ? j === 3
                ? `x${numberFormat.format(value.v)}`
                : `${numberFormat.format(value.v)}${currency}`
              : "";
          const address = put(
            sheet,
            month + 4,
            1 + i * 4 + j,
            formula(`IF(ISNUMBER(${source}),${formatted},"")`, text),
            tag ? SALARY_TAG_TONES[tag] : j === 0 ? "ledgerReceived" : "body",
          );
          salaryAlignment[address] = "right";
        });
      }
    });
    appearance(sheet).freeze = { row: 4, column: 1 };
    appearance(sheet).zoom = 80;
    (sheet["!rows"] ||= [])[3] = { hpt: 42 };
    const legendWidth = Math.min(columns - 1, 16),
      legendRow = 18;
    const legend: [SpreadsheetLabel, SheetTone][] = [
      ["job_change", "tagSky"],
      ["raise", "tagGreen"],
      ["salaryLegendSeniority", "tagAmber"],
      ["salaryLegendInflation", "tagViolet"],
    ];
    const meta = appearance(sheet);
    meta.outlined = [];
    let legendHeight = 32;
    legend.forEach(([label, tone], i) => {
      const from = 1 + Math.floor((i * legendWidth) / legend.length),
        to = Math.floor(((i + 1) * legendWidth) / legend.length);
      title(sheet, legendRow, from, to, l(label), tone);
      paintFont(sheet, `${cellRef(legendRow, from)}:${cellRef(legendRow, to)}`, tone);
      for (let c = from; c <= to; c++) meta.outlined!.push(cellRef(legendRow, c));
      salaryAlignment[cellRef(legendRow, from)] = "center";
      const availableWidth = widths.slice(from, to + 1).reduce((sum, width) => sum + width, 0);
      legendHeight = Math.max(
        legendHeight,
        Math.ceil(l(label).length / Math.max(1, availableWidth)) * 16 + 8,
      );
    });
    sheet["!rows"]![legendRow - 1] = { hpt: legendHeight };
    finish(legendRow + 1);
  }

  // Charts remain native Excel charts, backed by numeric formulas rather than
  // screenshots, and update when the exported salary inputs or rates change.
  const published = index.months.filter((month) => month <= book.snapshot.today.slice(0, 7));
  const first = published.findIndex((month) => cache.get(month)?.salary != null);
  const last = published.reduce(
    (result, month, i) => (cache.get(month)?.salary != null ? i : result),
    -1,
  );
  if (first >= 0) {
    const points = published.slice(first, last + 1),
      name = l("salaryCharts");
    const { sheet, finish } = canvas("salaryCharts", name, 13);
    title(sheet, 1, 0, 12, name, "title");
    const start = 96;
    // Some importers ignore plotVisOnly=0 and drop charts with hidden data.
    // Keep their numeric source table visible below the four graphs.
    title(sheet, start - 2, 0, 6, l("salaryView"));
    ["month", "salaryType", "usdValue", "eurValue", "minimum", "multiplier", "year"].forEach(
      (key, column) => put(sheet, start - 1, column, l(key as SpreadsheetLabel), "header"),
    );
    points.forEach((month, i) => {
      const source = salaryRows.get(month)!,
        r = start + i;
      put(sheet, r, 0, month);
      ["B", "E", "F", "K", "G"].forEach((column, j) =>
        put(sheet, r, j + 1, link("salary", `${column}${source}`)),
      );
      // Keep every monthly data point, but label only the first point of
      // each year. Literal year text also survives readers ignoring numFmt.
      put(
        sheet,
        r,
        6,
        formula(
          `IF(LEFT(A${r},4)=LEFT(A${r - 1},4),"",LEFT(A${r},4))`,
          i === 0 || month.slice(0, 4) !== points[i - 1].slice(0, 4) ? month.slice(0, 4) : "",
        ),
      );
    });
    const categoryRange = `${quoteSheet(name)}!$G$${start}:$G$${start + points.length - 1}`;
    const series = (key: string, column: string, color: string) => ({
      name: l(key as SpreadsheetLabel),
      color,
      nameRange: `${quoteSheet(name)}!$${column}$${start - 1}`,
      range: `${quoteSheet(name)}!$${column}$${start}:$${column}$${start + points.length - 1}`,
      format: sheet[`${column}${start}`]?.z as string | undefined,
      values: points.map((_month, i) => {
        const value = sheet[`${column}${start + i}`]?.v;
        return typeof value === "number" ? value : null;
      }),
    });
    const salary = series("salaryType", "B", "FACC15"),
      usd = series("usdValue", "C", "38BDF8"),
      eur = series("eurValue", "D", "FB7185"),
      minimum = series("minimum", "E", "A78BFA");
    [
      { title: l("salaryWithCurrency"), series: [salary, eur, usd] },
      { title: l("salaryCurrency"), series: [eur, usd] },
      { title: l("salaryMinimum"), series: [minimum, salary] },
      { title: l("multiplier"), series: [series("multiplier", "F", "F59E0B")], multiple: true },
    ].forEach((chart, i) => {
      title(sheet, 3 + i * 22, 0, 12, chart.title);
      appearance(sheet).charts.push({
        ...chart,
        categories: categoryRange,
        labels: points,
        axisLabels: points.map((_month, i) => String(sheet[`G${start + i}`].v)),
        markers: points.map(
          (month) =>
            (
              ({
                job_change: "7DD3FC",
                raise: "6EE7B7",
                seniority_raise: "FCD34D",
                seniority_inflation_raise: "C4B5FD",
              }) as Record<string, string>
            )[cache.get(month)?.reference?.salary_tag || ""] || null,
        ),
        row: 3 + i * 22,
        column: 0,
        width: 1080,
        height: 380,
      });
    });
    finish(start + points.length - 1);
  }

  const loans = book.snapshot.spending.loans || [];
  const { sheet: loanSheet, finish: finishLoans } = canvas(
    "loanView",
    l("loanView"),
    7,
    [27, 23, 23, 4, 27, 23, 23],
  );
  let next = 1;
  for (const completed of [false, true]) {
    const group = loans
      .map((loan, i) => ({ loan, i }))
      .filter(
        ({ loan }) =>
          (loan.remaining_installments === 0 && loan.total_installments > 0) === completed,
      );
    if (!group.length) continue;
    if (completed) {
      title(loanSheet, next, 0, 6, l("completed"));
      next += 2;
    }
    const perRow = 2;
    for (let n = 0; n < group.length; n += perRow) {
      let height = 0;
      const cards = group.slice(n, n + perRow);
      for (const [position, { loan, i }] of cards.entries()) {
        const c = position * 4,
          sourceRow = FIRST_ROW + i,
          top = next;
        title(loanSheet, top, c, c + 2, loan.name, completed ? "finished" : "section");
        put(
          loanSheet,
          top + 1,
          c,
          formula(
            `${quoteSheet(book.name("loans"))}!E${sourceRow}&${literal(` ${l("month")} / `)}&${quoteSheet(book.name("loans"))}!G${sourceRow}&${literal(` ${l("month")}`)}`,
            `${loan.total_installments} ${l("month")} / ${loan.remaining_installments} ${l("month")}`,
          ),
          "total",
        );
        put(
          loanSheet,
          top + 1,
          c + 2,
          completed ? l("paid") : l("ongoing"),
          completed ? "finished" : "paidOlive",
        );
        const monthName = (month?: string | null) =>
          month
            ? new Intl.DateTimeFormat(book.language.replace("_", "-"), {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(`${month}-01T12:00:00Z`))
            : "—";
        title(
          loanSheet,
          top + 2,
          c,
          c + 2,
          `${monthName(loan.start_month)} / ${monthName(loan.end_month)}`,
          "muted",
        );
        ["month", "amount", "status"].forEach((key, j) =>
          paintFont(
            loanSheet,
            put(loanSheet, top + 4, c + j, l(key as SpreadsheetLabel), "header"),
            "paidOlive",
          ),
        );
        const detailSheet = book.workbook.Sheets[book.name("loanPayments")];
        const detailRows = Object.keys(detailSheet)
          .filter(
            (address) =>
              /^A\d+$/.test(address) && detailSheet[address].v === index.loanKeys.get(loan.row_id),
          )
          .map((address) => Number(address.slice(1)));
        detailRows.forEach((r, j) => {
          const target = top + 5 + j;
          put(
            loanSheet,
            target,
            c,
            link("loanPayments", `C${r}`),
            completed ? "finished" : "label",
          );
          const amount = put(
            loanSheet,
            target,
            c + 1,
            link("loanPayments", `D${r}`),
            completed ? "finished" : "body",
          );
          const status = put(
            loanSheet,
            target,
            c + 2,
            link("loanPayments", `G${r}`),
            completed ? "finished" : "body",
          );
          for (const [key, tone] of [
            ["paid", "paidOlive"],
            ["pending", "pending"],
            ["partial", "partial"],
          ] as const) {
            const range = completed ? amount : `${amount}:${status}`;
            appearance(loanSheet).rules.push({
              range,
              formula: `$${status}=${literal(l(key))}`,
              tone,
            });
            if (detailSheet[`G${r}`]?.v === l(key)) paintFont(loanSheet, range, tone);
          }
        });
        const foot = top + 6 + detailRows.length;
        paint(
          loanSheet,
          `${cellRef(foot, c)}:${cellRef(foot + 2, c + 2)}`,
          completed ? "finished" : "total",
        );
        put(loanSheet, foot, c, l("total"), "total");
        const totalAddress = put(
          loanSheet,
          foot,
          c + 1,
          link("loans", `H${sourceRow}`),
          completed ? "finished" : "total",
        );
        if (completed) paintFont(loanSheet, totalAddress, "paidOlive");
        const paidLabel = put(loanSheet, foot + 1, c, l("paidAmount"), "total");
        const paidAddress = put(
          loanSheet,
          foot + 1,
          c + 1,
          link("loans", `I${sourceRow}`),
          "total",
        );
        paintFont(loanSheet, paidAddress, "paidOlive");
        const remainingLabel = put(loanSheet, foot + 2, c, l("loanRemaining"), "total");
        const remainingAddress = put(
          loanSheet,
          foot + 2,
          c + 1,
          link("loans", `J${sourceRow}`),
          "total",
        );
        paintFont(loanSheet, remainingAddress, completed ? "finished" : "pending");
        if (completed) {
          paintFont(loanSheet, paidLabel, "finished");
          paintFont(loanSheet, remainingLabel, "finished");
        }
        height = Math.max(height, 9 + detailRows.length);
      }
      for (let position = 0; position < cards.length; position++)
        outlineRange(
          loanSheet,
          `${cellRef(next, position * 4)}:${cellRef(next + height - 1, position * 4 + 2)}`,
        );
      next += height + 2;
    }
  }
  title(loanSheet, next, 0, 6, l("loanYearly"));
  next += 2;
  const yearlyColumns = [0, 1, 2, 4, 5, 6];
  ["year", "name", "paidCount", "paidAmount", "remainingCount", "loanRemaining"].forEach((key, i) =>
    paintFont(
      loanSheet,
      put(loanSheet, next, yearlyColumns[i], l(key as SpreadsheetLabel), "header"),
      "paidOlive",
    ),
  );
  (loanSheet["!rows"] ||= [])[next - 1] = { hpt: 38 };
  const yearSheet = book.workbook.Sheets[book.name("loanYearly")];
  const yearlyRows = Object.keys(yearSheet).filter(
    (address) =>
      /^A\d+$/.test(address) &&
      Number(address.slice(1)) >= FIRST_ROW &&
      typeof yearSheet[address].v === "number",
  ).length;
  for (let i = 0; i < yearlyRows; i++)
    ["A", "B", "E", "H", "F", "I"].forEach((column, j) =>
      put(
        loanSheet,
        next + 1 + i,
        yearlyColumns[j],
        link("loanYearly", `${column}${FIRST_ROW + i}`),
        j === 3 ? "paidOlive" : j === 5 ? "pending" : "body",
      ),
    );
  finishLoans(next + yearlyRows + 2);

  // Bills use four separate columns, following the source's newest-first order.
  // Subscriptions keep their existing card layout.
  for (const [sourceKey, viewKey] of [
    ["subscriptions", "subscriptionView"],
    ["bills", "billView"],
  ] as const) {
    const source = book.workbook.Sheets[book.name(sourceKey)];
    const count =
      sourceKey === "subscriptions"
        ? (book.snapshot.collections.subscriptions || []).length
        : book.snapshot.spending.events.filter(isBillRecord).length;
    if (!count) continue;
    if (sourceKey === "bills") {
      const { sheet, finish } = canvas(viewKey, l(viewKey), 4, [34, 16, 24, 22]);
      const meta = appearance(sheet),
        alignment = (meta.horizontal ||= {});
      for (let i = 0; i < count; i++) {
        const sourceRow = FIRST_ROW + i,
          targetRow = i + 1;
        const paid = source[`E${sourceRow}`]?.v === l("paid");
        const date = link(sourceKey, `B${sourceRow}`);
        date.z = "dd.mm.yyyy";
        const nameAddress = put(sheet, targetRow, 0, link(sourceKey, `A${sourceRow}`));
        const dateAddress = put(sheet, targetRow, 1, date);
        const statusAddress = put(
          sheet,
          targetRow,
          2,
          link(sourceKey, `E${sourceRow}`),
          paid ? "billPaid" : "billStatus",
        );
        const amountAddress = put(sheet, targetRow, 3, link(sourceKey, `C${sourceRow}`));
        for (const address of [nameAddress, dateAddress, statusAddress, amountAddress])
          alignment[address] = "right";
        meta.rules.push({
          range: statusAddress,
          formula: `${statusAddress}=${literal(l("paid"))}`,
          tone: "billPaid",
        });
        meta.rules.push({
          range: statusAddress,
          formula: `${statusAddress}<>${literal(l("paid"))}`,
          tone: "billStatus",
        });
        (sheet["!rows"] ||= [])[targetRow - 1] = {
          hpt: Math.max(
            24,
            Math.ceil(String(source[`A${sourceRow}`]?.v || "").length / 34) * 15 + 6,
          ),
        };
      }
      finish(count);
      continue;
    }
    const { sheet, finish } = canvas(viewKey, l(viewKey), 3, [62, 4, 62]);
    for (let i = 0; i < count; i++) {
      const row = FIRST_ROW + i,
        top = 1 + Math.floor(i / 2) * 3,
        c = (i % 2) * 2;
      const nameColumn = "B",
        amountColumn = "C",
        dateColumn = "G",
        statusColumn = "J";
      const reference = quoteSheet(book.name(sourceKey));
      const nameRef = `${reference}!${nameColumn}${row}`,
        dateRef = `${reference}!${dateColumn}${row}`,
        statusRef = `${reference}!${statusColumn}${row}`;
      const date = source[`${dateColumn}${row}`]?.v;
      const dateText =
        typeof date === "number"
          ? new Intl.DateTimeFormat("tr-TR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(Date.UTC(1899, 11, 30) + date * 86400000))
          : "";
      const savedStatus = String(source[`${statusColumn}${row}`]?.v || "");
      const caption = [String(source[`${nameColumn}${row}`]?.v || ""), dateText, savedStatus]
        .filter(Boolean)
        .join(" · ");
      const dateFormula = `RIGHT("0"&DAY(${dateRef}),2)&"."&RIGHT("0"&MONTH(${dateRef}),2)&"."&YEAR(${dateRef})`;
      const header = put(
        sheet,
        top,
        c,
        formula(
          `IF(${nameRef}="","",${nameRef}&IF(ISNUMBER(${dateRef}),${literal(" · ")}&${dateFormula},"")&IF(${statusRef}="","",${literal(" · ")}&${statusRef}))`,
          caption,
        ),
        "section",
      );
      (sheet["!rows"] ||= [])[top - 1] = {
        hpt: Math.max(
          sheet["!rows"]?.[top - 1]?.hpt || 0,
          28,
          Math.ceil(caption.length / 57) * 16 + 6,
        ),
      };
      const amount = put(sheet, top + 1, c, link(sourceKey, `${amountColumn}${row}`), "total");
      paintFont(sheet, amount, "ledgerReceived");
      const statusIs = (key: SpreadsheetLabel) =>
        `RIGHT(${header},LEN(${literal(l(key))}))=${literal(l(key))}`;
      appearance(sheet).rules.push({ range: header, formula: statusIs("active"), tone: "paid" });
      appearance(sheet).rules.push({
        range: header,
        formula: statusIs("inactive"),
        tone: "finished",
      });
      if (savedStatus === l("active")) paintFont(sheet, header, "paid");
      if (savedStatus === l("inactive")) paintFont(sheet, header, "finished");
      outlineRange(sheet, `${header}:${amount}`);
    }
    finish(Math.ceil(count / 2) * 3);
  }
  return visible;
}

function paintMissing(sheet: WorkSheet, rows: number, columns: number) {
  for (let r = 1; r <= rows; r++)
    for (let c = 0; c < columns; c++) {
      const address = cellRef(r, c);
      if (!sheet[address]) put(sheet, r, c, "");
    }
}
