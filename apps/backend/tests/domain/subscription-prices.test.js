const test = it;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Repository, DataRecord } = require('../../src/storage.cjs');
const { subscriptionAmount } = require('../../src/domain/lib/pure/subscription-trial.mjs');
const { validatePriceChanges } = require('../../src/domain/lib/pure/subscription-prices.mjs');
const { saveScheduledPayment } = require('../../src/domain/lib/scheduled-payments.js');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monline-scheduled-prices-'));
  const app = new Repository(directory);
  t.onTestFinished(() => {
    app.connection.close();
    const target = path.resolve(directory);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert(path.basename(target).startsWith('monline-scheduled-prices-'));
    fs.rmSync(target, { recursive: true, force: true });
  });
  const create = (collection, values) => {
    const record = new DataRecord(app.findCollectionByNameOrId(collection));
    for (const [key, value] of Object.entries(values)) record.set(key, value);
    return app.save(record);
  };
  const user = create('users', { email: 'schedule@example.test', password: 'fixture-hash' });
  const currency = create('currencies', { user: user.id, code: 'USD', name: 'Dollar', symbol: '$', rate: 1 });
  const cycle = create('cycles', { name: 'Monthly' });
  const sub = create('subscriptions', { user: user.id, name: 'Plan', price: 40, currency: currency.id, cycle: cycle.id, frequency: 1, next_payment: '2099-05-01', start_date: '2020-01-01', auto_renew: true });
  const payment = (values) => create('payment_records', { user: user.id, subscription_id: sub.id, amount: 40, ...values });
  return { app, sub, create, payment };
}

test('uses the effective date inclusively, supports multiple prices and retains free trials', () => {
  const sub = { price: 40, price_changes: [{ effective_date: '2099-07-01', price: 30 }, { effective_date: '2099-06-01', price: 20 }] };
  assert.deepEqual(['2099-05-31', '2099-06-01', '2099-06-30', '2099-07-01'].map(date => subscriptionAmount(sub, date)), [40, 20, 20, 30]);
  assert.equal(subscriptionAmount({ ...sub, trial_duration: 2, trial_unit: 'month', trial_start_date: '2099-05-01' }, '2099-06-15'), 0);
  assert.equal(sub.price, 40);
});

test('rejects malformed, duplicate, impossible dates and invalid amounts', () => {
  for (const input of ['{bad', {}, [{ effective_date: '2099-02-30', price: 20 }], [{ effective_date: '2099-06-01', price: -1 }], [{ effective_date: '2099-06-01', price: null }], [{ effective_date: '2099-06-01', price: 20 }, { effective_date: '2099-06-01', price: 30 }]]) assert.throws(() => validatePriceChanges(input));
});

test('reprices future estimates and cancellation without changing past, paid, moved or custom amounts', (t) => {
  const { app, sub, payment } = fixture(t);
  const before = payment({ due_date: '2099-05-01' });
  const future = payment({ due_date: '2099-06-15' });
  const paid = payment({ due_date: '2099-07-01', paid_at: '2026-01-01T00:00:00Z' });
  const past = payment({ due_date: '2020-01-01' });
  const custom = payment({ due_date: '2099-08-01', amount: 55 });
  const moved = payment({ due_date: '2099-09-03', scheduled_date: '2099-09-01' });
  const amount = row => app.findRecordById('payment_records', row.id).getFloat('amount');
  sub.set('price_changes', [{ effective_date: '2099-06-01', price: 20 }]);
  app.save(sub);
  assert.deepEqual([before, future, paid, past, custom, moved].map(amount), [40, 20, 40, 40, 55, 40]);
  assert.equal(app.findRecordById('subscriptions', sub.id).getFloat('price'), 40);
  sub.set('price_changes', []);
  app.save(sub);
  assert.deepEqual([before, future, paid, past, custom, moved].map(amount), [40, 40, 40, 40, 55, 40]);
});

test('automatic charges use the dated price and retries preserve recorded amounts', (t) => {
  const { app, sub } = fixture(t);
  sub.set('price_changes', [{ effective_date: '2099-06-01', price: 20 }]);
  app.save(sub);
  assert.equal(saveScheduledPayment(app, sub, '2099-05-01', false), true);
  assert.equal(saveScheduledPayment(app, sub, '2099-06-01', false), true);
  assert.equal(saveScheduledPayment(app, sub, '2099-06-01', true), false);
  const records = app.findRecordsByFilter('payment_records', 'subscription_id = {:id}', 'due_date', 0, 0, { id: sub.id });
  assert.deepEqual(records.map(row => row.getFloat('amount')), [40, 20]);
});

test('retains elapsed price changes from imports and rejects attempts to edit or remove them', (t) => {
  const { app, sub } = fixture(t);
  sub.set('__monline_import_prices', true);
  sub.set('price_changes', [{ effective_date: '2020-02-01', price: 20 }]);
  app.save(sub);
  const loaded = app.findRecordById('subscriptions', sub.id);
  loaded.set('notes', 'Unrelated edit');
  app.save(loaded);
  loaded.set('price_changes', []);
  assert.throws(() => app.save(loaded), /price_changes_future_only/);
  assert.equal(subscriptionAmount(app.findRecordById('subscriptions', sub.id), '2020-03-01'), 20);
});

test('history uses the price timeline while confirmed totals keep actual amounts', (t) => {
  const { app, sub, payment } = fixture(t);
  sub.set('__monline_import_prices', true);
  sub.set('price_changes', [{ effective_date: '2020-02-01', price: 20 }]);
  app.save(sub);
  payment({ due_date: '2020-01-01', paid_at: '2020-01-01T00:00:00Z' });
  payment({ due_date: '2020-03-01', paid_at: '2020-03-01T00:00:00Z', amount: 18 });
  const history = require('../../src/domain/lib/subscription-history.js').buildHistoryResponse(app, sub);
  assert.deepEqual(history.timeline.map(segment => [segment.from, segment.price]), [['2020-01-01', 40], ['2020-02-01', 20]]);
  assert.equal(history.totals.paid_total, 58);
  assert.equal(history.subscription.price, 20);
});
