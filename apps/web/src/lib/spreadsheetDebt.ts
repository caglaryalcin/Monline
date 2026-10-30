import type { LedgerIndex } from "./spreadsheetLedger";
import type { SpreadsheetWorkbook } from "./spreadsheetWorkbook";
import {
  dateCell,
  type ExcelValue,
  FIRST_ROW,
  formula,
  literal,
  moneyFormat,
  quoteSheet,
  roundedSum,
} from "./spreadsheetWorkbook";

export function buildLoans(book: SpreadsheetWorkbook, index: LedgerIndex) {
  const l = book.label,
    loans = book.snapshot.spending.loans || [];
  const entries = book.snapshot.finance.finance_entries;
  const rowRange = `${quoteSheet(book.name("rows"))}!$A$${FIRST_ROW}:$K$${Math.max(FIRST_ROW, FIRST_ROW + book.snapshot.finance.finance_rows.length - 1)}`;
  const rowName = (rowId: string) =>
    `IFERROR(T(VLOOKUP(${literal(rowId)},${rowRange},3,FALSE)),"")`;
  const source = (column: string) => book.range("entries", column, index.entryCount);
  const details: {
    key: string;
    loan: (typeof loans)[number];
    month: string;
    amount: number;
    paid: number;
    remaining: number;
    status: string;
  }[] = [];
  for (const loan of loans) {
    const key = index.loanKeys.get(loan.row_id) || "";
    const months = [
      ...new Set([
        ...loan.months.map((month) => month.month),
        ...entries
          .filter((entry) => key && index.loanKeys.get(entry.row_id) === key)
          .map((entry) => entry.date.slice(0, 7)),
      ]),
    ].sort();
    for (const month of months) {
      const cached = loan.months.find((item) => item.month === month);
      details.push({
        key,
        loan,
        month,
        amount: cached?.amount || 0,
        paid: cached?.paid_amount || 0,
        remaining: cached?.remaining_amount || 0,
        status: cached?.status || "",
      });
    }
  }
  book.table(
    "loanPayments",
    [
      l("loanId"),
      l("name"),
      l("month"),
      l("amount"),
      l("paidAmount"),
      l("loanRemaining"),
      l("status"),
    ],
    details.map((item, position) => {
      const r = FIRST_ROW + position;
      const criteria = `${source("S")},A${r},${source("B")},C${r}`;
      return [
        item.key,
        formula(rowName(item.loan.row_id), item.loan.name),
        dateCell(item.month, true),
        formula(
          `ROUND(SUMIFS(${source("C")},${criteria}),2)`,
          item.amount,
          moneyFormat(item.loan.currency),
        ),
        formula(
          `ROUND(SUMIFS(${source("C")},${criteria},${source("D")},${literal(l("paid"))}),2)`,
          item.paid,
          moneyFormat(item.loan.currency),
        ),
        formula(`ROUND(D${r}-E${r},2)`, item.remaining, moneyFormat(item.loan.currency)),
        formula(
          `IF(D${r}=0,"",IF(F${r}<=0,${literal(l("paid"))},IF(E${r}>0,${literal(l("partial"))},${literal(l("pending"))})))`,
          item.status
            ? l(
                item.status === "settled"
                  ? "paid"
                  : item.status === "partial"
                    ? "partial"
                    : "pending",
              )
            : "",
        ),
      ];
    }),
    { hidden: [0], widths: [20, 34, 20, 23, 23, 23, 24] },
  );
  const range = (column: string) => book.range("loanPayments", column, details.length);
  book.table(
    "loans",
    [
      l("loanId"),
      l("name"),
      l("start"),
      l("end"),
      l("installmentCount"),
      l("paidCount"),
      l("remainingCount"),
      l("total"),
      l("paidAmount"),
      l("loanRemaining"),
      l("status"),
      l("currency"),
    ],
    loans.map((loan, position) => {
      const r = FIRST_ROW + position,
        key = index.loanKeys.get(loan.row_id) || "";
      const criteria = `${range("A")},A${r}`;
      return [
        key,
        formula(rowName(loan.row_id), loan.name),
        dateCell(loan.start_month, true),
        dateCell(loan.end_month, true),
        formula(`COUNTIFS(${criteria},${range("D")},">0")`, loan.total_installments, "0"),
        formula(
          `COUNTIFS(${criteria},${range("G")},${literal(l("paid"))},${range("D")},">0")`,
          loan.paid_installments,
          "0",
        ),
        formula(`MAX(0,E${r}-F${r})`, loan.remaining_installments, "0"),
        formula(
          `ROUND(SUMIFS(${range("D")},${criteria}),2)`,
          loan.total_amount,
          moneyFormat(loan.currency),
        ),
        formula(
          `ROUND(SUMIFS(${range("E")},${criteria}),2)`,
          loan.paid_amount,
          moneyFormat(loan.currency),
        ),
        formula(`ROUND(H${r}-I${r},2)`, loan.remaining_amount, moneyFormat(loan.currency)),
        formula(
          `IF(E${r}=0,"",IF(G${r}=0,${literal(l("paid"))},${literal(l("pending"))}))`,
          loan.total_installments ? l(loan.remaining_installments === 0 ? "paid" : "pending") : "",
        ),
        loan.currency,
      ];
    }),
    { hidden: [0], widths: [20, 34, 20, 20, 18, 18, 18, 24, 24, 24, 23, 15] },
  );
  const yearly: ExcelValue[][] = [];
  for (const loan of loans) {
    const key = index.loanKeys.get(loan.row_id) || "";
    const years = [
      ...new Set(
        details.filter((item) => item.key === key).map((item) => Number(item.month.slice(0, 4))),
      ),
    ].sort();
    for (const year of years) {
      const r = FIRST_ROW + yearly.length,
        cached = details.filter((item) => item.key === key && item.month.startsWith(`${year}-`));
      const criteria = `${range("A")},C${r},${range("C")},">="&DATE(A${r},1,1),${range("C")},"<"&DATE(A${r}+1,1,1)`;
      yearly.push([
        year,
        loan.name,
        key,
        formula(
          `COUNTIFS(${criteria},${range("D")},">0")`,
          cached.filter((item) => item.amount > 0).length,
          "0",
        ),
        formula(
          `COUNTIFS(${criteria},${range("G")},${literal(l("paid"))},${range("D")},">0")`,
          cached.filter((item) => item.status === "settled" && item.amount > 0).length,
          "0",
        ),
        formula(
          `MAX(0,D${r}-E${r})`,
          cached.filter((item) => item.amount > 0 && item.status !== "settled").length,
          "0",
        ),
        formula(
          `ROUND(SUMIFS(${range("D")},${criteria}),2)`,
          roundedSum(cached.map((item) => item.amount)),
          moneyFormat(loan.currency),
        ),
        formula(
          `ROUND(SUMIFS(${range("E")},${criteria}),2)`,
          roundedSum(cached.map((item) => item.paid)),
          moneyFormat(loan.currency),
        ),
        formula(
          `ROUND(G${r}-H${r},2)`,
          roundedSum(cached.map((item) => item.remaining)),
          moneyFormat(loan.currency),
        ),
      ]);
    }
  }
  book.table(
    "loanYearly",
    [
      l("year"),
      l("name"),
      l("loanId"),
      l("installmentCount"),
      l("paidCount"),
      l("remainingCount"),
      l("total"),
      l("paidAmount"),
      l("loanRemaining"),
    ],
    yearly,
    { hidden: [2], widths: [12, 34, 20, 20, 20, 20, 25, 25, 25] },
  );
}
