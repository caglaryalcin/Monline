const { identifier } = require("../../storage.cjs");
const TABLE = "monline_affordability_revisions";
const OWNER_TABLES = ["bank_statements", "finance_rows", "finance_entries", "finance_card_transactions",
  "finance_statement_links", "manual_bills", "budget_matches", "calendar_moves", "subscriptions",
  "payment_records", "currencies", "payment_methods", "categories", "savings", "credit_cards", "users"];
const MAX_ENTRIES = 32;
const TTL = 60000;

/** Database triggers cover generic edits, imports, raw SQL and other database
 * connections. Revisions roll back with a failed transaction. Session refreshes
 * and quote-cache writes do not invalidate unchanged financial data on F5. */
function createAffordabilityCache(repository) {
  const db = repository.connection;
  db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE} (owner TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL DEFAULT 0)`);
  const bump = owner => `INSERT INTO ${TABLE}(owner,revision) VALUES (${owner},1)
    ON CONFLICT(owner) DO UPDATE SET revision=revision+1;`;
  for (const table of [...OWNER_TABLES, "cycles"]) {
    const field = table === "users" ? "id" : "user";
    const owner = prefix => table === "cycles" ? "'*'" : `${prefix}.${identifier(field)}`;
    for (const action of ["INSERT", "UPDATE", "DELETE"]) {
      const reference = action === "DELETE" ? "OLD" : "NEW";
      const oldOwner = action === "UPDATE" && table !== "cycles"
        ? `INSERT INTO ${TABLE}(owner,revision) SELECT ${owner("OLD")},1 WHERE ${owner("OLD")} IS NOT ${owner("NEW")}
           ON CONFLICT(owner) DO UPDATE SET revision=revision+1;` : "";
      db.exec(`CREATE TRIGGER IF NOT EXISTS ${identifier(`affordability_revision_${table}_${action.toLowerCase()}`)}
        AFTER ${action} ON ${identifier(table)} BEGIN ${bump(owner(reference))} ${oldOwner} END`);
    }
  }
  const versions = db.prepare(`SELECT owner,revision FROM ${TABLE} WHERE owner IN (?, '*') ORDER BY owner`);
  const entries = new Map();
  return {
    version(user) { return JSON.stringify(versions.all(user)); },
    get(user, date, revision) {
      const key = `${user}:${date}`, entry = entries.get(key);
      if (!entry || entry.revision !== revision || entry.expires <= Date.now()) { entries.delete(key); return null; }
      entries.delete(key); entries.set(key, entry);
      return entry.value;
    },
    set(user, date, revision, value) {
      const key = `${user}:${date}`;
      entries.delete(key); entries.set(key, { revision, value, expires: Date.now() + TTL });
      while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
      return value;
    },
  };
}
module.exports = { createAffordabilityCache };
