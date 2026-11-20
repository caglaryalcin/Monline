import { creditCardClosing } from "@/lib/creditCardCalendar";
import { type CreditCard, supportedCardBank } from "@/lib/creditCards";
import type { FinanceEntry, FinanceRow, FinanceStatementLink } from "@/lib/finance";
import { financeMonths, isCardPaid, isFinanceDeficitRow } from "@/lib/finance";
import { installmentSchedule } from "@/lib/installmentSchedule";
import { type SavingsRates, savingsUnitRate } from "@/lib/savings";
import type { SpendingData, SpendingEvent } from "@/lib/spending";
import type { SavedStatement } from "@/lib/statements";
import type { BudgetEvent } from "@/services/budget";

export type AffordabilityMethod = "cash" | "card" | "loan";
export type OutlookStatement = Pick<SavedStatement, "id" | "period" | "summary" | "credit_card">;
export interface OutlookLedger {
  finance_rows: Pick<FinanceRow, "id" | "name" | "kind" | "year" | "origin_row" | "is_deleted" | "expense_type" | "is_auto_carryover" | "payment_card" | "is_loan">[];
  finance_entries: Pick<FinanceEntry, "row_id" | "date" | "settled_date" | "status" | "amount" | "payment_tag">[];
  finance_statement_links: Pick<FinanceStatementLink, "row_id" | "month" | "statement_id">[];
}
export interface OutlookSpending {
  events: Pick<SpendingEvent, "id" | "date" | "amount" | "currency" | "source" | "duplicate_of" | "card_row_id" | "statement_period" | "statement_id" | "bank">[];
  installments: SpendingData["installments"];
  pending_bills?: Pick<SpendingEvent, "date" | "status" | "bill_skipped">[];
}
export interface OutlookBudget {
  month: string;
  review_required: boolean;
  events: Pick<BudgetEvent, "id" | "date" | "amount" | "currency" | "kind" | "source" | "status" | "duplicate_of" | "card_paid" | "card_row_id" | "row_id" | "amount_pending">[];
}
export interface OutlookHistory {
  month: string;
  expenses: { currency: string; amount: number; count: number }[];
  income: { currency: string; amount: number; count: number }[];
  review_required: boolean;
  sources: { payments: number; statements: number; ledger: number };
}
export interface OutlookMonth {
  month: string;
  knownIncome: number | null;
  knownExpense: number | null;
}
export interface BudgetMonth { month: string; income: number | null; expense: number | null }
export interface PurchasePlan {
  method: AffordabilityMethod;
  date: string;
  price: number;
  installments: number;
  cardFee: number;
  cardDue: string;
  cardDates?: string[];
  cardLimit: number | null;
  loanMonths: number;
  loanPayment: number | null;
  loanFee: number;
  loanDue: string;
}
export interface PurchaseScenario {
  status: "comfortable" | "tight" | "shortfall" | "incomplete" | "outside" | "limit" | "invalid";
  points: { month: string; before: number; after: number; payment: number }[];
  minimum: number | null;
  lowestMonth: string;
  remainingDebt: number;
  totalCost: number;
  monthlyPayment: number;
  firstPayment: string;
}
export const amountIsValid = (value: number | null): value is number => value !== null && Number.isFinite(value) && value >= 0 && value <= 1e12;
const cents = (value: number) => Math.round(value * 100);
export function validPurchaseDate(date: string) {
  if (!/^(19[7-9]\d|20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
export function shiftPurchaseDate(date: string, months: number) {
  if (!validPurchaseDate(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return first.toISOString().slice(0, 10);
}

/** Future months use the full recorded plan; current cash only changes by unsettled amounts. */
export function affordabilityLedgerMonths(ledger: OutlookLedger, months: string[], today: string) {
  const annual = new Map([...new Set(months.map(month => Number(month.slice(0, 4))))]
    .flatMap(year => financeMonths(ledger, year)).map(item => [item.month, item]));
  return months.map(month => {
    const recorded = annual.get(month)!;
    const future = month > today.slice(0, 7);
    const total = (cents(recorded.paid) + cents(recorded.pending)) / 100;
    return { month, total, paid: recorded.paid, pending: recorded.pending,
      income: future ? (cents(recorded.received) + cents(recorded.expected)) / 100 : recorded.expected,
      expense: future ? total : recorded.pending, records: recorded.expense_count };
  });
}

export function inferredCardDue(card: CreditCard | undefined, date: string) {
  if (!card || supportedCardBank(card.bank) !== "enpara" || !validPurchaseDate(date)) return "";
  const [year, month] = date.split("-").map(Number);
  let closing = creditCardClosing(card, year, month);
  if (!closing) return "";
  if (date > closing.date) {
    const next = shiftPurchaseDate(`${date.slice(0, 7)}-01`, 1);
    closing = creditCardClosing(card, Number(next.slice(0, 4)), Number(next.slice(5, 7)));
  }
  if (!closing) return "";
  const due = new Date(`${closing.date}T12:00:00Z`);
  due.setUTCDate(due.getUTCDate() + 10);
  return due.toISOString().slice(0, 10);
}
export function inferredCardSchedule(card: CreditCard | undefined, date: string, count: number) {
  const first = inferredCardDue(card, date);
  if (!first || !card || !Number.isInteger(count) || count < 1 || count > 120) return undefined;
  const closingDate = new Date(`${first}T12:00:00Z`);
  closingDate.setUTCDate(closingDate.getUTCDate() - 10);
  const cycle = closingDate.toISOString().slice(0, 7);
  return Array.from({ length: count }, (_, index) => {
    const month = shiftPurchaseDate(`${cycle}-01`, index);
    const closing = creditCardClosing(card, Number(month.slice(0, 4)), Number(month.slice(5, 7)));
    if (!closing) return "";
    const due = new Date(`${closing.date}T12:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 10);
    return due.toISOString().slice(0, 10);
  });
}
function periodDue(card: CreditCard | undefined, period: string) {
  if (card && supportedCardBank(card.bank) === "enpara") {
    const closing = creditCardClosing(card, Number(period.slice(0, 4)), Number(period.slice(5, 7)));
    if (closing) {
      const due = new Date(`${closing.date}T12:00:00Z`); due.setUTCDate(due.getUTCDate() + 10);
      return { date: due.toISOString().slice(0, 10), estimated: false };
    }
  }
  return { date: shiftPurchaseDate(`${period}-01`, 1), estimated: true };
}

/** Read-only cash obligations: repayments represent card purchases once. */
export function buildAffordabilityOutlook({ ledger, budgets, spending, statements, cards, rates, currency, today, history }: {
  ledger: OutlookLedger; budgets: OutlookBudget[]; spending: OutlookSpending; statements: OutlookStatement[];
  cards: CreditCard[]; rates?: SavingsRates; currency: string; today: string;
  history?: OutlookHistory[];
}) {
  const startMonth = today.slice(0, 7);
  const rows = new Map(ledger.finance_rows.map(row => [row.id, row]));
  const rowRoot = (id: string) => rows.get(id)?.origin_row || id;
  const source = new Map(statements.map(statement => [statement.id, statement]));
  const cardByRow = new Map<string, string>();
  for (const link of ledger.finance_statement_links || []) {
    const card = source.get(link.statement_id)?.credit_card;
    if (card) cardByRow.set(rowRoot(link.row_id), `card:${card}`);
  }
  const root = (id: string) => cardByRow.get(rowRoot(id)) || rowRoot(id);
  const links = new Map((ledger.finance_statement_links || []).map(link => [link.statement_id, root(link.row_id)]));
  const statementKey = (statement: OutlookStatement) => statement.credit_card ? `card:${statement.credit_card}` : links.get(statement.id) || `statement:${statement.id}`;
  const latest = new Map<string, OutlookStatement>();
  let uncertainStatement = false;
  for (const statement of statements) {
    if (statement.period > startMonth) continue;
    if (!statement.credit_card && !links.has(statement.id)) { uncertainStatement = true; continue; }
    const key = statementKey(statement), previous = latest.get(key);
    if (!previous || previous.period < statement.period) latest.set(key, statement);
  }
  const convert = (value: number, code = "TRY") => {
    const rate = savingsUnitRate(code, rates, currency);
    const result = rate === null ? null : Math.round(value * rate * 100);
    return result !== null && Number.isSafeInteger(result) ? result : null;
  };
  const amounts = new Map<string, { planned: number; owed: number }>();
  const failed = new Set<string>();
  const failedIncome = new Set<string>();
  const uncertain = new Set<string>();
  if (uncertainStatement) { uncertain.add(startMonth); failed.add(startMonth); }
  const put = (key: string, month: string, value: number | null, kind: "planned" | "owed") => {
    if (!budgets.some(budget => budget.month === month)) return;
    if (value === null) { failed.add(month); return; }
    const item = amounts.get(`${key}:${month}`) || { planned: 0, owed: 0 };
    item[kind] += value; amounts.set(`${key}:${month}`, item);
  };
  const months = budgets.map(budget => {
    let direct = 0, income = 0, hasIncome = false;
    for (const entry of ledger.finance_entries) {
      const row = rows.get(entry.row_id);
      if (!row || row.is_deleted || row.kind === "expense" || entry.status !== "planned" || !entry.date.startsWith(budget.month)) continue;
      hasIncome = true; const value = convert(entry.amount); if (value === null) failedIncome.add(budget.month); else income += value;
    }
    const seen = new Set<string>();
    for (const event of budget.events) {
      if (seen.has(event.id) || event.status !== "planned" || event.duplicate_of || event.source === "statement" || event.source === "manual_card" || event.card_paid || event.card_row_id || event.kind === "carryover") continue;
      if (event.row_id && rows.get(event.row_id)?.is_deleted) continue;
      seen.add(event.id);
      const value = convert(event.amount, event.currency);
      if (event.amount_pending) { uncertain.add(budget.month); failed.add(budget.month); }
      if (event.kind === "card_payment") put(event.row_id ? root(event.row_id) : event.id, budget.month, value, "planned");
      else if (value === null) failed.add(budget.month); else direct += value;
    }
    if (budget.review_required) { uncertain.add(budget.month); failed.add(budget.month); }
    return { month: budget.month, knownIncome: hasIncome ? income / 100 : null, direct };
  });
  for (const [key, statement] of latest) {
    const balance = statement.summary?.balance;
    if (typeof balance !== "number" || !Number.isFinite(balance) || balance < 0) { uncertain.add(startMonth); failed.add(startMonth); continue; }
    const card = cards.find(item => item.id === statement.credit_card);
    const linkedMonths = new Set((ledger.finance_statement_links || []).filter(link => link.statement_id === statement.id).map(link => `${root(link.row_id)}:${link.month}`));
    const entries = ledger.finance_entries.filter(entry => linkedMonths.has(`${root(entry.row_id)}:${entry.date.slice(0, 7)}`));
    const plannedDate = entries.filter(entry => entry.status === "planned").map(entry => entry.date).sort()[0];
    const due = plannedDate ? { date: plannedDate, estimated: false } : periodDue(card, statement.period);
    const month = due.date < today ? startMonth : due.date.slice(0, 7);
    const paid = entries.filter(entry => entry.status === "settled" && (entry.settled_date || entry.date) <= today)
      .reduce((sum, entry) => sum + cents(entry.amount), 0);
    put(key, month, convert(Math.max(0, cents(balance) - paid) / 100), "owed");
    if (due.estimated) uncertain.add(month);
  }
  // Future card-funded subscriptions and ledger charges become cash repayments.
  const seenCardCharges = new Set<string>();
  for (const budget of budgets) for (const event of budget.events) {
    if (event.status !== "planned" || event.duplicate_of || event.source === "statement" || event.source === "manual_card" || (!event.card_row_id && !event.card_paid)) continue;
    if (event.row_id && rows.get(event.row_id)?.is_deleted) continue;
    if (seenCardCharges.has(event.id)) continue;
    seenCardCharges.add(event.id);
    const key = event.card_row_id ? root(event.card_row_id) : event.id;
    const snapshot = latest.get(key);
    const card = cards.find(item => item.id === snapshot?.credit_card);
    const date = inferredCardDue(card, event.date);
    const due = date || shiftPurchaseDate(`${event.date.slice(0, 7)}-01`, 1);
    const month = due < today ? startMonth : due.slice(0, 7);
    put(key, month, convert(event.amount, event.currency), "owed");
    const snapshotClosing = snapshot && card ? creditCardClosing(card, Number(snapshot.period.slice(0, 4)), Number(snapshot.period.slice(5, 7))) : null;
    // An unverified old charge may already be in the latest bill: require a
    // manual total rather than enforcing a possibly duplicated minimum.
    if (snapshot && event.date <= (snapshotClosing?.date || `${snapshot.period}-31`)) { uncertain.add(month); failed.add(month); }
    if (!date || event.amount_pending) uncertain.add(month);
    if (event.amount_pending) failed.add(month);
  }
  for (const event of spending.events) {
    if (event.source !== "manual_card" || event.duplicate_of || !event.card_row_id) continue;
    const key = root(event.card_row_id), snapshot = latest.get(key);
    if (snapshot && (event.statement_period || event.date.slice(0, 7)) <= snapshot.period) continue;
    const card = cards.find(item => item.id === snapshot?.credit_card);
    const due = inferredCardDue(card, event.date) || periodDue(card, event.statement_period || event.date.slice(0, 7)).date;
    const month = due < today ? startMonth : due.slice(0, 7);
    put(key, month, convert(event.amount, event.currency), "owed");
    if (!card || supportedCardBank(card.bank) !== "enpara") uncertain.add(month);
  }
  for (const bill of spending.pending_bills || []) if (!bill.bill_skipped && bill.status === "planned") {
    const month = bill.date.slice(0, 7);
    uncertain.add(month); failed.add(month);
  }
  for (const plan of installmentSchedule(spending, shiftPurchaseDate(`${startMonth}-01`, -1).slice(0, 7))) {
    const statement = source.get(plan.statement_id);
    const key = plan.row_id ? root(plan.row_id) : statement ? statementKey(statement) : `installment:${plan.card_name || plan.statement_id}`;
    const snapshot = latest.get(key);
    if (snapshot && typeof snapshot.summary?.balance === "number" && plan.period <= snapshot.period) continue;
    const due = periodDue(cards.find(card => card.id === statement?.credit_card), plan.period);
    const month = due.date < today ? startMonth : due.date.slice(0, 7);
    put(key, month, convert(plan.amount, plan.currency), "owed");
    if (due.estimated) uncertain.add(month);
  }
  const known = months.map(item => {
    let expense = item.direct;
    for (const [key, value] of amounts) if (key.endsWith(`:${item.month}`)) expense += Math.max(value.planned, value.owed);
    return { month: item.month, knownIncome: failedIncome.has(item.month) ? null : item.knownIncome,
      knownExpense: failed.has(item.month) || !Number.isSafeInteger(expense) ? null : expense / 100 };
  });
  // Historical totals are suggestions for the TOTAL expense, never an addition.
  const historical = [-3, -2, -1].map(offset => shiftPurchaseDate(`${startMonth}-01`, offset).slice(0, 7));
  const historicalExpenses = new Map<string, number>(), historicalIncome = new Map<string, number>();
  let expenseHistoryIncomplete = false, incomeHistoryIncomplete = false;
  if (history) {
    const sum = (items: OutlookHistory["expenses"]) => {
      let result = 0;
      for (const item of items) {
        if (!Number.isFinite(item.amount) || !Number.isSafeInteger(item.count) || item.count < 1) return null;
        const value = convert(item.amount, item.currency);
        if (value === null) return null;
        result += value * item.count;
        if (!Number.isSafeInteger(result)) return null;
      }
      return result;
    };
    for (const period of history) {
      if (!historical.includes(period.month)) continue;
      if (period.expenses.length) {
        const value = sum(period.expenses);
        if (value === null) expenseHistoryIncomplete = true; else historicalExpenses.set(period.month, value);
      }
      if (period.income.length) {
        const value = sum(period.income);
        if (value === null) incomeHistoryIncomplete = true; else historicalIncome.set(period.month, value);
      }
    }
  } else for (const entry of ledger.finance_entries) {
    const row = rows.get(entry.row_id), month = (entry.settled_date || entry.date).slice(0, 7);
    if (!row || row.is_deleted || entry.status !== "settled" || !historical.includes(month) || isFinanceDeficitRow(row)) continue;
    if (isCardPaid(entry, row)) continue;
    const value = convert(entry.amount); if (value === null) continue;
    const target = row.kind === "expense" ? historicalExpenses : historicalIncome;
    target.set(month, (target.get(month) || 0) + value);
  }
  const historySources = (history || []).reduce((sum, period) => ({
    payments: sum.payments + period.sources.payments,
    statements: sum.statements + period.sources.statements,
    ledger: sum.ledger + period.sources.ledger,
  }), { payments: 0, statements: 0, ledger: 0 });
  const latestIncome = [...historicalIncome].sort(([a], [b]) => b.localeCompare(a))[0];
  return { months: known, uncertainMonths: [...uncertain].filter(month => budgets.some(budget => budget.month === month)),
    historicalExpense: !expenseHistoryIncomplete && historicalExpenses.size ? Math.round([...historicalExpenses.values()].reduce((sum, value) => sum + value, 0) / historicalExpenses.size) / 100 : null,
    lastIncome: !incomeHistoryIncomplete && latestIncome ? latestIncome[1] / 100 : null,
    historySources, historyMonths: historical,
    historyNeedsReview: (history || []).some(period => period.review_required),
    historyMissingRates: expenseHistoryIncomplete || incomeHistoryIncomplete,
  };
}

export function simulatePurchase(months: BudgetMonth[], opening: number | null, buffer: number | null, plan: PurchasePlan, today: string, startMonth = months[0]?.month): PurchaseScenario {
  const empty: PurchaseScenario = { status: "incomplete", points: [], minimum: null, lowestMonth: "", remainingDebt: 0, totalCost: 0, monthlyPayment: 0, firstPayment: "" };
  if (!amountIsValid(opening) || !amountIsValid(buffer) || !startMonth || !validPurchaseDate(`${startMonth}-01`) || months.length < 6 || months.some(month => !amountIsValid(month.income) || !amountIsValid(month.expense))) return empty;
  if (!amountIsValid(plan.price) || plan.price <= 0 || plan.price > 1e9 || !validPurchaseDate(plan.date) || plan.date < today) return { ...empty, status: "invalid" };
  const payments: { date: string; amount: number }[] = [];
  const split = (total: number, count: number, first: string) => {
    const regular = Math.floor(total / count);
    for (let index = 0; index < count; index++) payments.push({ date: plan.cardDates?.[index] ?? shiftPurchaseDate(first, index), amount: regular + (index < total % count ? 1 : 0) });
  };
  if (plan.method === "cash") payments.push({ date: plan.date, amount: cents(plan.price) });
  if (plan.method === "card") {
    if (!amountIsValid(plan.cardFee) || !Number.isInteger(plan.installments) || plan.installments < 1 || plan.installments > 120 || !validPurchaseDate(plan.cardDue) || plan.cardDue < plan.date) return { ...empty, status: "invalid" };
    if (plan.cardDates && (plan.cardDates.length !== plan.installments || plan.cardDates.some(date => !validPurchaseDate(date) || date < plan.date))) return { ...empty, status: "invalid" };
    if (!amountIsValid(plan.cardLimit)) return empty;
    if (plan.price + plan.cardFee > plan.cardLimit) return { ...empty, status: "limit" };
    split(cents(plan.price) + cents(plan.cardFee), plan.installments, plan.cardDue);
  }
  if (plan.method === "loan") {
    if (!amountIsValid(plan.loanPayment) || plan.loanPayment <= 0) return empty;
    if (!Number.isInteger(plan.loanMonths) || plan.loanMonths < 1 || plan.loanMonths > 120 || !amountIsValid(plan.loanFee) || !validPurchaseDate(plan.loanDue) || plan.loanDue < plan.date || cents(plan.loanPayment) * plan.loanMonths < cents(plan.price)) return { ...empty, status: "invalid" };
    for (let index = 0; index < plan.loanMonths; index++) payments.push({ date: shiftPurchaseDate(plan.loanDue, index), amount: cents(plan.loanPayment) });
    if (plan.loanFee) payments.push({ date: plan.date, amount: cents(plan.loanFee) });
  }
  const end = shiftPurchaseDate(`${startMonth}-01`, 6);
  let before = cents(opening), after = before;
  const points = months.filter(month => month.month < end).map(month => {
    const change = cents(month.income!) - cents(month.expense!);
    const payment = payments.filter(item => item.date.startsWith(month.month)).reduce((sum, item) => sum + item.amount, 0);
    before += change; after += change - payment;
    return { month: month.month, before: before / 100, after: after / 100, payment: payment / 100 };
  }).filter(point => point.month >= startMonth);
  if (points.length !== 6) return empty;
  if (points.some(point => !Number.isSafeInteger(cents(point.before)) || !Number.isSafeInteger(cents(point.after)))) return { ...empty, status: "invalid" };
  const minimum = Math.min(...points.map(point => point.after));
  const lowest = points.reduce((left, right) => left.after <= right.after ? left : right);
  const remaining = payments.filter(item => item.date >= end).reduce((sum, item) => sum + item.amount, 0);
  const first = payments.map(item => item.date).sort()[0] || "";
  return { status: plan.date >= end || !payments.some(item => item.date < end) ? "outside" : minimum < 0 ? "shortfall" : minimum < buffer ? "tight" : "comfortable",
    points, minimum, lowestMonth: lowest.month, remainingDebt: remaining / 100,
    totalCost: payments.reduce((sum, item) => sum + item.amount, 0) / 100,
    monthlyPayment: plan.method === "cash" ? plan.price : plan.method === "card" ? Math.ceil((cents(plan.price) + cents(plan.cardFee)) / plan.installments) / 100 : plan.loanPayment!, firstPayment: first };
}
