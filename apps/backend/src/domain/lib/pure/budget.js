const { spendingData, isBill } = require("./spending.js");
const { rowsForYear } = require("./finance-years.js");
const {
  applyMatches,
  eventId,
  subscriptionEvent,
} = require("./budget-matching.js");
const { advanceDate } = require("../date-helpers.js");
const { occurrenceIsAllowed } = require("./subscription-limits.js");
const cents = (value) => Math.round(value * 100);
function totals(events) {
  const result = new Map();
  for (const event of events)
    result.set(
      event.currency,
      (result.get(event.currency) || 0) + cents(event.amount),
    );
  return [...result]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) => ({ currency, amount: value / 100 }));
}
function category(event) {
  if (event.budget_category) return event.budget_category;
  if (event.bill) return "bills";
  if (event.installment) return "installments";
  if (event.category === "digital" || event.source === "subscription")
    return "online";
  return "other";
}
function budgetData(data, month, today) {
  const spending = spendingData(data);
  const events = spending.events;
  const rows = new Map(data.finance_rows.map((row) => [row.id, row]));
  const currencies = new Map(
    (data.currencies || []).map((row) => [row.id, row.code]),
  );
  const methods = new Map(
    (data.payment_methods || []).map((row) => [row.id, row]),
  );
  const subs = new Map((data.subscriptions || []).map((row) => [row.id, row]));
  const cycles = new Map((data.cycles || []).map((row) => [row.id, row.name]));
  const records = data.payment_records || [];
  const subscriptionCategory = (sub) => {
    const category = (data.categories || []).find(
      (category) => category.id === sub.category,
    );
    if (sub.payment_limit > 1) return "installments";
    if (isBill(sub.name) || category?.translation_key === "statement_bills")
      return "bills";
    if (
      sub.statement_imported ||
      category?.translation_key === "statement_digital" ||
      /digital|dijital|subscription|abonnements/i.test(category?.name || "") ||
      /\b(netflix|spotify|disney|youtube|icloud|google|chatgpt|openai|claude|amazon prime|microsoft|adobe|github|dropbox|canva|exxen|blutv|mubi)\b/i.test(
        sub.name,
      )
    )
      return "online";
    return "other";
  };
  for (const record of records) {
    const sub = subs.get(record.subscription_id);
    const event = subscriptionEvent(record, data);
    if (!event || !(record.amount >= 0)) continue;
    events.push({
      ...event,
      bill: isBill(event.name),
      budget_category: subscriptionCategory({
        ...sub,
        name: event.name,
        category: record.category || sub?.category,
      }),
    });
  }
  // Future expectations are read-only. Past payments are never invented.
  if (month >= today.slice(0, 7))
    for (const sub of subs.values()) {
      if (
        sub.record_type === "credit" ||
        sub.calendar_projection_hidden ||
        sub.inactive ||
        !sub.auto_renew ||
        !currencies.has(sub.currency)
      )
        continue;
      const cycle = cycles.get(sub.cycle),
        frequency = Number(sub.frequency) || 1;
      if (
        ![
          "Daily",
          "Weekly",
          "Monthly",
          "Quarterly",
          "Half-Yearly",
          "Yearly",
        ].includes(cycle)
      )
        continue;
      let date = String(sub.next_payment || "").slice(0, 10),
        index = sub.payments_completed || 0;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const anchor = sub.billing_anchor_day || Number(date.slice(8, 10));
      for (
        let guard = 0;
        guard < 5000 && date.slice(0, 7) <= month;
        guard++, index++
      ) {
        if (!occurrenceIsAllowed(date, sub.end_date, index, sub.payment_limit))
          break;
        if (
          date.startsWith(month) &&
          !records.some(
            (record) =>
              record.subscription_id === sub.id &&
              (record.due_date.slice(0, 10) === date ||
                record.scheduled_date === date),
          )
        ) {
          const card = rows.get(methods.get(sub.payment_method)?.finance_card);
          events.push({
            id: `forecast:${sub.id}:${date}`,
            name: sub.name,
            date,
            amount: sub.price,
            currency: currencies.get(sub.currency),
            source: "subscription",
            kind: "expense",
            status: "planned",
            counts_as_expense: true,
            bill: isBill(sub.name),
            card_row_id: card?.id || "",
            card_name: card?.name || "",
            forecast: true,
            budget_category: subscriptionCategory(sub),
          });
        }
        const next = advanceDate(
          new Date(`${date}T12:00:00Z`),
          cycle,
          frequency,
          anchor,
        )
          .toISOString()
          .slice(0, 10);
        if (next <= date) break;
        date = next;
      }
    }
  // Existing subscription imports already carry source provenance. Use it only
  // when the selected statement amounts exactly cover this payment.
  const provenanceConflicts = [];
  const claimed = new Set();
  for (const record of records) {
    if (
      !record.paid_at ||
      !Array.isArray(record.statement_sources) ||
      !record.statement_sources.length
    )
      continue;
    const target = events.find(
      (event) => event.id === eventId("payment_records", record.id),
    );
    if (!target) continue;
    const sources = events.filter(
      (event) =>
        event.source_key && record.statement_sources.includes(event.source_key),
    );
    const valid =
      sources.length === new Set(record.statement_sources).size &&
      sources.every(
        (source) =>
          source.kind === "expense" &&
          source.currency === target.currency &&
          !claimed.has(source.id),
      ) &&
      sources.reduce((sum, source) => sum + cents(source.amount), 0) ===
        cents(target.amount);
    if (!valid) {
      provenanceConflicts.push(target.id);
      target.verification = "changed";
      continue;
    }
    target.counts_as_expense = false;
    target.duplicate_of = sources[0].id;
    target.verification = "verified";
    target.verified_statement_id = sources[0].statement_id;
    for (const source of sources) {
      claimed.add(source.id);
      source.verification = "verified";
      source.verified_target_name = target.name;
      source.verified_target_id = target.id;
      source.budget_category = category(target);
    }
  }
  // An explicit ledger payment reference also represents one underlying payment.
  for (const event of events.filter(
    (event) => event.source === "ledger" && event.payment_record_id,
  )) {
    const source = events.find(
      (item) => item.id === eventId("payment_records", event.payment_record_id),
    );
    if (
      source &&
      source.currency === event.currency &&
      cents(source.amount) === cents(event.amount)
    ) {
      event.duplicate_of = source.id;
      event.counts_as_expense = false;
    }
  }
  const conflicts = [
    ...new Set([...applyMatches(events, data), ...provenanceConflicts]),
  ];
  // Similar manual entries require a decision before publishing a definitive
  // total. Candidates are never merged or marked paid automatically.
  const normalize = (value) =>
    String(value)
      .normalize("NFKD")
      .replace(/ı/g, "i")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  for (const target of events.filter(
    (event) =>
      event.source !== "statement" &&
      event.kind === "expense" &&
      !event.duplicate_of &&
      !event.forecast,
  )) {
    const words = normalize(target.name)
      .split(" ")
      .filter(
        (word) =>
          word.length >= 4 &&
          !["fatura", "faturasi", "odeme", "payment", "gider"].includes(word),
      );
    if (
      events.some(
        (source) =>
          source.source === "statement" &&
          !source.verified_target_id &&
          !target.separations?.some(
            (decision) => decision.valid && decision.source_id === source.id,
          ) &&
          require("./budget-matching.js").compatible(target, source) &&
          (target.card_row_id ||
            words.some((word) =>
              normalize(source.name).split(" ").includes(word),
            )),
      )
    ) {
      target.possible_duplicate = true;
      if (target.date.startsWith(month)) conflicts.push(target.id);
    }
  }
  const period = (event) =>
    event.installment && event.statement_period
      ? event.statement_period
      : event.undated
        ? event.statement_period
        : event.date.slice(0, 7);
  const isCash = (event) =>
    event.source !== "statement" &&
    event.source !== "manual_card" &&
    !event.card_row_id &&
    !event.card_paid &&
    !event.duplicate_of &&
    event.kind !== "carryover";
  const cashDate = (event) => event.settled_date || event.date;
  const relevant = (event) =>
    event && (period(event) === month || cashDate(event).startsWith(month));
  const scopedConflicts = conflicts.filter((id) => {
    const match = (data.budget_matches || []).find((match) => match.id === id);
    return (
      relevant(events.find((event) => event.id === id)) ||
      (match &&
        (relevant(
          events.find(
            (event) => event.id === eventId(match.target_type, match.target_id),
          ),
        ) ||
          relevant(
            events.find(
              (event) =>
                event.id ===
                `statement:${match.statement_id}:${match.transaction_id}`,
            ),
          )))
    );
  });
  const scopedIssues = spending.issues.filter((issue) =>
    data.bank_statements.some(
      (statement) =>
        statement.id === issue.statement_id && statement.period === month,
    ),
  );
  const cash = events.filter(
    (event) =>
      isCash(event) &&
      event.status === "settled" &&
      cashDate(event).startsWith(month),
  );
  const selected = events.filter((event) => period(event) === month);
  const actual = selected.filter(
    (event) => event.counts_as_expense && event.status !== "planned",
  );
  const plan = selected.filter(
    (event) =>
      event.status === "planned" &&
      !event.duplicate_of &&
      event.kind !== "carryover",
  );
  const income = data.finance_entries.filter(
    (entry) =>
      rows.get(entry.row_id)?.kind !== "expense" &&
      rows.has(entry.row_id) &&
      entry.status === "settled",
  );
  const incomeDate = (entry) => entry.settled_date || entry.date;
  const received =
    income
      .filter((entry) => incomeDate(entry).startsWith(month))
      .reduce((sum, entry) => sum + cents(entry.amount), 0) / 100;
  const carry = events.filter(
    (event) => event.kind === "carryover" && event.date.slice(0, 7) <= month,
  );
  const openingMonth =
    carry
      .map((event) => event.date.slice(0, 7))
      .sort()
      .at(-1) ||
    [
      ...income.map(incomeDate),
      ...events
        .filter(
          (event) =>
            isCash(event) &&
            event.status === "settled" &&
            event.currency === "TRY",
        )
        .map(cashDate),
    ]
      .map((date) => date.slice(0, 7))
      .filter((date) => date <= month)
      .sort()[0];
  let opening = 0;
  if (openingMonth) {
    opening -= carry
      .filter((event) => event.date.startsWith(openingMonth))
      .reduce((sum, event) => sum + cents(event.amount), 0);
    opening += income
      .filter(
        (entry) =>
          incomeDate(entry).slice(0, 7) >= openingMonth &&
          incomeDate(entry).slice(0, 7) < month,
      )
      .reduce((sum, entry) => sum + cents(entry.amount), 0);
    opening -= events
      .filter(
        (event) =>
          isCash(event) &&
          event.currency === "TRY" &&
          event.status === "settled" &&
          cashDate(event).slice(0, 7) >= openingMonth &&
          cashDate(event).slice(0, 7) < month,
      )
      .reduce((sum, event) => sum + cents(event.amount), 0);
  }
  // Kept in the response for older clients; ledger row types no longer define installment plans.
  const installments = [];
  const cards = rowsForYear(data.finance_rows, Number(month.slice(0, 4)), data)
    .filter((row) => row.expense_type === "credit_card")
    .map((row) => {
      const link = data.finance_statement_links.find(
        (link) => link.row_id === row.id && link.month === month,
      );
      const statement = data.bank_statements.find(
        (statement) => statement.id === link?.statement_id,
      );
      const payments = data.finance_entries.filter(
        (entry) => entry.row_id === row.id && entry.date.startsWith(month),
      );
      const paid =
        payments
          .filter((entry) => entry.status === "settled")
          .reduce((sum, entry) => sum + cents(entry.amount), 0) / 100;
      const balance = statement?.summary?.balance;
      return {
        row_id: row.id,
        name: row.name,
        statement_id: statement?.id || "",
        balance: typeof balance === "number" ? balance : null,
        paid,
        remaining:
          typeof balance === "number"
            ? Math.max(0, cents(balance) - cents(paid)) / 100
            : null,
        overpaid:
          typeof balance === "number"
            ? Math.max(0, cents(paid) - cents(balance)) / 100
            : 0,
      };
    });
  return {
    month,
    received,
    opening: opening / 100,
    cash: totals(cash),
    expenses: totals(actual),
    planned: totals(plan),
    cash_planned: totals(plan.filter(isCash)),
    breakdown: ["online", "bills", "installments", "fixed", "other"].map(
      (key) => ({
        category: key,
        totals: totals(actual.filter((event) => category(event) === key)),
      }),
    ),
    events: selected.map((event) => ({
      ...event,
      budget_category: category(event),
    })),
    targets: events.filter(
      (event) =>
        relevant(event) &&
        event.source !== "statement" &&
        event.kind === "expense" &&
        !event.forecast,
    ),
    statements: events.filter(
      (event) =>
        event.source === "statement" &&
        event.kind === "expense" &&
        !event.undated &&
        (event.date.startsWith(month) || event.statement_period === month),
    ),
    installments,
    card_installments: spending.installments.filter(
      (plan) => plan.period === month,
    ),
    cards,
    review_required: scopedConflicts.length > 0 || scopedIssues.length > 0,
    conflicts: scopedConflicts,
    issues: scopedIssues,
  };
}
module.exports = { budgetData, category, totals };
