const { Record, cronAdd, repository } = require("../runtime.cjs");
const domainPath = __dirname;
// ================================================================
// CRON 1: Update Next Payment Dates
cronAdd("updateNextPayment", "0 0 * * *", () => {
  const dateHelpers = require(domainPath + "/lib/date-helpers.js");
  const schedule = require(domainPath + "/lib/subscription-schedule.js");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const processed = schedule.advanceDueSubscriptions(
    repository,
    dateHelpers.formatLocalDate(today),
  );
  console.log(
    "[Monline] updateNextPayment: processed " + processed + " subscriptions",
  );
});

// ================================================================
// CRON 4: Send Payment Notifications (hourly, granular reminders)
// ================================================================
cronAdd("sendNotifications", "0 * * * *", async () => {
  const dateHelpers = require(domainPath + "/lib/date-helpers.js");
  const recordTypes = require(domainPath + "/lib/pure/record-types.js");
  const { normalizeReminderSlots } = require(
    domainPath + "/lib/pure/reminder-slots.js",
  );
  const notifHelpers = require(domainPath + "/lib/notifications.js");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentHour = now.getHours();
  const todayStr = dateHelpers.formatLocalDate(today);

  // Cleanup old notification_log entries once a day at midnight
  if (currentHour === 0) {
    try {
      const cutoff = new Date(today.getTime());
      cutoff.setDate(cutoff.getDate() - 31);
      const cutoffStr = dateHelpers.formatLocalDate(cutoff);
      const oldLogs = repository.findRecordsByFilter(
        "notification_log",
        "sent_date < {:cutoff}",
        "",
        0,
        0,
        {
          cutoff: cutoffStr,
        },
      );
      for (const log of oldLogs) repository.delete(log);
    } catch (e) {
      console.log("[Monline] log cleanup error:", e);
    }
  }
  const users = repository.findRecordsByFilter("users", "1=1", "", 0, 0);
  for (const user of users) {
    const userId = user.id;
    const configs = repository.findRecordsByFilter(
      "notifications_config",
      "user = {:userId}",
      "",
      1,
      0,
      {
        userId: userId,
      },
    );
    if (configs.length === 0) continue;
    const notifConfig =
      require("../server-config.cjs").effectiveNotificationConfig(
        repository,
        userId,
        configs[0],
      );

    // Parse reminders array — default to [{days:3, hour:8}] if absent
    let reminders = [
      {
        days: 3,
        hour: 8,
      },
    ];
    try {
      reminders = normalizeReminderSlots(notifConfig.get("reminders"));
    } catch (_) {}

    // Only process slots that fire at the current hour
    const dueReminders = reminders.filter(
      (r) => Number(r.hour) === currentHour,
    );
    if (dueReminders.length === 0) continue;
    const subs = repository.findRecordsByFilter(
      "subscriptions",
      "user = {:userId} && notify = true && inactive = false",
      "",
      0,
      0,
      {
        userId: userId,
      },
    );
    if (subs.length === 0) continue;
    for (const reminder of dueReminders) {
      const days = Number(reminder.days);
      if (!isFinite(days)) continue;
      // target: subscriptions whose next_payment is exactly `days` days from now
      const targetDate = new Date(today.getTime());
      targetDate.setDate(targetDate.getDate() + days);
      const targetDateStr = dateHelpers.formatLocalDate(targetDate);
      const reminderKey = days + "d_" + currentHour + "h";
      const grouped = {};
      for (const sub of subs) {
        if (!recordTypes.isExpense(sub.get("record_type"))) continue;
        const nextPayment = sub.getString("next_payment").slice(0, 10);
        if (nextPayment !== targetDateStr) continue;

        // Dedup: skip if already sent for this slot today
        try {
          const existing = repository.findRecordsByFilter(
            "notification_log",
            "subscription_id = {:sid} && user_id = {:uid} && reminder_key = {:key} && sent_date = {:date}",
            "",
            1,
            0,
            {
              sid: sub.id,
              uid: userId,
              key: reminderKey,
              date: todayStr,
            },
          );
          if (existing.length > 0) continue;
        } catch (_) {}
        const payerId = sub.getString("payer") || "default";
        if (!grouped[payerId]) grouped[payerId] = [];
        let currencySymbol = "";
        let currencyCode = "";
        try {
          const cur = repository.findRecordById(
            "currencies",
            sub.getString("currency"),
          );
          currencySymbol = cur.getString("symbol");
          currencyCode = cur.getString("code");
        } catch (_) {}
        grouped[payerId].push({
          id: sub.id,
          name: sub.getString("name"),
          price: sub.get("price"),
          currency: currencySymbol,
          currency_code: currencyCode,
          next_payment: nextPayment,
        });
      }
      if (Object.keys(grouped).length === 0) continue;
      const logCol = repository.findCollectionByNameOrId("notification_log");
      for (const payerId in grouped) {
        const subList = grouped[payerId];
        let payerName = "";
        if (payerId !== "default") {
          try {
            const payer = repository.findRecordById("household", payerId);
            payerName = payer.getString("name");
          } catch (_) {}
        }
        const { title, message } =
          require("../notification-language.cjs").reminderContext({
            event: "payment",
            language: notifConfig.getString("language"),
            payer: payerName,
            days,
            subscriptions: subList,
          });
        await notifHelpers.dispatchToAllProviders(
          repository,
          notifConfig,
          title,
          message,
          subList,
          { event: "payment", payer: payerName, days },
        );

        // Log each sent subscription so we don't re-send
        for (const sub of subList) {
          try {
            const log = new Record(logCol);
            log.set("subscription_id", sub.id);
            log.set("user_id", userId);
            log.set("reminder_key", reminderKey);
            log.set("sent_date", todayStr);
            repository.save(log);
          } catch (e) {
            console.log("[Monline] log write error:", e);
          }
        }
      }
    }
  }
  console.log("[Monline] sendNotifications: completed for hour " + currentHour);
});

