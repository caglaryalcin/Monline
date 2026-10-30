function validInstallment(value) {
  if (!value.includes("/")) return true;
  const ratio = value.match(/^\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*$/);
  return (
    !!ratio && Number(ratio[1]) > 0 && Number(ratio[1]) <= Number(ratio[2])
  );
}
function sourceAmountSafe(row) {
  if (row.amount_issue != null) return false;
  if (row.amount_confirmed != null && typeof row.amount_confirmed !== "boolean")
    return false;
  if (row.amount_confirmed || !row.source) return true;
  if (/\d\s*\/\s*\d+[,.]\d{2}/.test(row.source)) return false;
  const ratios = [
    ...row.source.matchAll(/(?:^|\s)(\d{1,3})\s*\/\s*(\d{1,3})(?=\s|\)|$)/g),
  ];
  if (
    ratios.length > 1 ||
    ratios.some(
      (match) => Number(match[1]) < 1 || Number(match[1]) > Number(match[2]),
    )
  )
    return false;
  if (row.installment && row.currency === "TRY") {
    const totals = [
      ...row.source.matchAll(
        /\((\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})\s*(?:TL|TRY|₺)\)/gi,
      ),
    ];
    if (
      totals.length === 1 &&
      row.amount > Number(totals[0][1].replace(/\./g, "").replace(",", "."))
    )
      return false;
  }
  // Independently compare an explicit final amount column with the submitted
  // amount. A deliberate correction retains the source and amount_confirmed.
  const source = row.source
    .replace(/\bAnapara\s*:.*$/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/(?:^|\s)\d{1,3}\s*\/\s*\d{1,3}(?=\s|$)/g, " ");
  const terminalCurrency = source.match(/\d[,.]\d{2}\s*([A-Z]{3})\s*$/);
  if (
    terminalCurrency &&
    !["TRY", "USD", "EUR", "GBP"].includes(terminalCurrency[1])
  )
    return false;
  if (
    /[‐‑‒–—﹣－＋]\s*\d[\d., \u00a0\u202f\u2007]*\s*(?:TRY|TL|₺|USD|EUR|GBP)\s*$/i.test(
      source,
    )
  )
    return false;
  const number = String.raw`(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d{1,3}(?:[ \u00a0\u202f\u2007]\d{3})+[,.]\d{2}|\d+[,.]\d{2})`;
  const tail = source.match(
    new RegExp(
      String.raw`(?:^|\s)[+−-]?\s*(${number})\s*(TRY|TL|₺|USD|EUR|GBP|\$|€|£)\s*[+−-]?\s*(?:A|ALACAK)?\s*$`,
      "i",
    ),
  );
  if (tail) {
    const parts = tail[1].replace(/[ \u00a0\u202f\u2007]/g, "");
    const amount =
      Number(parts.slice(0, -3).replace(/[.,]/g, "")) +
      Number(parts.slice(-2)) / 100;
    const code = tail[2].toUpperCase();
    const currency = ["TL", "₺"].includes(code)
      ? "TRY"
      : code === "$"
        ? "USD"
        : code === "€"
          ? "EUR"
          : code === "£"
            ? "GBP"
            : code;
    if (
      Math.round(amount * 100) !== Math.round(row.amount * 100) ||
      currency !== row.currency
    )
      return false;
  }
  return true;
}

function unitemizedFees(transactions, summary = {}, excluded = []) {
  return require("./pure/statement-accounting.mjs").statementUnitemizedFees(transactions, summary, excluded);
}
function reconciliation(transactions, summary = {}, bank = "") {
  return require("./pure/statement-accounting.mjs").reconcileStatement(transactions, summary, bank);
}
function inspectAccounting(transactions, summary = {}, bank = "", context = {}) {
  return require("./pure/statement-accounting.mjs").inspectStatementAccounting(transactions, summary, bank, context);
}
module.exports = {
  validInstallment,
  sourceAmountSafe,
  reconciliation,
  inspectAccounting,
  unitemizedFees,
};
