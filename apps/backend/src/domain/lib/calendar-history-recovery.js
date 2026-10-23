const {
  iterateBackfillDates,
  validDate,
} = require("./pure/backfill-schedule.js");
const { buildPausedRanges } = require("./pure/subscription-history.js");
const { isExpense } = require("./pure/record-types.js");
const { saveScheduledPayment } = require("./scheduled-payments.js");

const RECOVERY_PASSES = 2;

/** Two idempotent upgrade passes per legacy subscription. The completion field
 * travels with backups, so later restarts/imports cannot resurrect deleted history.
 * Each subscription's records and pass marker commit in one transaction.
 */
function recoverCalendarHistory(app, today, userId = "") {
  if (!validDate(today)) throw new Error("Invalid recovery date");
  const result = { created: 0, processed: 0, failures: 0 };
  for (let pass = 0; pass < RECOVERY_PASSES; pass++) {
    const subs = app.findRecordsByFilter(
      "subscriptions",
      "calendar_history_recovery_passes < {:passes}" +
        (userId ? " && user = {:user}" : ""),
      "",
      0,
      0,
      { passes: RECOVERY_PASSES, user: userId },
    );
    for (const subscription of subs) {
      try {
        result.created += app.runInTransaction((tx) => {
          const sub = tx.findRecordById("subscriptions", subscription.id);
          const completed = Math.max(
            0,
            Math.floor(sub.getFloat("calendar_history_recovery_passes")),
          );
          if (completed >= RECOVERY_PASSES) return 0;
          let created = 0;
          if (
            !sub.getBool("inactive") &&
            isExpense(sub.getString("record_type"))
          ) {
            const next = sub.getString("next_payment").slice(0, 10);
            const ends = [
              today,
              sub.getString("end_date").slice(0, 10),
              sub.getString("cancellation_date").slice(0, 10),
            ].filter(Boolean);
            if (!sub.getBool("auto_renew")) ends.push(next);
            const existing = new Set(
              tx
                .findRecordsByFilter(
                  "payment_records",
                  "subscription_id = {:sub} && user = {:user}",
                  "",
                  0,
                  0,
                  { sub: sub.id, user: sub.getString("user") },
                )
                .flatMap((record) => [
                  record.getString("due_date").slice(0, 10),
                  record.getString("scheduled_date"),
                ]),
            );
            const history = tx
              .findRecordsByFilter(
                "subscription_history",
                "subscription_id = {:sub}",
                "effective_date,created",
                0,
                0,
                { sub: sub.id },
              )
              .map((record) => ({
                event_type: record.getString("event_type"),
                effective_date: record.getString("effective_date"),
              }));
            const pauses = buildPausedRanges(history);
            const cycle = tx
              .findRecordById("cycles", sub.getString("cycle"))
              .getString("name");
            const user = tx.findRecordById("users", sub.getString("user"));
            const notes = user.getString("language").startsWith("tr")
              ? "Sürüm geçişinde mevcut ödeme planından tamamlandı. Tutar tahminidir; ödendi bilgisi onaylanmadı."
              : "Recovered from the current billing schedule during upgrade. Amount is estimated; payment is not confirmed.";
            let elapsed = 0;
            const limit = Math.max(
              0,
              Math.floor(sub.getFloat("payment_limit")),
            );
            for (const date of iterateBackfillDates({
              start: sub.getString("start_date").slice(0, 10),
              anchorDate: next,
              billingAnchorDay: sub.getFloat("billing_anchor_day"),
              until: ends.sort()[0],
              cycle,
              frequency: sub.getFloat("frequency"),
            })) {
              if (
                pauses.some(
                  (range) =>
                    range.from <= date && (!range.to || date < range.to),
                )
              )
                continue;
              if (limit && elapsed >= limit) break;
              elapsed++;
              if (existing.has(date)) continue;
              if (saveScheduledPayment(tx, sub, date, false, { notes }))
                created++;
            }
          }
          tx.connection
            .prepare(
              "UPDATE subscriptions SET calendar_history_recovery_passes = ? WHERE id = ?",
            )
            .run(completed + 1, sub.id);
          return created;
        });
        result.processed++;
      } catch (error) {
        result.failures++;
        console.error(
          "[Monline] Calendar history recovery failed for subscription " +
            subscription.id,
          error.message,
        );
      }
    }
  }
  return result;
}

module.exports = { RECOVERY_PASSES, recoverCalendarHistory };