// ================================================================
// CRON 5: Send Cancellation Notifications (hourly, granular reminders)
// ================================================================
cronAdd("sendCancellationNotifications", "0 * * * *", async () => {
  const dateHelpers = require(domainPath + "/lib/date-helpers.js");
  const recordTypes = require(domainPath + "/lib/pure/record-types.js");
  const { normalizeReminderSlots } = require(
    domainPath + "/lib/pure/reminder-slots.js",
  );
  const notifHelpers = require(domainPath + "/lib/notifications.js");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentHour = now.getHours();
  const todayStr = dateHelpers.formatLocalDate(today);
  const allSubs = repository.findRecordsByFilter(
    "subscriptions",
    "cancellation_date != '' && inactive = false",
    "",
    0,
    0,
  );

  // Group by user
  const byUser = {};
  for (const sub of allSubs) {
    if (!recordTypes.isExpense(sub.get("record_type"))) continue;
    const uid = sub.getString("user");
    if (!byUser[uid]) byUser[uid] = [];
    byUser[uid].push(sub);
  }
  for (const userId in byUser) {
    const configs = repository.findRecordsByFilter(
      "notifications_config",
      "user = {:userId}",
      "",
      1,
      0,
      {
        userId: userId,
      },
    );
    if (configs.length === 0) continue;
    const notifConfig =
      require("../server-config.cjs").effectiveNotificationConfig(
        repository,
        userId,
        configs[0],
      );
    let reminders = [
      {
        days: 3,
        hour: 8,
      },
    ];
    try {
      reminders = normalizeReminderSlots(notifConfig.get("reminders"));
    } catch (_) {}
    const dueReminders = reminders.filter(
      (r) => Number(r.hour) === currentHour,
    );
    if (dueReminders.length === 0) continue;
    for (const reminder of dueReminders) {
      const days = Number(reminder.days);
      if (!isFinite(days)) continue;
      const targetDate = new Date(today.getTime());
      targetDate.setDate(targetDate.getDate() + days);
      const targetDateStr = dateHelpers.formatLocalDate(targetDate);
      const reminderKey = "cancel_" + days + "d_" + currentHour + "h";
      const dueSubs = [];
      for (const sub of byUser[userId]) {
        const cancelDate = sub.getString("cancellation_date").slice(0, 10);
        if (cancelDate !== targetDateStr) continue;
        try {
          const existing = repository.findRecordsByFilter(
            "notification_log",
            "subscription_id = {:sid} && user_id = {:uid} && reminder_key = {:key} && sent_date = {:date}",
            "",
            1,
            0,
            {
              sid: sub.id,
              uid: userId,
              key: reminderKey,
              date: todayStr,
            },
          );
          if (existing.length > 0) continue;
        } catch (_) {}
        dueSubs.push({
          id: sub.id,
          name: sub.getString("name"),
          cancellation_date: cancelDate,
        });
      }
      if (dueSubs.length === 0) continue;
      const { title, message } =
        require("../notification-language.cjs").reminderContext({
          event: "cancellation",
          language: notifConfig.getString("language"),
          days,
          subscriptions: dueSubs,
        });
      await notifHelpers.dispatchToAllProviders(
        repository,
        notifConfig,
        title,
        message,
        dueSubs,
        { event: "cancellation", days },
      );
      const logCol = repository.findCollectionByNameOrId("notification_log");
      for (const sub of dueSubs) {
        try {
          const log = new Record(logCol);
          log.set("subscription_id", sub.id);
          log.set("user_id", userId);
          log.set("reminder_key", reminderKey);
          log.set("sent_date", todayStr);
          repository.save(log);
        } catch (e) {
          console.log("[Monline] cancel log write error:", e);
        }
      }
    }
  }
  console.log(
    "[Monline] sendCancellationNotifications: completed for hour " +
      currentHour,
  );
});

