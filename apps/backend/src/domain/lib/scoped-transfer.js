const account = require("./account-backup.js");
const { security } = require("../../runtime.cjs");
const LOOKUPS = ["categories", "currencies", "payment_methods", "household"];
const SCOPES = {
  calendar: ["payment_records"],
  subscriptions: ["subscriptions", "subscription_history"],

};
function collections(app, scope) {
  if (!Object.hasOwn(SCOPES, scope)) throw new Error("transfer_invalid_backup");
  const allowed = [...LOOKUPS, ...SCOPES[scope]];
  try { app.findCollectionByNameOrId("payment_accounts"); allowed.push("payment_accounts"); } catch (_) {}
  return allowed;
}
function exportScope(app, userId, scope) {
  const allowed = collections(app, scope);
  const backup = account.exportAccount(app, userId);
  const subscriptions = new Map(backup.data.subscriptions.map((sub) => [sub.id, sub]));

  if (scope === "calendar") {
    const originalFiles = [...backup.files];
    for (const payment of backup.data.payment_records) {
      const sub = subscriptions.get(payment.subscription_id);
      for (const key of ["name", "brand_name", "currency", "category", "payment_method", "payment_account", "payer"])
        if (!payment[key] && sub?.[key]) payment[key] = sub[key];
      // A detached calendar record must keep the logo it previously inherited.
      if (!payment.logo && sub?.logo) {
        const logo = originalFiles.find((file) => file.collection === "subscriptions" && file.recordId === sub.id && file.field === "logo");
        if (logo) {
          payment.logo = sub.logo;
          backup.files.push({ collection: "payment_records", recordId: payment.id, field: "logo", name: sub.logo,
            sourceCollection: "subscriptions", sourceRecordId: sub.id });
        }
      }
      payment.name ||= "Payment";
      payment.currency ||= backup.profile.main_currency || backup.data.currencies[0]?.id;
    }
  }
  if (scope !== "calendar")
    for (const sub of backup.data.subscriptions) {
      sub.calendar_history_recovery_passes = 2;
      sub.calendar_projection_hidden = false;
      sub.calendar_projection_from = "";
    }
  const source = scope === "calendar" ? backup.data.payment_records : backup.data.subscriptions;
  for (const [collection, field] of Object.entries({ categories: "category", currencies: "currency", payment_methods: "payment_method", payment_accounts: "payment_account", household: "payer" })) {
    if (!backup.data[collection]) continue;
    const ids = new Set(source.map((row) => row[field]).filter(Boolean));
    backup.data[collection] = backup.data[collection].filter((row) => ids.has(row.id));
  }
  const cycleIds = new Set(scope !== "calendar" ? source.map((row) => row.cycle) : []);
  backup.cycles = backup.cycles.filter((cycle) => cycleIds.has(cycle.id));
  for (const name of Object.keys(backup.data)) if (!allowed.includes(name)) backup.data[name] = [];
  for (const method of backup.data.payment_methods) delete method.finance_card;
  backup.files = backup.files.filter((file) => allowed.includes(file.collection) && backup.data[file.collection].some((row) => row.id === file.recordId));
  backup.profile = { id: userId };
  return { format: "monline-scoped-backup", version: 1, scope, backup };
}
function importScope(app, userId, scope, input) {
  const allowed = collections(app, scope);
  if (!input || input.format !== "monline-scoped-backup" || input.version !== 1 || input.scope !== scope || !input.backup)
    throw new Error("transfer_invalid_backup");
  const backup = structuredClone(input.backup);
  if (!backup.data || typeof backup.data !== "object" || Array.isArray(backup.data) || !Array.isArray(backup.files) ||
      Object.entries(backup.data).some(([name, rows]) => !Array.isArray(rows) || (!allowed.includes(name) && rows.length)) ||
      backup.files.some((file) => !file || !allowed.includes(file.collection)))
    throw new Error("transfer_invalid_backup");
  return app.runInTransaction((tx) => {
    if (scope === "calendar") {
      for (const payment of backup.data.payment_records || []) {
        let linked;
        const sourceId = payment.subscription_id;
        const targetId = backup.accountId === userId ? sourceId : sourceId ? security.sha256(userId + ":subscriptions:" + sourceId).slice(0, 15) : "";
        try { linked = tx.findRecordById("subscriptions", targetId); } catch (_) {}
        // Reuse an already imported owned subscription. Calendar-only imports stay independent.
        if (linked?.getString("user") !== userId) payment.subscription_id = "";
        if (!payment.subscription_id && (!payment.name || !payment.currency)) throw new Error("transfer_invalid_backup");
      }
    }
    if (scope !== "calendar")
      for (const sub of backup.data.subscriptions || []) {
        sub.calendar_history_recovery_passes = 2;
        sub.calendar_projection_hidden = false;
        sub.calendar_projection_from = "";
      }
    return account.importAccount(tx, userId, backup, false, { recoverHistory: false });
  });
}
module.exports = { exportScope, importScope };
