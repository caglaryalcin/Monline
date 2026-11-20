function normalizeBank(value) {
  const name = typeof value === "string" ? value.trim() : "";
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  return { enpara: "enpara", denizbank: "denizbank", garanti: "garanti", garantibbva: "garanti" }[key] || name;
}
function validate(value) {
  const network = value?.network ?? "";
  if (!["", "visa", "mastercard"].includes(network)) throw new Error("credit_cards_invalid");
  const statementDay = value?.statement_day ?? 0;
  const adjustWeekend = value?.statement_weekend_adjust ?? false;
  if (!Number.isInteger(statementDay) || statementDay < 0 || statementDay > 31 || typeof adjustWeekend !== "boolean")
    throw new Error("credit_cards_invalid_statement_day");
  if (!value || typeof value.bank !== "string" || !value.bank.trim() || value.bank.trim().length > 80 ||
      typeof value.name !== "string" || value.name.trim().length > 80 ||
      typeof value.last_four !== "string" || !/^\d{4}$/.test(value.last_four) ||
      typeof value.expiry !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value.expiry))
    throw new Error("credit_cards_invalid");
  return { bank: normalizeBank(value.bank), name: value.name.trim(), last_four: value.last_four, expiry: value.expiry,
    statement_day: statementDay, statement_weekend_adjust: adjustWeekend, network };
}
module.exports = { normalizeBank, validate };
