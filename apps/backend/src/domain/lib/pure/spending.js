const { cancelledStatementCharges } = require("../bank-statements.js");
const { sourceAmountSafe, unitemizedFees } = require("../statement-checks.js");
const { statementPurchaseTotal } = require("./statement-refunds.mjs");
const { validDate } = require("./backfill-schedule.js");
const { isStatementPayment } = require("./statement-tracking.js");
const { rowForYear } = require("./finance-years.js");

const normalized = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
function isBill(name, category = "") {
  return (
    category === "bills" ||
    /\b(?:bedas|bogazici elektrik|ck bogazici|elektrik|electricity|igdas|iski|dogalgaz|dogal gaz|turkcell|vodafone|turk telekom|turknet|superonline|internet|water bill|gas bill)\b/.test(
      normalized(name),
    )
  );
}
function repayment(name) {
  const text = normalized(name).replace(/^o odeme /, "odeme ");
  if (/\b(?:iade\w*|refund\w*)\b/.test(text)) return false;
  return (
    /^(?:o+deme|deme) (?:enpara com|garanti|denizbank)\b/.test(text) ||
    /^(?:kart odemesi|kredi karti odemesi|hesaba yatirilan|payment received|card payment)\b/.test(
      text,
    )
  );
}
const validAmount = (amount) =>
  typeof amount === "number" &&
  Number.isFinite(amount) &&
  amount >= 0 &&
  amount <= 1e12 &&
  Math.abs(amount * 100 - Math.round(amount * 100)) < 0.01;
const ratio = (value) => {
  const match = String(value || "").match(/^\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*$/);
  return match && +match[1] > 0 && +match[1] <= +match[2]
    ? { current: +match[1], total: +match[2] }
    : null;
};
function nextMonth(month) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}

