import { validStatementInstallment } from "./statementAmounts";
import { STATEMENT_CATEGORIES } from "./statementCategories";
import { type ReviewTransaction, validStatementDate } from "./statements";

export function invalidReviewFields(row: ReviewTransaction) {
  const fields: string[] = [];
  if (!validStatementDate(row.date)) fields.push("statement_date");
  if (!row.merchant.trim() || row.merchant.length > 250) fields.push("statement_merchant");
  if (!validStatementInstallment(row.installment)) fields.push("statement_installment");
  if (row.subscription_service && row.subscription_service.length > 120)
    fields.push("statement_subscription");
  if (!row.category || !STATEMENT_CATEGORIES.includes(row.category)) fields.push("statement_category");
  if (!["TRY", "USD", "EUR", "GBP"].includes(row.currency)) fields.push("statement_currency");
  if (row.amount_issue || !Number.isFinite(row.amount) || row.amount < 0 ||
    row.amount > 100000000 ||
    Math.abs(row.amount * 100 - Math.round(row.amount * 100)) >= 0.00001)
    fields.push(row.amount_issue ? `statement_amount_issue_${row.amount_issue}` : "statement_amount");
  return fields;
}

export function validReviewRow(row: ReviewTransaction) {
  return invalidReviewFields(row).length === 0;
}

