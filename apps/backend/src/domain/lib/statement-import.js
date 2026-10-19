const crypto = require("node:crypto");
const { nextStatementPayment } = require("./pure/statement-payment-date.js");
const { DataRecord } = require("../../storage.cjs");
const { validateHistoricalPayment } = require("./pure/historical-payment.js");
const { prepareBackfill, saveBackfill } = require("./subscription-backfill.js");

const normalize = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const fail = (code) => {
  throw new Error(code);
};
const sources = (payment) => {
  const value = payment.get("statement_sources");
  return Array.isArray(value)
    ? value.filter((key) => typeof key === "string")
    : [];
};

// Reads amounts/dates from the saved, owned statement, never from the import request.
// One transaction covers every subscription and payment so a bad mapping cannot
// leave a partially imported statement behind.
function importStatement(app, owner, statement, body, now = new Date()) {
  if (
    !body ||
    !Array.isArray(body.groups) ||
    !body.groups.length ||
    body.groups.length > 3000
  )
    fail("statement_import_invalid");
  const source = statement.get("transactions");
  if (!Array.isArray(source)) fail("statement_import_invalid");
  const byId = new Map(source.map((row) => [row.id, row]));
  const seen = new Set();
  const prepared = body.groups.map((group) => {
    if (
      !group ||
      !Array.isArray(group.transaction_ids) ||
      !group.transaction_ids.length
    )
      fail("statement_import_invalid");
    const rows = group.transaction_ids
      .map((id) => {
        const row = byId.get(id);
        if (!row || seen.has(id) || row.kind !== "charge")
          fail("statement_import_invalid");
        if (
          [row.merchant, row.subscription_service].some((value) =>
            /\byoutube\s*super(?:\s*chat)?\b/.test(normalize(value)),
          )
        )
          fail("statement_import_one_off");
        seen.add(id);
        const values = validateHistoricalPayment(
          {
            due_date: row.date,
            paid_date: row.date,
            amount: row.amount,
            utc_offset_minutes: body.utc_offset_minutes,
            paid_utc_offset_minutes: body.paid_offsets?.[id],
          },
          now,
          { limitToPastYear: false },
        );
        return { row, values };
      })
      .sort((a, b) => a.row.date.localeCompare(b.row.date));
    if (rows.some(({ row }) => row.currency !== rows[0].row.currency))
      fail("statement_import_currency");
    if (
      group.combine_dates != null &&
      (!Array.isArray(group.combine_dates) ||
        group.combine_dates.length > rows.length ||
        group.combine_dates.some(
          (date) =>
            typeof date !== "string" ||
            !rows.some(({ row }) => row.date === date),
        ))
    )
      fail("statement_import_invalid");
    if (!group.subscription_id) {
      const config = group.new_subscription;
      if (
        !config ||
        typeof config.name !== "string" ||
        !config.name.trim() ||
        config.name.trim().length > 120 ||
        !Number.isInteger(config.frequency) ||
        config.frequency < 1 ||
        config.frequency > 365 ||
        typeof config.active !== "boolean"
      )
        fail("statement_import_invalid");
    }
    return { group, rows };
  });
  const today = new Date(now.getTime() - body.utc_offset_minutes * 60000)
    .toISOString()
    .slice(0, 10);
  return app.runInTransaction((tx) => {
    const scheduleAnchors = new Map();
    const owned = (name) =>
      tx.findRecordsByFilter(name, "user = {:owner}", "", 0, 0, { owner });
    const subscriptions = owned("subscriptions");
    const currencies = owned("currencies");
    const relationIds = {
      category: new Set(owned("categories").map((record) => record.id)),
      payment_method: new Set(
        owned("payment_methods").map((record) => record.id),
      ),
    };
    const subscriptionIds = new Set(
      subscriptions
        .filter((s) => s.getString("record_type") !== "credit")
        .map((s) => s.id),
    );
    const payments = owned("payment_records").filter((p) =>
      subscriptionIds.has(p.getString("subscription_id")),
    );
    const paymentsBySource = new Map();
    const paymentsByDay = new Map();
    function indexPayment(payment) {
      if (payment.getString("paid_at"))
        for (const key of sources(payment)) paymentsBySource.set(key, payment);
      const key = `${payment.getString("subscription_id")}:${payment.getString("due_date").slice(0, 10)}`;
      const day = paymentsByDay.get(key) || [];
      if (!day.includes(payment)) day.push(payment);
      paymentsByDay.set(key, day);
    }
    payments.forEach(indexPayment);
    const cycles = tx.findRecordsByFilter("cycles");
    const result = {
      subscriptions_created: 0,
      payments_imported: 0,
      payments_skipped: 0,
    };
    const conflicts = new Map();
    const backfills = [];
    const documentPrefix = `[monline-statement:${statement.getString("file_hash")}:`;
    function markConflict(row, subscription, matches) {
      const add = (transaction) => {
        conflicts.set(transaction.id, {
          transaction_id: transaction.id,
          date: transaction.date,
          subscription_name: subscription.getString("name"),
        });
      };
      add(row);
      for (const payment of matches) {
        for (const key of sources(payment)) {
          if (!key.startsWith(documentPrefix) || !key.endsWith("]")) continue;
          const related = byId.get(key.slice(documentPrefix.length, -1));
          if (related && seen.has(related.id)) add(related);
        }
      }
    }
    for (const { group, rows } of prepared) {
      for (const [field, ids] of Object.entries(relationIds)) {
        if (
          group[field] !== undefined &&
          (typeof group[field] !== "string" ||
            (group[field] && !ids.has(group[field])))
        )
          fail("statement_import_invalid");
      }
      const currency = currencies.find(
        (c) => c.getString("code").toUpperCase() === rows[0].row.currency,
      );
      if (!currency) fail("statement_import_currency");
      let subscription = group.subscription_id
        ? subscriptions.find((s) => s.id === group.subscription_id)
        : null;
      if (group.subscription_id && !subscription)
        fail("statement_import_invalid");
      const config = group.new_subscription;
      if (!group.subscription_id) {
        const matches = subscriptions.filter(
          (s) =>
            s.getString("record_type") !== "credit" &&
            s.getString("currency") === currency.id &&
            normalize(s.getString("name")) === normalize(config.name),
        );
        if (matches.length > 1) fail("statement_import_ambiguous");
        subscription = matches[0] || null;
      }
      if (
        subscription &&
        (subscription.getString("currency") !== currency.id ||
          subscription.getString("record_type") === "credit")
      )
        fail("statement_import_currency");
      const category = group.category ?? subscription?.getString("category");
      if (!category || !relationIds.category.has(category))
        fail("statement_import_category_required");
      const cycle =
        !group.subscription_id && cycles.find((c) => c.id === config.cycle);
      if (
        !group.subscription_id &&
        (!cycle ||
          ![
            "Daily",
            "Weekly",
            "Monthly",
            "Quarterly",
            "Half-Yearly",
            "Yearly",
          ].includes(cycle.getString("name")))
      )
        fail("statement_import_invalid");
      if (subscription) {
        if (!subscription.getBool("statement_imported")) {
          subscription.set("statement_imported", true);
          tx.save(subscription);
        }
        const previous = scheduleAnchors.get(subscription.id);
        const latest = rows.at(-1).row.date;
        if (!previous || latest > previous.date)
          scheduleAnchors.set(subscription.id, { subscription, date: latest });
      }
      const combineDates = new Set(group.combine_dates || []);
      const batches = new Map();
      for (const entry of rows) {
        const key = combineDates.has(entry.row.date)
          ? `day:${entry.row.date}`
          : `row:${entry.row.id}`;
        const batch = batches.get(key) || [];
        batch.push(entry);
        batches.set(key, batch);
      }
      for (const batch of batches.values()) {
        const pending = [];
        for (const entry of batch) {
          const { row } = entry;
          // A source marker prevents re-importing a row even if its mapping changes.
          const origin = `[monline-statement:${statement.getString("file_hash")}:${row.id}]`;
          // Also deduplicate the same bank charge appearing in different PDF exports.
          const fingerprint =
            "[monline-charge:" +
            crypto
              .createHash("sha256")
              .update(
                JSON.stringify([
                  statement.getString("bank"),
                  row.date,
                  row.currency,
                  row.amount,
                  normalize(row.merchant),
                ]),
              )
              .digest("hex") +
            "]";
          const byOrigin = paymentsBySource.get(origin);
          const byFingerprint = paymentsBySource.get(fingerprint);
          // Identical-looking *different rows in the same PDF* may be two real
          // charges (e.g. two channel memberships). Do not silently lose one.
          const sameDocument =
            byFingerprint &&
            sources(byFingerprint).some((key) =>
              key.startsWith(
                `[monline-statement:${statement.getString("file_hash")}:`,
              ),
            );
          if (byOrigin || (byFingerprint && !sameDocument)) {
            if (!byOrigin) {
              byFingerprint.set("statement_sources", [
                ...new Set([...sources(byFingerprint), origin]),
              ]);
              tx.save(byFingerprint);
              indexPayment(byFingerprint);
            }
            result.payments_skipped++;
            continue;
          }
          pending.push({ ...entry, origin, fingerprint });
        }
        if (!pending.length) continue;
        const row = pending[0].row;
        const values = {
          ...pending[0].values,
          amount:
            pending.reduce(
              (total, entry) => total + Math.round(entry.row.amount * 100),
              0,
            ) / 100,
        };
        const markers = pending.flatMap((entry) => [
          entry.origin,
          entry.fingerprint,
        ]);
        if (!subscription) {
          subscription = new DataRecord(
            tx.findCollectionByNameOrId("subscriptions"),
          );
          const latest = rows.at(-1).row;
          for (const [key, value] of Object.entries({
            user: owner,
            name: config.name.trim(),
            record_type: "expense",
            currency: currency.id,
            price: combineDates.has(latest.date)
              ? rows
                  .filter((entry) => entry.row.date === latest.date)
                  .reduce(
                    (total, entry) =>
                      total + Math.round(entry.row.amount * 100),
                    0,
                  ) / 100
              : latest.amount,
            cycle: cycle.id,
            frequency: config.frequency,
            start_date: rows[0].row.date,
            statement_imported: true,
            next_payment: nextStatementPayment(latest.date, today),
            inactive: !config.active,
            auto_renew: config.active,
            auto_mark_paid: false,
            notify: false,
            category: group.category ?? "",
            payment_method: group.payment_method ?? "",
          }))
            subscription.set(key, value);
          tx.save(subscription);
          subscriptions.push(subscription);
          result.subscriptions_created++;
          const previous = scheduleAnchors.get(subscription.id);
          const latestDate = rows.at(-1).row.date;
          if (!previous || latestDate > previous.date)
            scheduleAnchors.set(subscription.id, {
              subscription,
              date: latestDate,
            });
        }
        const matches =
          paymentsByDay.get(`${subscription.id}:${row.date}`) || [];
        const markBatchConflict = () => {
          for (const entry of pending)
            markConflict(entry.row, subscription, matches);
        };
        const paid = matches.filter((p) => p.getString("paid_at"));
        let mergeTarget = null;
        if (paid.length) {
          // An explicitly combined day can extend a previously imported part of
          // this statement. Only add new source rows, never add them twice or
          // overwrite an unrelated/manual payment with an assumed total.
          const originalRows =
            matches.length === 1
              ? [
                  ...new Set(
                    sources(paid[0])
                      .filter(
                        (key) =>
                          key.startsWith(documentPrefix) && key.endsWith("]"),
                      )
                      .map((key) => key.slice(documentPrefix.length, -1)),
                  ),
                ].map((id) => byId.get(id))
              : [];
          const originalTotal =
            originalRows.reduce(
              (total, entry) => total + Math.round((entry?.amount || 0) * 100),
              0,
            ) / 100;
          if (
            combineDates.has(row.date) &&
            originalRows.length > 0 &&
            originalRows.every(
              (entry) =>
                entry &&
                entry.kind === "charge" &&
                entry.date === row.date &&
                entry.currency === row.currency,
            ) &&
            Math.abs(Number(paid[0].get("amount")) - originalTotal) < 0.00001
          ) {
            mergeTarget = paid[0];
            values.amount =
              (Math.round(originalTotal * 100) +
                Math.round(values.amount * 100)) /
              100;
          } else {
            if (
              matches.length !== 1 ||
              paid.some((p) =>
                sources(p).some((key) =>
                  key.startsWith(
                    `[monline-statement:${statement.getString("file_hash")}:`,
                  ),
                ),
              ) ||
              !paid.every(
                (p) =>
                  Math.abs(Number(p.get("amount")) - values.amount) < 0.00001,
              )
            ) {
              markBatchConflict();
              continue;
            }
            // Preserve the original payment and its note; remember this source too.
            paid[0].set("statement_sources", [
              ...new Set([...sources(paid[0]), ...markers]),
            ]);
            tx.save(paid[0]);
            indexPayment(paid[0]);
            result.payments_skipped += pending.length;
            continue;
          }
        }
        if (matches.length > 1) {
          markBatchConflict();
          continue;
        }
        const payment =
          mergeTarget ||
          matches[0] ||
          new DataRecord(tx.findCollectionByNameOrId("payment_records"));
        const note = payment.getString("notes");
        for (const [key, value] of Object.entries({
          ...values,
          user: owner,
          subscription_id: subscription.id,
          notes: [
            note,
            ...pending.map(
              ({ row }) =>
                `${statement.getString("bank")} · ${row.merchant} · ${row.amount.toFixed(2)} ${row.currency}`,
            ),
          ]
            .filter(Boolean)
            .join("\n"),
          statement_sources: [...new Set([...sources(payment), ...markers])],
        }))
          payment.set(key, value);
        tx.save(payment);
        indexPayment(payment);
        result.payments_imported++;
      }
      if (subscription) {
        let changed = false;
        for (const field of Object.keys(relationIds)) {
          if (
            group[field] !== undefined &&
            subscription.getString(field) !== group[field]
          ) {
            subscription.set(field, group[field]);
            changed = true;
          }
        }
        if (changed) tx.save(subscription);
      }
      if (group.historical_payments != null) {
        if (!subscription) fail("statement_import_invalid");
        // The range is anchored to the server-owned statement rows, never to a
        // client-supplied start date. Existing subscription settings stay intact.
        const schedule = new DataRecord(subscription.collection(), {
          ...subscription.publicExport(),
          start_date: rows[0].row.date,
          next_payment: rows[0].row.date,
        });
        const history = prepareBackfill(
          tx,
          schedule,
          group.historical_payments,
          now,
        );
        const statementDates = new Set(rows.map(({ row }) => row.date));
        if (history.some((payment) => statementDates.has(payment.due_date)))
          fail("backfill_invalid_selection");
        backfills.push({
          subscription,
          payments: history.map((payment) => ({
            ...payment,
            notes: `[monline-statement-backfill:${statement.id}]`,
          })),
        });
      }
    }
    // Report all affected statement rows together, and roll back every write.
    if (conflicts.size) {
      const error = new Error("statement_import_conflict");
      error.conflicts = [...conflicts.values()];
      throw error;
    }
    for (const backfill of backfills) {
      const saved = saveBackfill(tx, backfill.subscription, backfill.payments);
      result.payments_imported += saved;
      result.payments_skipped += backfill.payments.length - saved;
    }
    for (const { subscription, date } of scheduleAnchors.values()) {
      const next = nextStatementPayment(date, today);
      if (subscription.getString("next_payment").slice(0, 10) !== next) {
        subscription.set("next_payment", next);
        tx.save(subscription);
      }
    }
    return result;
  });
}
module.exports = { importStatement };
