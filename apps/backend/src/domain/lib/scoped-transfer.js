const account = require("./account-backup.js");
const LOOKUPS = ["categories", "currencies", "payment_methods", "household"];
function collections(scope) {
  if (scope === "calendar") return [...LOOKUPS, "payment_records"];
  if (scope === "subscriptions")
    return [...LOOKUPS, "subscriptions", "subscription_history"];
  throw new Error("transfer_invalid_backup");
}
function exportScope(app, userId, scope) {
  const allowed = collections(scope);
  const backup = account.exportAccount(app, userId);
  const subscriptions = new Map(
    backup.data.subscriptions.map((sub) => [sub.id, sub]),
  );
  if (scope === "calendar") {
    for (const payment of backup.data.payment_records) {
      const sub = subscriptions.get(payment.subscription_id);
      for (const key of [
        "name",
        "currency",
        "category",
        "payment_method",
        "payer",
      ])
        if (!payment[key] && sub) payment[key] = sub[key];
      payment.name ||= "Payment";
      payment.currency ||=
        backup.profile.main_currency || backup.data.currencies[0]?.id;
    }
  }
  if (scope === "subscriptions")
    for (const sub of backup.data.subscriptions) {
      sub.calendar_history_recovery_passes = 2;
      sub.calendar_projection_hidden = false;
    }
  const source =
    scope === "calendar"
      ? backup.data.payment_records
      : backup.data.subscriptions;
  for (const [collection, field] of Object.entries({
    categories: "category",
    currencies: "currency",
    payment_methods: "payment_method",
    household: "payer",
  })) {
    const ids = new Set(source.map((row) => row[field]).filter(Boolean));
    if (collection === "currencies" && scope === "subscriptions")
      for (const event of backup.data.subscription_history)
        for (const key of ["old_currency", "new_currency"])
          if (event[key]) ids.add(event[key]);
    backup.data[collection] = backup.data[collection].filter((row) =>
      ids.has(row.id),
    );
  }
  const cycleIds = new Set(
    scope === "subscriptions" ? source.map((row) => row.cycle) : [],
  );
  backup.cycles = backup.cycles.filter((cycle) => cycleIds.has(cycle.id));
  for (const name of Object.keys(backup.data))
    if (!allowed.includes(name)) backup.data[name] = [];
  // A scoped transfer contains no ledger cards to remap these v2-only links to.
  for (const method of backup.data.payment_methods) delete method.finance_card;
  backup.files = backup.files.filter(
    (file) =>
      allowed.includes(file.collection) &&
      backup.data[file.collection].some((row) => row.id === file.recordId),
  );
  backup.profile = { id: userId };
  return { format: "monline-scoped-backup", version: 1, scope, backup };
}
function importScope(app, userId, scope, input) {
  const allowed = collections(scope);
  if (
    !input ||
    input.format !== "monline-scoped-backup" ||
    input.version !== 1 ||
    input.scope !== scope ||
    !input.backup
  )
    throw new Error("transfer_invalid_backup");
  const backup = structuredClone(input.backup);
  if (
    Object.entries(backup.data || {}).some(
      ([name, rows]) =>
        !allowed.includes(name) && (!Array.isArray(rows) || rows.length),
    ) ||
    (backup.files || []).some((file) => !allowed.includes(file.collection))
  )
    throw new Error("transfer_invalid_backup");
  return app.runInTransaction((tx) => {
    if (scope === "calendar") {
      for (const payment of backup.data.payment_records || []) {
        let linked;
        try {
          linked = tx.findRecordById("subscriptions", payment.subscription_id);
        } catch (_) {}
        if (backup.accountId !== userId || linked?.getString("user") !== userId)
          payment.subscription_id = "";
        if (!payment.subscription_id && (!payment.name || !payment.currency))
          throw new Error("transfer_invalid_backup");
      }
    }
    if (scope === "subscriptions")
      for (const sub of backup.data.subscriptions || [])
        sub.calendar_history_recovery_passes = 2;
    return account.importAccount(tx, userId, backup, false, {
      recoverHistory: false,
    });
  });
}
module.exports = { exportScope, importScope };
