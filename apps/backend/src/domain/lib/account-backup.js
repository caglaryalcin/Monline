const { Record, security, files: fileHelpers } = require("../../runtime.cjs");
// Explicit field lists keep authentication secrets and unrelated users out of account backups.
const PROFILE = [
  "name",
  "language",
  "main_currency",
  "dark_theme_mode",
  "color_theme",
  "custom_css",
  "monthly_price",
  "show_original_price",
  "show_currency_code",
  "hide_disabled",
  "disabled_to_bottom",
  "subscription_progress",
  "mobile_navigation",
  "remove_background",
  "convert_currency",
  "budget",
  "payment_tracking",
  "global_currency_prefix",
  "display_currency",
  "monthly_budget",
  "show_logo_on_card",
  "show_price_on_card",
  "show_cycle_on_card",
  "show_payment_method_on_card",
  "show_category_on_card",
  "show_payer_on_card",
  "show_next_payment_on_card",
  "sort_order",
  "sort_direction",
  "calendar_view",
  "avatar",
];
const FIELDS = {
  finance_rows: [
    "name",
    "kind",
    "expense_type",
    "notes",
    "source_subscription",
    "payment_card",
    "bill_type",
    "row_order",
    "is_loan",
    "is_rent",
    "is_auto_carryover",
    "loan_id",
    "year",
    "origin_row",
    "is_deleted",
  ],
  finance_entries: [
    "row_id",
    "date",
    "amount",
    "status",
    "settled_date",
    "notes",
    "source_payment",
    "payment_tag",
  ],
  finance_card_transactions: [
    "row_id",
    "month",
    "date",
    "merchant",
    "amount",
    "notes",
  ],
  salary_history: ["effective_date", "amount", "notes"],
  finance_benchmarks: [
    "month",
    "salary_tag",
    "usd",
    "eur",
    "minimum_wage",
    "rate_date",
    "source",
    "updated_at",
  ],
  categories: ["name", "color", "order", "translation_key"],
  currencies: ["code", "name", "symbol", "rate", "is_main"],
  payment_methods: ["name", "icon", "order", "is_main", "finance_card"],
  household: ["name", "is_main"],
  subscriptions: [
    "name",
    "price",
    "currency",
    "cycle",
    "frequency",
    "billing_anchor_day",
    "calendar_history_recovery_passes",
    "calendar_projection_hidden",
    "category",
    "payment_method",
    "payer",
    "replacement_subscription",
    "next_payment",
    "start_date",
    "statement_imported",
    "cancellation_date",
    "end_date",
    "payment_limit",
    "payments_completed",
    "auto_renew",
    "inactive",
    "auto_mark_paid",
    "notify",
    "notify_days_before",
    "notes",
    "url",
    "record_type",
    "logo",
  ],
  payment_records: [
    "name",
    "currency",
    "logo",
    "category",
    "payment_method",
    "payer",
    "statement_sources",
    "subscription_id",
    "due_date",
    "scheduled_date",
    "paid_at",
    "auto_paid",
    "amount",
    "notes",
    "proof",
  ],
  subscription_history: [
    "subscription_id",
    "event_type",
    "effective_date",
    "old_price",
    "new_price",
    "old_cycle",
    "new_cycle",
    "old_frequency",
    "new_frequency",
    "old_currency",
    "new_currency",
    "note",
    "created",
  ],
  yearly_costs: ["year", "month", "total"],
  notifications_config: [
    "email_enabled",
    "discord_enabled",
    "telegram_enabled",
    "gotify_enabled",
    "pushover_enabled",
    "ntfy_enabled",
    "pushplus_enabled",
    "mattermost_enabled",
    "webhook_enabled",
    "serverchan_enabled",
  ],
  notification_log: ["subscription_id", "sent_date", "reminder_key"],
  bank_statements: [
    "tracking_hidden",
    "excluded_transactions",
    "summary",
    "unresolved",
    "bank",
    "file_name",
    "file_hash",
    "period",
    "page_count",
    "transactions",
    "created",
  ],
  finance_statement_links: ["row_id", "month", "statement_id"],
  merchant_logos: ["merchant_name", "provider_name", "domain", "row_id", "start_month", "scope", "updated_at"],
  manual_bills: ["name", "date", "amount", "currency", "status", "notes"],
  budget_matches: [
    "target_type",
    "target_id",
    "statement_id",
    "transaction_id",
    "fingerprint",
    "relation",
  ],
  calendar_moves: ["source", "source_id", "source_date", "date"],
};
const FILE_FIELDS = {
  users: ["avatar"],
  subscriptions: ["logo"],
  payment_methods: ["icon"],
  payment_records: ["proof", "logo"],
};
const RELATIONS = {
  statement_id: "bank_statements",
  row_id: "finance_rows",
  currency: "currencies",
  category: "categories",
  payment_method: "payment_methods",
  payer: "household",
  subscription_id: "subscriptions",
  replacement_subscription: "subscriptions",
};
function ownerField(collection) {
  return collection === "notification_log" ? "user_id" : "user";
}
function own(app, name, userId) {
  return app.findRecordsByFilter(
    name,
    ownerField(name) + " = {:owner}",
    "id",
    0,
    0,
    {
      owner: userId,
    },
  );
}
function values(record, fields) {
  const result = {
    id: record.id,
  };
  for (const field of fields) result[field] = record.get(field);
  return result;
}
function fileKey(collection, id, field) {
  return JSON.stringify([collection, id, field]);
}
function exportAccount(app, userId) {
  let backup;
  app.runInTransaction((tx) => {
    const account = tx.findRecordById("users", userId);
    backup = {
      format: "monline-account-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      accountId: userId,
      profile: values(account, PROFILE),
      data: {},
      cycles: tx
        .findRecordsByFilter("cycles", "id != ''", "name", 0, 0)
        .map((row) => values(row, ["name"])),
      files: [],
    };
    function addFile(name, row) {
      for (const field of FILE_FIELDS[name] || []) {
        const filename = row.getString(field);
        if (filename)
          backup.files.push({
            collection: name,
            recordId: row.id,
            field,
            name: filename,
          });
      }
    }
    addFile("users", account);
    for (const name of Object.keys(FIELDS)) {
      const rows = own(tx, name, userId);
      backup.data[name] = rows.map((row) => values(row, FIELDS[name]));
      for (const row of rows) addFile(name, row);
    }
    backup.data.calendar_moves = backup.data.calendar_moves.filter((row) => {
      const ref = require("./calendar-placement.js").sourceReference(
        row.source,
        row.source_id,
      );
      return (
        ref &&
        backup.data[ref.collection]?.some(
          (source) => source.id === ref.recordId,
        )
      );
    });
  });
  return backup;
}
function fromBase64(value) {
  if (
    typeof value !== "string" ||
    value.length % 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    throw new Error("transfer_invalid_backup");
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = [];
  for (let i = 0; i < value.length; i += 4) {
    const a = alphabet.indexOf(value[i]),
      b = alphabet.indexOf(value[i + 1]);
    const c = alphabet.indexOf(value[i + 2]),
      d = alphabet.indexOf(value[i + 3]);
    bytes.push((a << 2) | (b >> 4));
    if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d >= 0) bytes.push(((c & 3) << 6) | d);
  }
  return bytes;
}
function validateBackup(backup) {
  if (
    !backup ||
    backup.format !== "monline-account-backup" ||
    backup.version !== 1 ||
    !backup.data ||
    typeof backup.data !== "object" ||
    !backup.profile ||
    !/^[a-z0-9]{15}$/.test(backup.accountId) ||
    !Array.isArray(backup.cycles) ||
    !Array.isArray(backup.files)
  )
    throw new Error("transfer_invalid_backup");
  let count = 0;
  for (const name of require("./pure/finance.js").COLLECTIONS)
    if (backup.data[name] === undefined) backup.data[name] = [];
  if (backup.data.bank_statements === undefined)
    backup.data.bank_statements = [];
  if (backup.data.merchant_logos === undefined) backup.data.merchant_logos = [];
  if (backup.data.manual_bills === undefined) backup.data.manual_bills = [];
  if (backup.data.budget_matches === undefined) backup.data.budget_matches = [];
  if (backup.data.calendar_moves === undefined) backup.data.calendar_moves = [];
  for (const name of Object.keys(FIELDS)) {
    const rows = backup.data[name];
    if (!Array.isArray(rows)) throw new Error("transfer_invalid_backup");
    const ids = new Set();
    for (const row of rows) {
      if (!row || !/^[a-z0-9]{15}$/.test(row.id) || ids.has(row.id))
        throw new Error("transfer_invalid_backup");
      ids.add(row.id);
      if (name === "manual_bills") {
        try {
          require("./pure/manual-bills.js").validate(row);
        } catch {
          throw new Error("transfer_invalid_backup");
        }
      }
      if (name === "merchant_logos") {
        try {
          require("./pure/merchant-logos.js").validate(row);
        } catch (_) {
          throw new Error("transfer_invalid_backup");
        }
      }
      if (name === "finance_rows" && row.kind === "expense")
        row.expense_type = require("./pure/finance.js").normalizeExpenseType(
          row.expense_type,
        );
      if (
        require("./pure/finance.js").COLLECTIONS.includes(name) &&
        require("./pure/finance.js").validate(name, row)
      )
        throw new Error("transfer_invalid_backup");
      if (
        name === "subscriptions" &&
        row.billing_anchor_day != null &&
        (!Number.isInteger(row.billing_anchor_day) ||
          row.billing_anchor_day < 0 ||
          row.billing_anchor_day > 31)
      )
        throw new Error("transfer_invalid_backup");
      if (name === "bank_statements") {
        try {
          Object.assign(
            row,
            require("./bank-statements.js").validate(row, { legacy: true }),
          );
        } catch (_) {
          throw new Error("transfer_invalid_backup");
        }
      }
    }
    count += rows.length;
  }
  if (count > 50000 || backup.files.length > 2000 || backup.cycles.length > 100)
    throw new Error("transfer_too_large");
  const files = Object.create(null);
  let totalBytes = 0;
  for (const file of backup.files) {
    if (
      !file ||
      !Object.prototype.hasOwnProperty.call(FILE_FIELDS, file.collection) ||
      !FILE_FIELDS[file.collection].includes(file.field) ||
      typeof file.name !== "string" ||
      !file.name ||
      /[\/\\\x00-\x1f]/.test(file.name) ||
      typeof file.base64 !== "string"
    )
      throw new Error("transfer_invalid_backup");
    const row =
      file.collection === "users"
        ? file.recordId === backup.accountId && backup.profile
        : backup.data[file.collection].find(
            (entry) => entry.id === file.recordId,
          );
    const key = fileKey(file.collection, file.recordId, file.field);
    if (!row || row[file.field] !== file.name || files[key])
      throw new Error("transfer_invalid_backup");
    totalBytes += file.base64.length * 0.75;
    if (totalBytes > 64 * 1024 * 1024 || file.base64.length > 16 * 1024 * 1024)
      throw new Error("transfer_too_large");
    files[key] = {
      name: file.name,
      bytes: fromBase64(file.base64),
    };
  }
  // Never silently restore a filename without its actual contents.
  for (const name of Object.keys(FILE_FIELDS)) {
    const rows =
      name === "users"
        ? [
            {
              ...backup.profile,
              id: backup.accountId,
            },
          ]
        : backup.data[name];
    for (const row of rows)
      for (const field of FILE_FIELDS[name])
        if (row[field] && !files[fileKey(name, row.id, field)])
          throw new Error("transfer_invalid_backup");
  }
  return files;
}
function importAccount(
  app,
  userId,
  backup,
  restoreSettings,
  { recoverHistory = true } = {},
) {
  const files = validateBackup(backup);
  const result = {
    imported: 0,
    skipped: 0,
    collections: {},
  };
  app.runInTransaction((tx) => {
    const maps = Object.create(null);
    const records = Object.create(null);
    const created = Object.create(null);
    const lookup = (name, id) => {
      try {
        return tx.findRecordById(name, id);
      } catch (_) {
        return null;
      }
    };
    const sameOwner = (name, record) =>
      record && record.getString(ownerField(name)) === userId;
    maps.cycles = Object.create(null);
    for (const cycle of backup.cycles) {
      if (
        !cycle ||
        typeof cycle.id !== "string" ||
        typeof cycle.name !== "string"
      )
        throw new Error("transfer_invalid_backup");
      const found = tx.findRecordsByFilter(
        "cycles",
        "name = {:name}",
        "",
        1,
        0,
        {
          name: cycle.name,
        },
      )[0];
      if (!found) throw new Error("transfer_invalid_backup");
      maps.cycles[cycle.id] = found.id;
    }
    // Allocate all IDs before writing, including forward replacement-subscription links.
    for (const name of Object.keys(FIELDS)) {
      maps[name] = Object.create(null);
      records[name] = Object.create(null);
      created[name] = Object.create(null);
      const existing = own(tx, name, userId);
      for (const row of backup.data[name]) {
        let record = lookup(name, row.id);
        if (!sameOwner(name, record)) record = null;
        if (
          !record &&
          ["categories", "household", "payment_methods", "currencies"].includes(
            name,
          )
        ) {
          const field = name === "currencies" ? "code" : "name";
          record = existing.find(
            (entry) =>
              entry.getString(field).toLowerCase() ===
              String(row[field]).toLowerCase(),
          );
        }
        if (
          !record &&
          ["notifications_config", "fixer_settings"].includes(name)
        )
          record = existing[0];
        if (!record && name === "yearly_costs")
          record = existing.find(
            (entry) =>
              entry.get("year") === row.year &&
              entry.get("month") === row.month,
          );
        if (!record && name === "salary_history")
          record = existing.find(
            (entry) => entry.getString("effective_date") === row.effective_date,
          );
        if (!record && name === "finance_benchmarks")
          record = existing.find(
            (entry) => entry.getString("month") === row.month,
          );
        if (!record && name === "bank_statements")
          record = existing.find(
            (entry) => entry.getString("file_hash") === row.file_hash,
          );
        if (!record && name === "merchant_logos")
          record = existing.find(
            (entry) =>
              entry.getString("merchant_key") ===
              require("./pure/merchant-logos.js").key(row.merchant_name) &&
              entry.getString("row_id") === (row.row_id ? maps.finance_rows[row.row_id] : "") &&
              entry.getString("start_month") === (row.start_month || "") &&
              entry.getString("scope") === (row.scope || ""),
          );
        const targetId = record
          ? record.id
          : backup.accountId === userId
            ? row.id
            : security.sha256(userId + ":" + name + ":" + row.id).slice(0, 15);
        if (!record) {
          record = lookup(name, targetId);
          if (record && !sameOwner(name, record))
            throw new Error("transfer_invalid_backup");
        }
        maps[name][row.id] = record ? record.id : targetId;
        records[name][row.id] = record;
      }
    }
    function relation(name, value) {
      if (!value) return "";
      const id = maps[name][value];
      if (!id) throw new Error("transfer_invalid_backup");
      return id;
    }
    // Payment and notification logs use text IDs and may outlive a deleted subscription.
    function subscriptionId(value) {
      if (typeof value !== "string" || !/^[a-z0-9]{15}$/.test(value))
        throw new Error("transfer_invalid_backup");
      return (
        maps.subscriptions[value] ||
        (backup.accountId === userId
          ? value
          : security.sha256(userId + ":subscriptions:" + value).slice(0, 15))
      );
    }
    function setFields(record, row, name, fields) {
      for (const field of fields) {
        if (
          field === "id" ||
          field === "replacement_subscription" ||
          field === "payment_card" ||
          field === "origin_row" ||
          field === "finance_card" ||
          !Object.prototype.hasOwnProperty.call(row, field)
        )
          continue;
        if (FILE_FIELDS[name]?.includes(field)) {
          const file = files[fileKey(name, row.id, field)];
          if (file)
            record.set(field, fileHelpers.fileFromBytes(file.bytes, file.name));
        } else if (name === "calendar_moves" && field === "source_id") {
          const ref = require("./calendar-placement.js").sourceReference(
            row.source,
            row.source_id,
          );
          if (
            !ref ||
            !require("./pure/backfill-schedule.js").validDate(row.date) ||
            !require("./pure/backfill-schedule.js").validDate(row.source_date)
          )
            throw new Error("transfer_invalid_backup");
          record.set(
            field,
            `${ref.prefix}:${relation(ref.collection, ref.recordId)}${ref.suffix}`,
          );
        } else if (name === "budget_matches" && field === "target_id") {
          if (
            !Object.hasOwn(
              require("./pure/budget-matching.js").PREFIX,
              row.target_type,
            )
          )
            throw new Error("transfer_invalid_backup");
          record.set(field, relation(row.target_type, row[field]));
        } else if (field === "subscription_id")
          record.set(
            field,
            name === "payment_records" && !row[field]
              ? ""
              : subscriptionId(row[field]),
          );
        else if (field === "cycle")
          record.set(field, relation("cycles", row[field]));
        else if (field === "source_subscription")
          record.set(field, row[field] ? subscriptionId(row[field]) : "");
        else if (field === "source_payment")
          record.set(
            field,
            row[field]
              ? maps.payment_records[row[field]] ||
                  (backup.accountId === userId
                    ? row[field]
                    : security
                        .sha256(userId + ":payment_records:" + row[field])
                        .slice(0, 15))
              : "",
          );
        // Manual invoices keep the original ISO code, not a currency-record relation.
        else if (name === "manual_bills" && field === "currency")
          record.set(field, row[field]);
        else if (RELATIONS[field])
          record.set(field, relation(RELATIONS[field], row[field]));
        else if (field === "main_currency")
          record.set(field, relation("currencies", row[field]));
        else record.set(field, row[field]);
      }
    }
    for (const name of Object.keys(FIELDS)) {
      const summary = {
        imported: 0,
        skipped: 0,
      };
      result.collections[name] = summary;
      for (const row of backup.data[name]) {
        let record = records[name][row.id];
        const settings = ["notifications_config", "fixer_settings"].includes(
          name,
        );
        if (
          (record && !(settings && restoreSettings)) ||
          (settings && !restoreSettings)
        ) {
          summary.skipped++;
          result.skipped++;
          continue;
        }
        if (!record && name === "payment_records" && row.subscription_id) {
          const duplicates = tx.findRecordsByFilter(
            name,
            "user = {:owner} && subscription_id = {:subscription} && due_date = {:due}",
            "",
            1,
            0,
            {
              owner: userId,
              subscription: subscriptionId(row.subscription_id),
              due: row.due_date,
            },
          );
          if (duplicates.length) {
            summary.skipped++;
            result.skipped++;
            continue;
          }
        }
        if (
          !record &&
          name === "bank_statements" &&
          tx.findRecordsByFilter(
            name,
            "user = {:owner} && file_hash = {:hash}",
            "",
            1,
            0,
            {
              owner: userId,
              hash: row.file_hash,
            },
          ).length
        ) {
          summary.skipped++;
          result.skipped++;
          continue;
        }
        const isNew = !record;
        if (isNew) {
          record = new Record(tx.findCollectionByNameOrId(name));
          record.id = maps[name][row.id];
        }
        record.set(ownerField(name), userId);
        setFields(record, row, name, FIELDS[name]);
        if (
          ["currencies", "payment_methods", "household"].includes(name) &&
          !restoreSettings &&
          own(tx, name, userId).some((entry) => entry.getBool("is_main"))
        )
          record.set("is_main", false);
        if (["subscriptions", "finance_rows"].includes(name)) record.set("__monline_restore", true);
        if (name === "fixer_settings" && !record.getString("api_key"))
          record.set("enabled", false);
        if (name === "notifications_config") {
          const available = require("../../server-config.cjs").availability(tx);
          for (const [channel, configured] of Object.entries(available))
            if (!configured) record.set(channel + "_enabled", false);
        }
        tx.save(record);
        if (
          ["subscription_history", "bank_statements"].includes(name) &&
          row.created
        ) {
          // Autodate creation hooks set today's timestamp; restore the original event ordering.
          const timestamp = new Date(String(row.created).replace(" ", "T"));
          if (!Number.isFinite(timestamp.getTime()))
            throw new Error("transfer_invalid_backup");
          tx.db()
            .newQuery(
              "UPDATE {{" +
                name +
                "}} SET [[created]] = {:created} WHERE [[id]] = {:id} AND [[user]] = {:owner}",
            )
            .bind({
              created: timestamp.toISOString().replace("T", " "),
              id: record.id,
              owner: userId,
            })
            .execute();
        }
        records[name][row.id] = record;
        if (isNew) created[name][row.id] = true;
        summary.imported++;
        result.imported++;
      }
    }
    for (const row of backup.data.subscriptions) {
      if (!created.subscriptions[row.id] || !row.replacement_subscription)
        continue;
      const record = records.subscriptions[row.id];
      record.set(
        "replacement_subscription",
        relation("subscriptions", row.replacement_subscription),
      );
      record.set("__monline_restore", true);
      tx.save(record);
    }
    for (const [name, field] of [
      ["finance_rows", "origin_row"],
      ["finance_rows", "payment_card"],
      ["payment_methods", "finance_card"],
    ])
      for (const row of backup.data[name]) {
        if (!created[name][row.id] || !row[field]) continue;
        const record = records[name][row.id];
        record.set(field, relation("finance_rows", row[field]));
        if (name === "finance_rows") record.set("__monline_restore", true);
        tx.save(record);
      }
    tx.repairStatementImportMarkers();
    tx.repairMainPaymentMethods();
    tx.repairMainHousehold();
    if (restoreSettings) {
      const account = tx.findRecordById("users", userId);
      setFields(
        account,
        {
          ...backup.profile,
          id: backup.accountId,
        },
        "users",
        PROFILE,
      );
      tx.save(account);
      const mainId = account.getString("main_currency");
      if (mainId)
        for (const currency of own(tx, "currencies", userId)) {
          currency.set("is_main", currency.id === mainId);
          tx.save(currency);
        }
    }
    if (recoverHistory)
      require("./calendar-history-recovery.js").recoverCalendarHistory(
        tx,
        require("./date-helpers.js").formatLocalDate(new Date()),
        userId,
      );
  });
  return result;
}
module.exports = {
  exportAccount,
  importAccount,
};
