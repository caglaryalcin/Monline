const pick = (record, fields) => Object.fromEntries(fields.map(field => [field, record[field]]));
const ROW_FIELDS = ["id", "name", "kind", "year", "origin_row", "is_deleted", "expense_type", "is_auto_carryover", "payment_card", "is_loan"];
const ENTRY_FIELDS = ["row_id", "date", "settled_date", "status", "amount", "payment_tag"];
const LINK_FIELDS = ["row_id", "month", "statement_id"];
const EVENT_FIELDS = ["id", "date", "amount", "currency", "kind", "source", "status", "duplicate_of", "card_paid", "card_row_id", "row_id", "amount_pending"];
const CARD_EVENT_FIELDS = ["id", "date", "amount", "currency", "source", "duplicate_of", "card_row_id", "statement_period", "statement_id", "bank"];
function monthOffset(month, offset) {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1)).toISOString().slice(0, 7);
}
function moneyGroups(records, currency = record => record.currency) {
  const groups = new Map();
  for (const record of records) {
    const code = currency(record), key = JSON.stringify([code, record.amount]);
    const group = groups.get(key) || { currency: code, amount: record.amount, count: 0 };
    group.count++; groups.set(key, group);
  }
  return [...groups.values()];
}

/** Transport only the inputs used by the simulator, preserving each original
 * monetary amount so conversion still rounds each posting to the same cent. */
function compactAffordabilitySnapshot(data, spending, budgets, holdings, cards, date, historicalBudgets = []) {
  const month = date.slice(0, 7), historicalFrom = monthOffset(month, -3);
  const rows = new Map(data.finance_rows.map(row => [row.id, row]));
  const root = id => rows.get(id)?.origin_row || id;
  const cardRoots = new Set(data.finance_statement_links.map(link => root(link.row_id)));
  const entries = data.finance_entries.filter(entry => {
    const row = rows.get(entry.row_id);
    if (!row) return true;
    if (row.expense_type === "credit_card" || cardRoots.has(root(row.id))) return true;
    // A purchase can start repayment after today's six-month window. Retain
    // future ledger postings so its full repayment window uses actual records.
    const postedMonth = entry.date.slice(0, 7);
    if (postedMonth >= month) return true;
    const actualMonth = (entry.settled_date || entry.date).slice(0, 7);
    if (entry.status === "settled") return actualMonth >= historicalFrom && actualMonth < month;
    return false;
  });
  // installmentSchedule only reads statement bank metadata from statement
  // events; all individual PDF purchases are unnecessary on this screen.
  const banks = new Map();
  for (const event of spending.events) if (event.statement_id && event.bank) banks.set(event.statement_id, event);
  const cardEvents = [...banks.values(), ...spending.events.filter(event => event.source === "manual_card")];
  return {
    history: historicalBudgets.map(budget => {
      const settled = data.finance_entries.filter(entry => entry.status === "settled" &&
        (entry.settled_date || entry.date).startsWith(budget.month) && rows.has(entry.row_id) && !rows.get(entry.row_id).is_deleted);
      const expenses = budget.events.filter(event => event.status !== "planned" && event.counts_as_expense);
      return {
        month: budget.month,
        expenses: moneyGroups(expenses),
        income: moneyGroups(settled.filter(entry => rows.get(entry.row_id).kind !== "expense"), () => "TRY"),
        review_required: budget.review_required,
        sources: {
          payments: data.payment_records.filter(record => record.paid_at && record.due_date.startsWith(budget.month)).length,
          statements: data.bank_statements.filter(statement => statement.period === budget.month).length,
          ledger: settled.length,
        },
      };
    }),
    ledger: {
      finance_rows: data.finance_rows.map(row => pick(row, ROW_FIELDS)),
      finance_entries: entries.map(entry => pick(entry, ENTRY_FIELDS)),
      finance_statement_links: data.finance_statement_links.map(link => pick(link, LINK_FIELDS)),
    },
    spending: {
      events: cardEvents.map(event => pick(event, CARD_EVENT_FIELDS)),
      installments: spending.installments,
      pending_bills: (spending.pending_bills || []).map(event => pick(event, ["date", "status", "bill_skipped"])),
    },
    budgets: budgets.map(budget => ({
      month: budget.month,
      review_required: budget.review_required,
      events: budget.events.filter(event => event.status === "planned" && !event.duplicate_of &&
        event.source !== "statement" && event.source !== "manual_card").map(event => pick(event, EVENT_FIELDS)),
    })),
    statements: data.bank_statements.map(({ id, period, summary, credit_card }) => ({ id, period, credit_card,
      ...(summary ? { summary: { balance: summary.balance } } : {}),
    })),
    holdings,
    cards,
    currencies: data.currencies.map(currency => pick(currency, ["id", "code", "is_main"])),
  };
}
module.exports = { compactAffordabilitySnapshot };
