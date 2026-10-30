const { validDate } = require("./backfill-schedule.js");
const { BILL_TYPES, validBillType } = require("./bill-types.js");
const ROW_TAGS = ["", "salary", "credit_card", "loan", "rent", ...BILL_TYPES];
const SALARY_TAGS = ["", "job_change", "raise", "seniority_raise", "seniority_inflation_raise"];
function rowTag(row) {
  if (row.kind === "salary") return "salary";
  if (row.kind !== "expense") return "";
  return row.expense_type === "credit_card" ? "credit_card" : row.is_loan ? "loan" : row.is_rent ? "rent" : row.bill_type || "";
}
function rowTagValues(tag) {
  return {
    expense_type: tag === "credit_card" ? "credit_card" : "",
    is_loan: tag === "loan",
    is_rent: tag === "rent",
    bill_type: BILL_TYPES.includes(tag) ? tag : "",
    ...(tag === "credit_card" ? { payment_card: "" } : {}),
  };
}
const KINDS = ["salary", "income", "expense"];
const LEGACY_EXPENSE_TYPES = ["loan", "fixed", "bill", "other", "carryover"];
function normalizeExpenseType(value) {
  return LEGACY_EXPENSE_TYPES.includes(value) ? "" : value;
}
const COLLECTIONS = [
  "finance_rows",
  "finance_entries",
  "salary_history",
  "finance_benchmarks",
  "finance_card_transactions",
  "finance_statement_links",
];
function amount(value, allowZero = true) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= (allowZero ? 0 : 0.01) &&
    value <= 1e12 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.01
  );
}
function isCarryoverRow(row) {
  return row.kind === "expense" && row.is_auto_carryover === true;
}
function validate(name, value) {
  if (name === "finance_rows") {
    if (
      typeof value.name !== "string" ||
      !value.name.trim() ||
      value.name.length > 160 ||
      (value.year != null && value.year !== 0 && (!Number.isInteger(value.year) || value.year < 1970 || value.year > 2200)) ||
      (value.origin_row != null && value.origin_row !== "" && !/^[a-z0-9]{15}$/.test(value.origin_row)) ||
      (value.is_deleted != null && typeof value.is_deleted !== "boolean") ||
      !KINDS.includes(value.kind) ||
      (value.is_loan != null && typeof value.is_loan !== "boolean") ||
      (value.is_rent != null && typeof value.is_rent !== "boolean") ||
      (value.is_auto_carryover != null && typeof value.is_auto_carryover !== "boolean") ||
      (value.is_auto_carryover && (value.kind !== "expense" || value.expense_type === "credit_card" || value.is_loan || value.is_rent || value.bill_type || value.payment_card)) ||
      (value.is_rent && (value.kind !== "expense" || value.expense_type === "credit_card" || value.is_loan || value.bill_type)) ||
      (value.loan_id != null && value.loan_id !== "" && !/^[a-z0-9]{15}$/.test(value.loan_id)) ||
      (value.is_loan &&
        (value.kind !== "expense" ||
          value.expense_type === "credit_card" ||
          value.bill_type)) ||
      (value.row_order != null &&
        (!Number.isSafeInteger(value.row_order) ||
          value.row_order < 0 ||
          value.row_order > 1e9)) ||
      (value.expense_type != null &&
        !["", "credit_card"].includes(value.expense_type)) ||
      (value.expense_type && value.kind !== "expense") ||
      !validBillType(value.bill_type) ||
      (value.bill_type &&
        (value.kind !== "expense" || value.expense_type === "credit_card")) ||
      (value.payment_card != null &&
        value.payment_card !== "" &&
        !/^[a-z0-9]{15}$/.test(value.payment_card))
    )
      return "finance_invalid_row";
  } else if (name === "finance_statement_links") {
    if (
      !/^[a-z0-9]{15}$/.test(value.row_id) ||
      !/^[a-z0-9]{15}$/.test(value.statement_id) ||
      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value.month)
    )
      return "finance_invalid_statement_link";
  } else if (name === "finance_card_transactions") {
    if (
      !value.row_id ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) ||
      !validDate(value.date) ||
      !amount(value.amount, false) ||
      typeof value.merchant !== "string" ||
      !value.merchant.trim() ||
      value.merchant.length > 160
    )
      return "finance_invalid_card_transaction";
  } else if (name === "finance_entries") {
    if (
      !validDate(value.date) ||
      !amount(value.amount) ||
      !["planned", "settled"].includes(value.status) ||
      !value.row_id ||
      (value.status === "settled" && !validDate(value.settled_date)) ||
      (value.payment_tag != null &&
        !["", "credit_card", "direct"].includes(value.payment_tag)) ||
      (value.status === "planned" && value.settled_date)
    )
      return "finance_invalid_entry";
  } else if (name === "salary_history") {
    if (!validDate(value.effective_date) || !amount(value.amount, false))
      return "finance_invalid_salary";
  } else if (name === "finance_benchmarks") {
    if (
      (value.salary_tag != null && !SALARY_TAGS.includes(value.salary_tag)) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) ||
      ![value.usd, value.eur, value.minimum_wage].every(
        (n) =>
          typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1e12,
      ) ||
      (value.rate_date &&
        (!validDate(value.rate_date) ||
          value.rate_date.slice(0, 7) > value.month))
    )
      return "finance_invalid_benchmark";
  }
  if (
    value.notes != null &&
    (typeof value.notes !== "string" || value.notes.length > 2000)
  )
    return "finance_invalid_notes";
  return null;
}
// TCMB publishes on business days. A monthly rate is the last available rate
// on/before month end (or today for the current month), never a future rate.
function rateDates(month, today) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    !validDate(today) ||
    month > today.slice(0, 7)
  )
    return [];
  const [year, number] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
  const date = new Date((last < today ? last : today) + "T00:00:00Z");
  return Array.from({ length: 10 }, () => {
    const day = date.toISOString().slice(0, 10);
    date.setUTCDate(date.getUTCDate() - 1);
    return day;
  });
}
function parseRates(xml) {
  const get = (code) => {
    const block = xml.match(
      new RegExp(
        '<Currency\\b[^>]*CurrencyCode="' +
          code +
          '"[^>]*>([\\s\\S]*?)</Currency>',
      ),
    )?.[1];
    const price = Number(
      block?.match(/<ForexSelling>\s*([\d.]+)\s*<\/ForexSelling>/)?.[1],
    );
    return Number.isFinite(price) && price > 0 ? price : null;
  };
  const usd = get("USD"),
    eur = get("EUR");
  const published = xml.match(
    /<Tarih_Date\b[^>]*Date="(\d{2})\/(\d{2})\/(\d{4})"/,
  );
  return usd && eur && published
    ? { usd, eur, rate_date: `${published[3]}-${published[1]}-${published[2]}` }
    : null;
}
function minimumWage(html, date) {
  const raw = html.match(/const MINIMUM_WAGE_DATA\s*=\s*(\[[\s\S]*?\]);/)?.[1];
  if (!raw) return null;
  try {
    const records = JSON.parse(raw);
    const iso = (day) => day.split(".").reverse().join("-");
    const row = records.find((r) => {
      const [start, end] = String(r.period).split(" - ");
      return start && end && iso(start) <= date && iso(end) >= date;
    });
    return row && Number.isFinite(row.net) && row.net > 0
      ? row.net / (date < "2005-01-01" ? 1e6 : 1)
      : null;
  } catch {
    return null;
  }
}
module.exports = {
  amount,
  SALARY_TAGS,
  ROW_TAGS,
  rowTag,
  rowTagValues,
  isCarryoverRow,
  KINDS,
  LEGACY_EXPENSE_TYPES,
  normalizeExpenseType,
  COLLECTIONS,
  validate,
  rateDates,
  parseRates,
  minimumWage,
};
