const { onRecordUpdate } = require("../runtime.cjs");
const { formatLocalDate } = require("./lib/date-helpers.js");
const { latestImportedPayment } = require("./lib/statement-schedule.js");
const {
  nextStatementPayment,
} = require("./lib/pure/statement-payment-date.js");

onRecordUpdate((event) => {
  const subscription = event.record;
  const today = formatLocalDate(new Date());
  if (
    subscription.original().getBool("inactive") &&
    !subscription.getBool("inactive") &&
    subscription.getString("record_type") !== "credit" &&
    subscription.getString("next_payment").slice(0, 10) <= today &&
    !/youtube\s*super/i.test(subscription.getString("name"))
  ) {
    const payments = event.app.findRecordsByFilter(
      "payment_records",
      "subscription_id = {:id}",
      "",
      0,
      0,
      { id: subscription.id },
    );
    const latest = latestImportedPayment(payments, subscription);
    if (latest)
      subscription.set("next_payment", nextStatementPayment(latest, today));
  }
  event.next();
}, "subscriptions");
