// Null inherits the account's default schedule; an array replaces it for this subscription.
function validateSubscriptionReminders(raw) {
  let reminders = raw;
  if (typeof reminders === "string") {
    try {
      reminders = JSON.parse(reminders);
    } catch {
      throw new Error("subscription_reminders_invalid");
    }
  }
  if (reminders == null) return null;
  if (
    !Array.isArray(reminders) ||
    reminders.length < 1 ||
    reminders.length > 12
  )
    throw new Error("subscription_reminders_invalid");
  const slots = new Map();
  for (const slot of reminders) {
    if (
      !slot ||
      !Number.isInteger(slot.days) ||
      slot.days < 0 ||
      slot.days > 365 ||
      !Number.isInteger(slot.hour) ||
      slot.hour < 0 ||
      slot.hour > 23
    )
      throw new Error("subscription_reminders_invalid");
    slots.set(`${slot.days}:${slot.hour}`, {
      days: slot.days,
      hour: slot.hour,
    });
  }
  return [...slots.values()];
}

// Group by slot so custom and inherited schedules share batching and deduplication.
function groupSubscriptionReminderSlots(subscriptions, defaults, hour) {
  const groups = new Map();
  for (const subscription of subscriptions) {
    let reminders = defaults;
    try {
      reminders =
        validateSubscriptionReminders(
          subscription.get("notification_reminders"),
        ) ?? defaults;
    } catch {
      // Keep older or externally restored records on the default schedule.
    }
    const seen = new Set();
    for (const reminder of reminders) {
      if (reminder.hour !== hour) continue;
      const key = `${reminder.days}:${reminder.hour}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!groups.has(key)) groups.set(key, { ...reminder, subscriptions: [] });
      groups.get(key).subscriptions.push(subscription);
    }
  }
  return [...groups.values()];
}

module.exports = {
  validateSubscriptionReminders,
  groupSubscriptionReminderSlots,
};
