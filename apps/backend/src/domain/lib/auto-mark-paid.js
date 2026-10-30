// Compatibility entry point for the fallback cron. Every due occurrence is
// saved; only subscriptions opted into automatic confirmation become paid.
function markDuePaymentsPaid(app, todayStr) {
  return require("./subscription-schedule.js").advanceDueSubscriptions(
    app,
    todayStr,
  );
}
module.exports = { markDuePaymentsPaid };
