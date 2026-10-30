function isStatementPayment(payment) {
  return (
    (Array.isArray(payment.statement_sources) &&
      payment.statement_sources.some(
        (source) =>
          typeof source === "string" &&
          source.startsWith("[monline-statement:"),
      )) ||
    /\[monline-statement(?:-backfill)?:/.test(payment.notes || "")
  );
}
module.exports = { isStatementPayment };
