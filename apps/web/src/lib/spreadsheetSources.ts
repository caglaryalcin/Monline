import type { ExportRecord } from "@/services/spreadsheetExport";

import { isBillRecord } from "./spending";
import type { SpreadsheetLabel } from "./spreadsheetExportLabels";
import type {
SpreadsheetWorkbook } from "./spreadsheetWorkbook";
import { dateCell, type ExcelValue,FIRST_ROW, formula, literal, money, moneyFormat, numeric,   quoteSheet, roundedSum } from "./spreadsheetWorkbook";

export function buildSourceSheets(book: SpreadsheetWorkbook) {
  const l = book.label, snapshot = book.snapshot, collections = snapshot.collections;
  const records = (name: string) => collections[name] || [];
  const text = (row: ExportRecord, field: string) => typeof row[field] === "string" ? row[field] as string : "";
  const number = (row: ExportRecord, field: string) => typeof row[field] === "number" && Number.isFinite(row[field]) ? row[field] as number : null;
  const nameMap = (name: string) => new Map(records(name).map((row) => [row.id, text(row, "name")]));
  const currencies = new Map(records("currencies").map((row) => [row.id, text(row, "code")]));
  const codeFor = (value: string) => currencies.get(value) || (/^[A-Z]{3}$/.test(value) ? value : "");
  const methods = nameMap("payment_methods"), categories = nameMap("categories");
  const cycles = new Map(snapshot.cycles.map((cycle) => [cycle.id, cycle.name]));
  const subscriptions = records("subscriptions");
  const subById = new Map(subscriptions.map((row) => [row.id, row]));
  const payments = [...records("payment_records")].sort((a, b) => text(a, "due_date").localeCompare(text(b, "due_date")) || a.id.localeCompare(b.id));
  const paymentRows = payments.map((payment, position): ExcelValue[] => {
    const r = FIRST_ROW + position, sub = subById.get(text(payment, "subscription_id"));
    const code = codeFor(text(payment, "currency") || (sub ? text(sub, "currency") : ""));
    const amount = number(payment, "amount"), paid = !!text(payment, "paid_at"), income = sub?.record_type === "credit";
    return [text(payment, "subscription_id"), text(payment, "name") || (sub ? text(sub, "name") : ""),
      dateCell(text(payment, "due_date")), dateCell(text(payment, "paid_at")), amount == null ? null : code ? money(amount, code) : numeric(amount), code,
      l(paid ? income ? "received" : "paid" : "pending"),
      methods.get(text(payment, "payment_method") || (sub ? text(sub, "payment_method") : "")) || "",
      categories.get(text(payment, "category") || (sub ? text(sub, "category") : "")) || "", text(payment, "notes"),
      formula(`IF(AND(OR(G${r}=${literal(l("paid"))},G${r}=${literal(l("received"))}),ISNUMBER(E${r})),E${r},0)`, paid ? amount || 0 : 0, code ? moneyFormat(code) : "#,##0.00"),
      payment.id, Array.isArray(payment.statement_sources) ? payment.statement_sources.join("\n") : ""];
  });
  book.table("payments", [l("id"), l("name"), l("date"), l("paidDate"), l("amount"), l("currency"), l("status"),
    l("paymentMethod"), l("category"), l("notes"), l("paidAmount"), l("id"), l("source")], paymentRows,
  { widths: [24, 34, 20, 22, 22, 15, 23, 26, 27, 48, 22, 23, 60], hidden: [10] });
  book.table("subscriptions", [l("id"), l("name"), l("amount"), l("currency"), l("cycle"), l("frequency"), l("nextDate"),
    l("start"), l("end"), l("status"), l("category"), l("paymentMethod"), l("source"), l("paidAmount"), l("paidCount"), l("notes")],
    subscriptions.map((sub, position) => {
      const r = FIRST_ROW + position, code = codeFor(text(sub, "currency")), price = number(sub, "price");
      const related = paymentRows.filter((row) => row[0] === sub.id && row[5] === code);
      const criteria = `${book.range("payments", "A", payments.length)},A${r},${book.range("payments", "F", payments.length)},D${r}`;
      const status = l(sub.record_type === "credit" ? "received" : "paid");
      const amount = roundedSum(related.map((row) => (row[10] as { v: number }).v));
      return [sub.id, text(sub, "name"), code ? money(price, code) : numeric(price), code,
        cycles.get(text(sub, "cycle")) || text(sub, "cycle"), number(sub, "frequency"), dateCell(text(sub, "next_payment")),
        dateCell(text(sub, "start_date")), dateCell(text(sub, "end_date") || text(sub, "cancellation_date")),
        l(sub.inactive ? "inactive" : "active"), categories.get(text(sub, "category")) || "", methods.get(text(sub, "payment_method")) || "",
        l(sub.statement_imported ? "statement" : "manual"),
        formula(`ROUND(SUMIFS(${book.range("payments", "K", payments.length)},${criteria}),2)`, amount, code ? moneyFormat(code) : "#,##0.00"),
        formula(`COUNTIFS(${criteria},${book.range("payments", "G", payments.length)},${literal(status)})`, related.filter((row) => row[6] === status).length, "0"),
        text(sub, "notes")];
    }), { widths: [23, 34, 22, 15, 20, 18, 21, 20, 20, 18, 27, 26, 18, 23, 19, 48] });

  const financeNames = new Map(snapshot.finance.finance_rows.map((row) => [row.id, row.name]));
  const sourceLabel = (source: string) => source === "ledger" ? "Gelir/Gider" : l(source === "statement" ? "statement" : "manual");
  const billEvents = snapshot.spending.events.filter(isBillRecord).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const detailSheet = book.workbook.Sheets[book.name("entries")];
  const entryPositions = new Map(Object.keys(detailSheet).filter((address) => /^L\d+$/.test(address) && Number(address.slice(1)) >= FIRST_ROW)
    .map((address) => [String(detailSheet[address].v), Number(address.slice(1))]));
  book.table("bills", [l("name"), l("date"), l("amount"), l("currency"), l("status"), l("source"), l("rowTag"), l("paymentTag"), l("notes"), l("id")],
    billEvents.map((bill) => {
      const entryRow = bill.source === "ledger" ? entryPositions.get(bill.id.slice("ledger:".length)) : undefined;
      const amount = entryRow ? formula(`${quoteSheet(book.name("entries"))}!C${entryRow}`, bill.amount, moneyFormat(bill.currency)) : money(bill.amount, bill.currency);
      const state = l(bill.status === "settled" ? "paid" : "pending");
      return [bill.name, dateCell(bill.date), amount, bill.currency,
        entryRow ? formula(`${quoteSheet(book.name("entries"))}!D${entryRow}`, state) : state, sourceLabel(bill.source), bill.bill_type ? l(bill.bill_type) : "",
        bill.card_paid ? l("cardPaid") : "", bill.notes || "", bill.id];
    }),
    { widths: [34, 20, 22, 15, 23, 25, 26, 28, 48, 28] });

  const statements = [...snapshot.statements].sort((a, b) => a.period.localeCompare(b.period) || a.file_name.localeCompare(b.file_name));
  const statementById = new Map(statements.map((statement) => [statement.id, statement]));
  book.table("statementSummary", [l("statementMonth"), l("bank"), l("file"), l("previousBalance"), l("repayments"), l("purchases"),
    l("cashAdvance"), l("fees"), l("balance"), l("minimumPayment"), l("calculated"), l("difference"), l("id"), l("archived")],
    statements.map((statement, position) => {
      const r = FIRST_ROW + position, summary = statement.summary || {};
      const values = [summary.previous_balance, summary.payments, summary.purchases, summary.cash, summary.fees];
      const complete = values.every((value) => typeof value === "number" && Number.isFinite(value));
      const calculated = complete ? roundedSum([summary.previous_balance!, -summary.payments!, summary.purchases!, summary.cash!, summary.fees!]) : null;
      return [dateCell(statement.period, true), statement.bank, statement.file_name, ...values.map((value) => money(value)),
        money(summary.balance), money(summary.minimum_payment),
        formula(`IF(COUNT(D${r}:H${r})=5,ROUND(D${r}-E${r}+F${r}+G${r}+H${r},2),"")`, calculated ?? "", moneyFormat()),
        formula(`IF(OR(I${r}="",K${r}=""),"",ROUND(I${r}-K${r},2))`, calculated == null || summary.balance == null ? "" : roundedSum([summary.balance, -calculated]), moneyFormat()),
        statement.id, l(statement.tracking_hidden ? "yes" : "no")];
    }), { widths: [20, 20, 58, 24, 24, 24, 22, 24, 24, 24, 24, 22, 23, 18] });
  const statementRows: ExcelValue[][] = [], unread: ExcelValue[][] = [];
  const kindLabel = (kind: string) => l(({ charge: "expense", refund: "refund", repayment: "repayment", fee: "fee", cash: "cashAdvance" } as Record<string, SpreadsheetLabel>)[kind] || "type");
  for (const statement of statements) {
    for (const [selected, rows] of [[true, statement.transactions], [false, statement.excluded_transactions || []]] as const) {
      for (const row of rows) {
        const r = FIRST_ROW + statementRows.length;
        const signed = ["refund", "repayment"].includes(row.kind) ? -row.amount : row.amount;
        statementRows.push([dateCell(statement.period, true), statement.file_name, dateCell(row.date), row.merchant, kindLabel(row.kind),
          money(row.amount, row.currency), row.currency,
          formula(`IF(ISNUMBER(F${r}),IF(OR(E${r}=${literal(l("refund"))},E${r}=${literal(l("repayment"))}),-F${r},F${r}),"")`, Number.isFinite(signed) ? signed : "", moneyFormat(row.currency)),
          row.installment, row.category || "", l(selected ? "yes" : "no"), row.page, row.source || "", statement.id, row.id,
          money(row.financing?.principal, row.currency), money(row.financing?.interest, row.currency), money(row.financing?.kkdf, row.currency), money(row.financing?.bsmv, row.currency)]);
      }
    }
    for (const row of statement.unresolved || []) unread.push([statement.file_name, row.page, row.text, statement.id]);
  }
  book.table("statementRows", [l("statementMonth"), l("file"), l("date"), l("merchant"), l("type"), l("amount"), l("currency"),
    l("total"), l("currentInstallment"), l("category"), l("selected"), l("page"), l("rawSource"), l("id"), l("id"), "Anapara", "Faiz", "KKDF", "BSMV"],
    statementRows, { widths: [21, 58, 19, 45, 24, 22, 15, 22, 18, 24, 15, 15, 80, 23, 23] });
  book.table("unresolved", [l("file"), l("page"), l("rawSource"), l("id")], unread, { widths: [58, 15, 100, 23] });

  book.table("cardTransactions", [l("cardName"), l("month"), l("date"), l("merchant"), l("amount"), l("notes"), l("rowId"), l("id")],
    (snapshot.finance.finance_card_transactions || []).map((row) => [financeNames.get(row.row_id) || "", dateCell(row.month, true), dateCell(row.date), row.merchant,
      money(row.amount), row.notes, row.row_id, row.id]), { widths: [30, 20, 19, 42, 23, 48, 23, 23] });
  book.table("links", [l("cardName"), l("month"), l("statementMonth"), l("file"), l("rowId"), l("id")],
    (snapshot.finance.finance_statement_links || []).map((link) => [financeNames.get(link.row_id) || "", dateCell(link.month, true),
      dateCell(statementById.get(link.statement_id)?.period, true), statementById.get(link.statement_id)?.file_name || "", link.row_id, link.statement_id]),
    { widths: [30, 21, 21, 58, 23, 23] });
  book.table("salaryHistory", [l("date"), l("amount"), l("notes"), l("id")], snapshot.finance.salary_history
    .map((row) => [dateCell(row.effective_date), money(row.amount), row.notes, row.id]), { widths: [21, 24, 58, 23] });
  book.table("events", [l("name"), l("date"), l("amount"), l("currency"), l("type"), l("status"), l("source"), l("includedExpense"),
    l("paymentTag"), l("currentInstallment"), l("statementMonth"), l("notes"), l("id")], snapshot.spending.events.map((event) => [
      event.name, dateCell(event.date), money(event.amount, event.currency), event.currency, event.kind,
      l(event.status === "settled" ? "paid" : event.status === "recorded" ? "settled" : "pending"), sourceLabel(event.source), l(event.counts_as_expense ? "yes" : "no"),
      event.card_paid ? l("cardPaid") : "", event.installment || "", dateCell(event.statement_period, true), event.notes || "", event.id,
    ]), { note: l("cardHelp"), widths: [42, 20, 23, 16, 23, 23, 23, 25, 28, 19, 21, 48, 28] });

  const fields: Record<string, SpreadsheetLabel> = { id: "id", name: "name", amount: "amount", currency: "currency", date: "date", month: "month", year: "year",
    notes: "notes", note: "notes", effective_date: "date", source: "source", subscription_id: "subscriptions", row_id: "rowId", created: "date",
    provider_name: "providers", merchant_name: "merchant", start_month: "start", updated_at: "updated", category: "category", payment_method: "paymentMethod" };
  const generic = (key: SpreadsheetLabel, source: ExportRecord[]) => {
    const keys = [...new Set(source.flatMap((row) => Object.keys(row)))].filter((field) => !["user", "collectionId", "collectionName", "expand"].includes(field));
    if (!keys.length) keys.push("id");
    book.table(key, keys.map((field) => fields[field] ? l(fields[field]) : field.replace(/_/g, " ")),
      source.map((row) => keys.map((field): ExcelValue => {
        const value = row[field];
        if (value == null) return null;
        if (typeof value === "number") return numeric(value);
        if (typeof value === "boolean") return l(value ? "yes" : "no");
        if (typeof value === "string") {
          if (/^\d{4}-\d{2}(?:-\d{2}(?:T| |$)|$)/.test(value) && /(?:date|month|_at|created|updated)$/.test(field))
            return dateCell(value, /^\d{4}-\d{2}$/.test(value));
          return value;
        }
        return JSON.stringify(value);
      })));
  };
  generic("history", records("subscription_history"));
  generic("yearlyCosts", records("yearly_costs"));
  generic("providers", records("merchant_logos"));
  generic("calendarMoves", records("calendar_moves"));
  generic("manualBills", records("manual_bills"));
  const definitions = ["currencies", "categories", "payment_methods", "household"].flatMap((name) => records(name).map((row) =>
    ({ ...row, source: name, currency_code: name === "currencies" ? text(row, "code") : "" })));
  generic("definitions", [...definitions, ...snapshot.cycles.map((cycle) => ({ ...cycle, source: "cycles" }))]);
}