// ================================================================
// CRON 7: Retry Due Payment Recording
// ================================================================
// Retry schedules that could not be saved at midnight. Recording and advancing
// share one transaction; only opted-in subscriptions are confirmed paid.
cronAdd("autoMarkPaid", "5 0 * * *", () => {
  const dateHelpers = require(domainPath + "/lib/date-helpers.js");
  const paymentTracking = require(domainPath + "/lib/auto-mark-paid.js");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = dateHelpers.formatLocalDate(today);
  const created = paymentTracking.markDuePaymentsPaid(repository, todayStr);
  console.log("[Monline] autoMarkPaid: processed " + created + " schedules");
});

// ================================================================
// CRON 8: Overdue Payment Reminders
// ================================================================
cronAdd("overduePaymentReminders", "0 9 * * *", async () => {
  const dateHelpers = require(domainPath + "/lib/date-helpers.js");
  const recordTypes = require(domainPath + "/lib/pure/record-types.js");
  const notifHelpers = require(domainPath + "/lib/notifications.js");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = dateHelpers.formatLocalDate(today);

  // Find active subscriptions whose next_payment is in the past
  const subs = repository.findRecordsByFilter(
    "subscriptions",
    "inactive = false && next_payment < {:today}",
    "",
    0,
    0,
    {
      today: todayStr,
    },
  );
  let notified = 0;
  for (const sub of subs) {
    if (!recordTypes.isExpense(sub.get("record_type"))) continue;
    const userId = sub.get("user");
    try {
      const user = repository.findRecordById("users", userId);
      if (!user.get("payment_tracking")) continue;
      const dueDate = sub.get("next_payment").split(" ")[0].split("T")[0];

      // Check if already paid
      const paid = repository.findRecordsByFilter(
        "payment_records",
        "subscription_id = {:sid} && due_date = {:date}",
        "",
        1,
        0,
        {
          sid: sub.id,
          date: dueDate,
        },
      );
      if (paid.length > 0) continue;

      // Check dedup in notification_log (don't send more than once per day)
      const reminderKey = "overdue_" + dueDate;
      const alreadySent = repository.findRecordsByFilter(
        "notification_log",
        "subscription_id = {:sid} && user_id = {:uid} && reminder_key = {:key} && sent_date = {:date}",
        "",
        1,
        0,
        {
          sid: sub.id,
          uid: userId,
          key: reminderKey,
          date: todayStr,
        },
      );
      if (alreadySent.length > 0) continue;

      // Get notification config
      let notifConfig;
      try {
        const configs = repository.findRecordsByFilter(
          "notifications_config",
          "user = {:uid}",
          "",
          1,
          0,
          {
            uid: userId,
          },
        );
        if (configs.length === 0) continue;
        notifConfig =
          require("../server-config.cjs").effectiveNotificationConfig(
            repository,
            userId,
            configs[0],
          );
      } catch (_) {
        continue;
      }
      const subName = sub.get("name");
      const price = sub.get("price");
      const title = "⚠️ Overdue Payment: " + subName;
      const message =
        "Payment of " +
        price +
        ' for "' +
        subName +
        '" was due on ' +
        dueDate +
        " and has not been recorded yet.";
      await notifHelpers.dispatchToAllProviders(
        repository,
        notifConfig,
        title,
        message,
      );

      // Log to prevent duplicate
      try {
        const logCol = repository.findCollectionByNameOrId("notification_log");
        const logRec = new Record(logCol);
        logRec.set("subscription_id", sub.id);
        logRec.set("user_id", userId);
        logRec.set("reminder_key", reminderKey);
        logRec.set("sent_date", todayStr);
        repository.save(logRec);
      } catch (e) {
        console.log("[Monline] overdue log write error:", e);
      }
      notified++;
    } catch (e) {
      console.log(
        "[Monline] overduePaymentReminders error for sub " + sub.id + ":",
        e,
      );
    }
  }
  console.log(
    "[Monline] overduePaymentReminders: notified " +
      notified +
      " overdue payments",
  );
});
