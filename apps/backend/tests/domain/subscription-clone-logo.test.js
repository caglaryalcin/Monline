const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { Repository, DataRecord } = require('../../src/storage.cjs');
const { createAuth } = require('../../src/auth.cjs');
const { registerDataApi } = require('../../src/data-api.cjs');
const runtime = require('../../src/runtime.cjs');

const logoBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPzUAAAAASUVORK5CYII=', 'base64');
let repository, directory, server, base, owner, other, currency, cycle;
function create(collection, values) {
  const record = new DataRecord(repository.findCollectionByNameOrId(collection));
  for (const [key, value] of Object.entries(values)) record.set(key, value);
  return repository.save(record);
}
function subscription(values = {}) {
  return create('subscriptions', {
    user: owner.id, name: 'SimpleLogin', price: 36, currency: currency.id,
    cycle: cycle.id, frequency: 1, start_date: '2026-01-01', next_payment: '2027-01-01',
    auto_renew: true, url: '', logo: runtime.files.fileFromBytes(logoBytes, 'simplelogin.png'), ...values,
  });
}
function request(url, method = 'GET', body, user = owner) {
  return fetch(base + url, { method, headers: {
    Authorization: 'Bearer ' + user.newAuthToken(), 'Content-Type': 'application/json',
  }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function duplicate(source, user = owner) {
  return request('/api/subscription/clone', 'POST', { id: source.id }, user);
}
async function expectLogo(record) {
  const response = await request('/api/files/subscriptions/' + record.id + '/' + record.getString('logo'));
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(logoBytes);
}
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monline-clone-logo-'));
  repository = new Repository(directory);
  owner = create('users', { email: 'owner@example.test', password: 'fixture-hash' });
  other = create('users', { email: 'other@example.test', password: 'fixture-hash' });
  currency = create('currencies', { user: owner.id, name: 'Dollar', code: 'USD', symbol: '$', rate: 1 });
  cycle = create('cycles', { name: 'Yearly' });
  const app = express();
  const auth = createAuth(repository);
  app.use(express.json());
  app.use(auth.middleware);
  runtime.configure(app, repository, auth);
  registerDataApi(app, repository, auth);
  const route = require.resolve('../../src/domain/routes_subscriptions.js');
  delete require.cache[route];
  require(route);
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  base = 'http://127.0.0.1:' + server.address().port;
});
afterEach(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  repository.connection.close();
  const target = path.resolve(directory);
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('monline-clone-logo-'))
    throw Error('Unexpected fixture directory');
  fs.rmSync(target, { recursive: true, force: true });
});

it('copies an uploaded SimpleLogin logo to independent storage and serves it after deleting the source', async () => {
  const source = subscription({ inactive: true, payments_completed: 3, payment_limit: 12 });
  const response = await duplicate(source);
  expect(response.status).toBe(200);
  const clone = repository.findRecordById('subscriptions', (await response.json()).id);
  expect(clone.id).not.toBe(source.id);
  expect(clone.getString('logo')).toMatch(/^[a-f0-9]{16}_simplelogin\.png$/);
  expect(clone.getBool('inactive')).toBe(false);
  expect(clone.getFloat('payments_completed')).toBe(0);
  await expectLogo(clone);
  const removed = await request('/api/data/subscriptions/' + source.id, 'DELETE');
  expect(removed.status).toBe(204);
  await expectLogo(clone);
});
it('keeps filenames stable across repeated duplicates', async () => {
  const first = await duplicate(subscription());
  expect(first.status).toBe(200);
  const clone = repository.findRecordById('subscriptions', (await first.json()).id);
  const second = await duplicate(clone);
  expect(second.status).toBe(200);
  const descendant = repository.findRecordById('subscriptions', (await second.json()).id);
  expect(descendant.getString('logo')).toMatch(/^[a-f0-9]{16}_simplelogin\.png$/);
  await expectLogo(descendant);
});
it.each(['', 'missing.png'])('still duplicates records whose logo is absent: %s', async logo => {
  const source = subscription({ logo });
  const response = await duplicate(source);
  expect(response.status).toBe(200);
  const clone = repository.findRecordById('subscriptions', (await response.json()).id);
  expect(clone.getString('logo')).toBe('');
  expect(clone.getString('name')).toBe('SimpleLogin');
});
it('rejects another account before accessing or copying a private logo', async () => {
  const source = subscription();
  const response = await duplicate(source, other);
  expect(response.status).toBe(403);
  expect(repository.countRecords('subscriptions')).toBe(1);
});
