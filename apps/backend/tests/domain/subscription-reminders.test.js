const {
  validateSubscriptionReminders,
  groupSubscriptionReminderSlots,
} = require("../../src/domain/lib/pure/subscription-reminders.js");

const defaults = [{ days: 3, hour: 8 }];
const subscription = (id, reminders) => ({ id, get: () => reminders });

it("replaces the default schedule and fires at custom hours", () => {
  const inherited = subscription("inherited", null);
  const custom = subscription("custom", [{ days: 14, hour: 17 }]);
  expect(groupSubscriptionReminderSlots([inherited, custom], defaults, 8)).toEqual([
    { days: 3, hour: 8, subscriptions: [inherited] },
  ]);
  expect(groupSubscriptionReminderSlots([inherited, custom], defaults, 17)).toEqual([
    { days: 14, hour: 17, subscriptions: [custom] },
  ]);
});

it("deduplicates slots while batching different subscriptions", () => {
  const first = subscription("first", [{ days: 0, hour: 0 }, { days: 0, hour: 0 }]);
  const second = subscription("second", [{ days: 0, hour: 0 }]);
  expect(groupSubscriptionReminderSlots([first, second], defaults, 0)).toEqual([
    { days: 0, hour: 0, subscriptions: [first, second] },
  ]);
});

it.each([
  [], {}, "not-json", [{ days: -1, hour: 8 }], [{ days: 366, hour: 8 }],
  [{ days: 1.5, hour: 8 }], [{ days: 1, hour: 24 }], [{ days: 1, hour: -1 }],
  [{ days: "3", hour: 8 }], Array.from({ length: 13 }, () => ({ days: 1, hour: 8 })),
])("rejects invalid custom schedules %#", (raw) => {
  expect(() => validateSubscriptionReminders(raw)).toThrow("subscription_reminders_invalid");
});

it("accepts multipart JSON and keeps same-day midnight reminders", () => {
  expect(validateSubscriptionReminders('[{"days":0,"hour":0}]')).toEqual([{ days: 0, hour: 0 }]);
  expect(validateSubscriptionReminders("null")).toBeNull();
});

it("uses defaults for malformed externally restored schedules", () => {
  const legacy = subscription("legacy", "broken");
  expect(groupSubscriptionReminderSlots([legacy], defaults, 8)[0].subscriptions).toEqual([legacy]);
});
