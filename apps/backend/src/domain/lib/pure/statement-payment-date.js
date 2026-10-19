// Statement imports start their upcoming schedule next calendar month,
// independently of the statement's month/year or the recurring billing cycle.
function nextStatementPayment(date, today) {
  const day = Number(String(date).slice(8, 10));
  const [year, month] = String(today).slice(0, 10).split("-").map(Number);
  if (!day || !year || !month) throw new Error("statement_import_invalid");
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

module.exports = { nextStatementPayment };