// A read-only projection. Source IDs are retained so the client can reconcile
// existing subscription payments rather than persisting duplicate purchases.
function spendingData(data, { trackingOnly = false } = {}) {
  const loans = require("./loans.js").loanSummaries(data);
  const hiddenStatements = new Set(
    data.bank_statements
      .filter((statement) => statement.tracking_hidden)
      .map((statement) => statement.id),
  );
  const statementMonths = [
    ...new Set(
      data.bank_statements
        .filter(
          (statement) => !trackingOnly || !hiddenStatements.has(statement.id),
        )
        .map((statement) => statement.period)
        .filter((period) => /^\d{4}-(0[1-9]|1[0-2])$/.test(period)),
    ),
  ]
    .sort()
    .reverse();
  const events = [],
    installments = [],
    issues = [],
    unmatchedInstallments = [];
  const rows = new Map(data.finance_rows.map((row) => [row.id, row]));
  const links = new Map(
    data.finance_statement_links.map((link) => [link.statement_id, link]),
  );
  const statementsById = new Map(
    data.bank_statements.map((statement) => [statement.id, statement]),
  );
  const linksByMonth = new Map(
    data.finance_statement_links.map((link) => [
      `${link.row_id}:${link.month}`,
      link,
    ]),
  );
  const statements = [...data.bank_statements].sort(
    (a, b) =>
      b.period.localeCompare(a.period) ||
      String(b.created).localeCompare(String(a.created)) ||
      a.id.localeCompare(b.id),
  );
  for (const statement of statements) {
    const link = links.get(statement.id);
    const card = link ? rows.get(link.row_id) : undefined;
    const transactions = Array.isArray(statement.transactions)
      ? statement.transactions
      : [];
    const cancelled = cancelledStatementCharges(
      transactions.filter(
        (row) =>
          row &&
          typeof row.date === "string" &&
          typeof row.merchant === "string",
      ),
      true,
    );
    const fees = unitemizedFees(
      transactions,
      statement.summary || {},
      statement.excluded_transactions || [],
    );
    if (fees > 0)
      events.push({
        id: `statement:${statement.id}:summary-fees`,
        name: "Interest / Taxes",
        date: "",
        amount: fees,
        currency: "TRY",
        kind: "expense",
        status: "settled",
        source: "statement",
        statement_id: statement.id,
        statement_period: statement.period,
        card_name: card?.name || "",
        card_row_id: card?.id || "",
        category: "fees",
        counts_as_expense: true,
        bill: false,
        undated: true,
      });
    for (const row of transactions) {
      if (
        cancelled.has(row.id) ||
        row.kind === "repayment" ||
        repayment(row.merchant)
      )
        continue;
      if (row.amount === 0) continue;
      if (
        !validDate(row.date) ||
        !validAmount(row.amount) ||
        !sourceAmountSafe(row) ||
        !["TRY", "USD", "EUR", "GBP"].includes(row.currency)
      ) {
        issues.push({ statement_id: statement.id, row_id: row.id });
        continue;
      }
      const event = {
        id: `statement:${statement.id}:${row.id}`,
        date: row.date,
        name: row.merchant,
        amount: row.kind === "refund" ? -row.amount : row.amount,
        currency: row.currency,
        kind: row.kind === "refund" ? "refund" : "expense",
        status: "settled",
        source: "statement",
        statement_id: statement.id,
        statement_period: statement.period,
        bank: statement.bank,
        card_name: card?.name || "",
        card_row_id: card?.id || "",
        category: row.category || "other",
        installment: row.installment || "",
        source_key: `[monline-statement:${statement.file_hash}:${row.id}]`,
        bill: !!link && isBill(row.merchant, row.category),
        counts_as_expense: true,
      };
      events.push(event);
      const installment = ratio(row.installment);
      if (row.kind !== "charge" || !installment) continue;
      if (!link) {
        if (!unmatchedInstallments.includes(statement.id))
          unmatchedInstallments.push(statement.id);
      }
      const remaining = installment.total - installment.current;
      const totalCents = Math.round(row.amount * 100) * installment.total;
      installments.push({
        id: event.id,
        name: event.name,
        currency: row.currency,
        amount: row.amount,
        total_amount:
          statementPurchaseTotal(row) ??
          (Number.isSafeInteger(totalCents) ? totalCents / 100 : null),
        remaining,
        remaining_amount: (Math.round(row.amount * 100) * remaining) / 100,
        current: installment.current,
        total: installment.total,
        date: row.date,
        statement_id: statement.id,
        period: statement.period,
        next_month: remaining ? nextMonth(statement.period) : "",
        card_name: card?.name || "",
        row_id: link?.row_id || "",
      });
    }
  }
  const matchedMonths = new Set(
    data.finance_statement_links
      .filter(
        (link) => !trackingOnly || !hiddenStatements.has(link.statement_id),
      )
      .map((link) => `${link.row_id}:${link.month}`),
  );
  for (const item of data.finance_card_transactions) {
    if (
      matchedMonths.has(`${item.row_id}:${item.month}`) ||
      !validDate(item.date) ||
      !validAmount(item.amount) ||
      item.amount === 0
    )
      continue;
    const card = rows.get(item.row_id);
    if (!card) continue;
    events.push({
      id: `manual:${item.id}`,
      name: item.merchant,
      date: item.date,
      amount: item.amount,
      currency: "TRY",
      source: "manual_card",
      status: "recorded",
      kind: "expense",
      card_name: card.name,
      bill: isBill(item.merchant),
      counts_as_expense: true,
      notes: item.notes || "",
    });
  }
  for (const entry of data.finance_entries) {
    const row = rows.get(entry.row_id);
    if (
      row?.kind !== "expense" ||
      !validDate(entry.date) ||
      !validAmount(entry.amount) ||
      entry.amount === 0
    )
      continue;
    const cardPayment = row.expense_type === "credit_card";
    const cardPaid =
      !cardPayment &&
      (entry.payment_tag === "credit_card" ||
        (entry.payment_tag !== "direct" && !!row.payment_card));
    const paymentCard = cardPaid && row.payment_card
      ? rowForYear(data.finance_rows, row.payment_card, Number(entry.date.slice(0, 4)), data)
      : undefined;
    const link = cardPayment
      ? linksByMonth.get(`${row.id}:${entry.date.slice(0, 7)}`)
      : undefined;
    const statement = link ? statementsById.get(link.statement_id) : undefined;
    events.push({
      id: `ledger:${entry.id}`,
      name: row.name,
      date: entry.date,
      amount: entry.amount,
      currency: "TRY",
      source: "ledger",
      row_id: row.id,
      provider_row_id: row.origin_row || row.id,
      card_row_id: paymentCard?.id || "",
      card_paid: cardPaid,
      payment_tag: entry.payment_tag || "",
      card_name: paymentCard?.name || "",
      settled_date: entry.settled_date || "",
      ...(statement && statement.period === entry.date.slice(0, 7)
        ? {
            statement_id: statement.id,
            statement_period: statement.period,
            card_name: row.name,
          }
        : {}),
      status: entry.status,
      kind: row.is_auto_carryover ? "carryover" : cardPayment ? "card_payment" : "expense",
      category: "other",
      bill: !cardPayment && !!row.bill_type,
      bill_type: !cardPayment ? row.bill_type || "" : "",
      counts_as_expense: !cardPayment && !row.is_auto_carryover,
      payment_record_id: entry.source_payment || "",
      notes: entry.notes || "",
    });
  }
  for (const bill of data.manual_bills || []) {
    let values;
    try {
      values = require("./manual-bills.js").validate(bill);
    } catch {
      continue;
    }
    events.push({
      id: `bill:${bill.id}`,
      manual_bill_id: bill.id,
      ...values,
      source: "manual_bill",
      kind: "expense",
      counts_as_expense: true,
      bill: true,
    });
  }
  const expenseFlags = new Map(
    events.map((event) => [event.id, event.counts_as_expense]),
  );
  require("./budget-matching.js").applyMatches(events, data);
  events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  if (trackingOnly) {
    const hiddenEvents = new Set(
      events
        .filter(
          (event) =>
            event.source === "statement" &&
            hiddenStatements.has(event.statement_id),
        )
        .map((event) => event.id),
    );
    // A hidden PDF must not also hide a verified Excel/manual entry.
    for (const event of events) {
      if (!hiddenEvents.has(event.duplicate_of)) continue;
      delete event.duplicate_of;
      event.counts_as_expense = expenseFlags.get(event.id);
    }
    return {
      statement_months: statementMonths,
      events: events.filter((event) => !hiddenEvents.has(event.id)),
      installments: installments.filter(
        (plan) => !hiddenStatements.has(plan.statement_id),
      ),
      issues: issues.filter(
        (issue) => !hiddenStatements.has(issue.statement_id),
      ),
      unmatched_installments: unmatchedInstallments.filter(
        (id) => !hiddenStatements.has(id),
      ),
      calendar_moves: data.calendar_moves || [],
      tracked_statements_count:
        data.bank_statements.length - hiddenStatements.size,
      imported_payments_count: (data.payment_records || []).filter(
        isStatementPayment,
      ).length,
      loans,
    };
  }
  return {
    statement_months: statementMonths,
    events,
    installments,
    issues,
    unmatched_installments: unmatchedInstallments,
    loans,
    ...(data.calendar_moves?.length
      ? { calendar_moves: data.calendar_moves }
      : {}),
  };
}
module.exports = { spendingData, isBill };
