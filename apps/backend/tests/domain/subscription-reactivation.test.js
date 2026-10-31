const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { Repository, DataRecord } = require('../../src/storage.cjs');
const { createAuth } = require('../../src/auth.cjs');
const { registerDataApi } = require('../../src/data-api.cjs');
const runtime = require('../../src/runtime.cjs');
const { restoreReactivatedMonth } = require('../../src/domain/lib/subscription-reactivation.js');
let repository, directory, owner, currency, category, cycles, app, auth, server;
function create(name, values) {
  const record = new DataRecord(repository.findCollectionByNameOrId(name));
  for (const [key, value] of Object.entries(values)) record.set(key, value);
  return repository.save(record);
}
function subscription(values = {}) {
  return create('subscriptions', { user: owner.id, name: 'ChatGPT', price: 20,
    currency: currency.id, category: category.id, cycle: cycles.Monthly.id,
    frequency: 1, next_payment: '2026-11-10', start_date: '2026-01-10',
    inactive: true, auto_renew: true, auto_mark_paid: true, ...values });
}
function records(sub) {
  return repository.findRecordsByFilter('payment_records', 'subscription_id = {:id}', 'due_date', 0, 0, { id: sub.id });
}
function activate(sub) { sub.set('inactive', false); return repository.save(sub); }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-31T12:00:00Z'));
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monline-reactivation-'));
  repository = new Repository(directory);
  owner = create('users', { email: 'owner@example.test', password: 'fixture-hash', payment_tracking: true, created: '2026-01-01T00:00:00Z' });
  currency = create('currencies', { user: owner.id, name: 'Dollar', code: 'USD', symbol: '$', rate: 1 });
  category = create('categories', { user: owner.id, name: 'Subscriptions' });
  cycles = Object.fromEntries(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'One-Time'].map(name => [name, create('cycles', { name })]));
  app = express(); auth = createAuth(repository);
  app.use(express.json()); app.use(auth.middleware); auth.register(app);
  runtime.configure(app, repository, auth);
  for (const name of ['subscription_history', 'subscription_reactivation', 'subscription_start']) {
    const file = '../../src/domain/' + name + '.js';
    delete require.cache[require.resolve(file)]; require(file);
  }
  registerDataApi(app, repository, auth);
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
});
afterEach(async () => {
  if (server) await new Promise(resolve => server.close(resolve)); server = undefined;
  repository.connection.close(); vi.useRealTimers();
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('monline-reactivation-')) throw Error('Unexpected fixture directory');
  fs.rmSync(resolved, { recursive: true, force: true });
});
it('adds October 10 unpaid when activated on October 31 with the next payment on November 10', () => {
  const sub = activate(subscription());
  expect(records(sub).map(record => record.publicExport())).toMatchObject([{
    due_date: '2026-10-10', paid_at: '', auto_paid: false, amount: 20, user: owner.id,
  }]);
  expect(sub.getString('next_payment')).toBe('2026-11-10');
  expect(sub.getBool('auto_mark_paid')).toBe(true);
});
it.each(['', '2026-10-12T10:00:00Z'])('preserves existing monthly records, including a different date and paid_at=%s', paid_at => {
  const sub = subscription();
  const existing = create('payment_records', { user: owner.id, subscription_id: sub.id,
    due_date: '2026-10-12', amount: 9, paid_at, notes: 'Keep my record' });
  activate(sub);
  expect(records(sub)).toHaveLength(1);
  expect(records(sub)[0].publicExport()).toMatchObject({ id: existing.id, amount: 9, paid_at, notes: 'Keep my record' });
});
it('preserves a payment moved out of the month without recreating its scheduled date', () => {
  const sub = subscription();
  create('payment_records', { user: owner.id, subscription_id: sub.id, due_date: '2026-11-01', scheduled_date: '2026-10-10', amount: 20 });
  activate(sub); expect(records(sub).map(record => record.getString('due_date'))).toEqual(['2026-11-01']);
});
it('does not duplicate an already projected calendar payment', () => {
  const sub = activate(subscription({ next_payment: '2026-10-10' })); expect(records(sub)).toEqual([]);
});
it('only restores this month and remains idempotent across repeated activation and ordinary edits', () => {
  let sub = subscription();
  create('payment_records', { user: owner.id, subscription_id: sub.id, due_date: '2026-09-10', amount: 5, paid_at: '2026-09-10T12:00:00Z' });
  sub = activate(sub); sub.set('inactive', true); repository.save(sub); activate(sub);
  sub.set('price', 30); repository.save(sub);
  expect(records(sub).map(record => [record.getString('due_date'), record.getFloat('amount')])).toEqual([['2026-09-10', 5], ['2026-10-10', 20]]);
});
it.each([
  ['Yearly', '2027-11-10', 1, []],
  ['Yearly', '2027-10-10', 1, ['2026-10-10']],
  ['Quarterly', '2027-01-10', 1, ['2026-10-10']],
  ['Monthly', '2027-01-10', 3, ['2026-10-10']],
  ['Half-Yearly', '2027-04-10', 1, ['2026-10-10']],
  ['Weekly', '2026-11-07', 1, ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']],
  ['Quarterly', '2026-12-10', 1, []],
])('follows the %s cycle anchored on %s x%s', (cycle, next_payment, frequency, expected) => {
  const sub = activate(subscription({ cycle: cycles[cycle].id, next_payment, frequency }));
  expect(records(sub).map(record => record.getString('due_date'))).toEqual(expected);
});
it.each([
  ['2026-09-30', '2026-10-31', '2026-09-30'],
  ['2024-02-29', '2024-03-31', '2024-02-29'],
])('keeps month ends on %s', (today, next_payment, expected) => {
  vi.setSystemTime(new Date(today + 'T12:00:00Z'));
  const sub = activate(subscription({ start_date: '2024-01-01', next_payment }));
  expect(records(sub).map(record => record.getString('due_date'))).toEqual([expected]);
});
it.each([
  { start_date: '2026-11-01' }, { end_date: '2026-09-30' },
  { cancellation_date: '2026-10-05' }, { payment_limit: 3, payments_completed: 3 },
  { record_type: 'credit', cycle: 'One-Time' },
])('respects start, end, cancellation, completed and income bounds: %j', input => {
  const sub = activate(subscription({ ...input, ...(input.cycle ? { cycle: cycles[input.cycle].id } : {}) }));
  expect(records(sub)).toEqual([]);
});
it('does not turn editing an inactive subscription or restoring an account into reactivation', () => {
  const sub = subscription(); sub.set('price', 25); repository.save(sub);
  expect(records(sub)).toEqual([]);
  sub.set('__monline_restore', true); activate(sub); expect(records(sub)).toEqual([]);
});
it('rolls activation back if the missing payment cannot be stored', () => {
  const sub = subscription();
  repository.connection.exec("CREATE TRIGGER fail_reactivation BEFORE INSERT ON payment_records BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
  expect(() => activate(sub)).toThrow();
  expect(repository.findRecordById('subscriptions', sub.id).getBool('inactive')).toBe(true);
  expect(records(sub)).toEqual([]);
});
it('enforces ownership and returns the new unpaid record through the authenticated data API', async () => {
  const sub = subscription();
  const other = create('users', { email: 'other@example.test', password: 'fixture-hash', created: '2026-02-01T00:00:00Z' });
  server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const request = async (url, user, method = 'GET', body) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + url, {
      method, headers: { Authorization: 'Bearer ' + repository.issueSession(user), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  expect((await request('/api/data/subscriptions/' + sub.id, other, 'PATCH', { inactive: false })).status).toBe(404);
  expect(records(sub)).toEqual([]);
  const saved = await request('/api/data/subscriptions/' + sub.id, owner, 'PATCH', { inactive: false });
  expect(saved.status, JSON.stringify(saved.data)).toBe(200);
  expect(saved.data.inactive).toBe(false);
  expect(records(sub).map(record => [record.getString('due_date'), record.getString('paid_at')])).toEqual([['2026-10-10', '']]);
  const listed = await request('/api/data/payment_records', owner);
  expect(listed.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ subscription_id: sub.id, due_date: '2026-10-10', paid_at: '' })]));
  const privateList = await request('/api/data/payment_records', other);
  expect(privateList.data.items).toEqual([]);
});
