const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const root = path.resolve(process.env.MONLINE_TEST_ROOT || '.');
const load = file => require(path.join(root, 'apps/backend/src', file));
const { Repository, DataRecord } = load('storage.cjs');
const { lastWeekdayOfMonth, weekdayBillingOnOrAfter } = load('domain/lib/pure/last-weekday.mjs');
const { advanceDate, getPricePerMonth } = load('domain/lib/date-helpers.js');
const { backfillDates } = load('domain/lib/pure/backfill-schedule.js');
const { nextTrialPaymentDate } = load('domain/lib/pure/subscription-trial.mjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monline-lastweekday-'));
  const app = new Repository(directory);
  t.after(() => { app.connection.close(); assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir())); assert(path.basename(directory).startsWith('monline-lastweekday-')); fs.rmSync(directory, { recursive: true, force: true }); });
  const create = (name, data) => { const row = new DataRecord(app.findCollectionByNameOrId(name)); for (const [key,value] of Object.entries(data)) row.set(key,value); return app.save(row); };
  const user = create('users', {email:'fixture@example.test',password:'hash',payment_tracking:true});
  const currency = create('currencies', {user:user.id,name:'Lira',code:'TRY',symbol:'₺',rate:1,is_main:true});
  const category = create('categories', {user:user.id,name:'Fixture'});
  const cycle = create('cycles', {name:'Last-Weekday'});
  const express = require(require.resolve('express', {paths:[path.join(root,'apps/backend')]}));
  load('runtime.cjs').configure(express(), app, {});
  const hook = path.join(root, 'apps/backend/src/domain/subscription_start.js'); delete require.cache[require.resolve(hook)]; require(hook);
  const sub = (data={}) => create('subscriptions', {user:user.id,name:'Fixture payment',price:100,currency:currency.id,category:category.id,cycle:cycle.id,frequency:1,next_payment:'2026-12-31',start_date:'2026-12-31',auto_renew:true,auto_mark_paid:true,...data});
  return {app,create,user,currency,category,cycle,sub};
}

for (const [date, expected] of [['2027-01-01','2027-01-29'],['2027-02-01','2027-02-26'],['2028-02-01','2028-02-29'],['2026-10-01','2026-10-30'],['2026-12-01','2026-12-31']])
  test('last weekday for '+date, () => assert.equal(lastWeekdayOfMonth(date), expected));
test('invalid dates are rejected and public weekdays remain eligible', () => { for (const date of ['', '2026-02-30', 'bad']) assert.equal(lastWeekdayOfMonth(date),''); assert.equal(lastWeekdayOfMonth('2026-12-25'),'2026-12-31'); });
test('recurrence never drifts after short or weekend-ending months', () => { let date = new Date('2026-12-31T00:00:00Z'); const actual=[]; for(let i=0;i<4;i++){ date=advanceDate(date,'Last-Weekday',1,31); actual.push(date.toISOString().slice(0,10)); } assert.deepEqual(actual,['2027-01-29','2027-02-26','2027-03-31','2027-04-30']); assert.equal(advanceDate(new Date('2027-01-29T00:00:00Z'),'Last-Weekday',2).toISOString().slice(0,10),'2027-03-31'); assert.equal(getPricePerMonth(600,'Last-Weekday',2,1),300); });
test('backfill uses the same rule with a February anchor and finite limits', () => { const input={start:'2026-12-01',anchorDate:'2027-02-26',until:'2027-04-30',cycle:'Last-Weekday',frequency:1}; assert.deepEqual(backfillDates(input),['2026-12-31','2027-01-29','2027-02-26','2027-03-31','2027-04-30']); assert.deepEqual(backfillDates({...input,limit:2}),['2026-12-31','2027-01-29']); });
test('trial resumes only at an eligible weekday on or after its end', () => { const trial={trial_duration:1,trial_unit:'month',trial_start_date:'2027-01-15'}; assert.equal(nextTrialPaymentDate(trial,'2027-01-15',15,'Last-Weekday'),'2027-02-26'); assert.equal(weekdayBillingOnOrAfter('2027-01-31'),'2027-02-26'); assert.deepEqual(backfillDates({start:'2027-01-15',anchorDate:'2027-01-15',until:'2027-03-31',cycle:'Last-Weekday',frequency:1,trial}),['2027-01-15','2027-02-26','2027-03-31']); });
test('save normalizes only the next schedule and leaves existing paid records intact', t => { const f=fixture(t); const sub=f.sub({next_payment:'2027-01-31'}); assert.equal(sub.getString('next_payment'),'2027-01-29'); const paid=f.create('payment_records',{user:f.user.id,subscription_id:sub.id,due_date:'2026-12-31',paid_at:'2027-01-04T12:00:00Z',amount:87}); sub.set('next_payment','2027-02-28'); f.app.save(sub); assert.equal(sub.getString('next_payment'),'2027-02-26'); const stored=f.app.findRecordById('payment_records',paid.id); assert.equal(stored.getFloat('amount'),87); assert.equal(stored.getString('due_date').slice(0,10),'2026-12-31'); assert.equal(stored.getString('paid_at'),'2027-01-04T12:00:00Z'); });
test('automatic renewal records the right dates and retries do not duplicate payments', t => { const f=fixture(t), sub=f.sub(); const {advanceSubscription}=load('domain/lib/subscription-schedule.js'); advanceSubscription(f.app,sub.id,'2027-03-31'); const records=f.app.findRecordsByFilter('payment_records','subscription_id = {:id}','due_date',0,0,{id:sub.id}); assert.deepEqual(records.map(r=>r.getString('due_date').slice(0,10)),['2026-12-31','2027-01-29','2027-02-26','2027-03-31']); assert(records.every(r=>r.getFloat('amount')===100)); assert.equal(f.app.findRecordById('subscriptions',sub.id).getString('next_payment'),'2027-04-30'); advanceSubscription(f.app,sub.id,'2027-03-31'); assert.equal(f.app.countRecords('payment_records'),4); });
test('finite subscriptions stop on their last allowed occurrence', t => { const f=fixture(t), sub=f.sub({payment_limit:3}); load('domain/lib/subscription-schedule.js').advanceSubscription(f.app,sub.id,'2027-06-30'); const stored=f.app.findRecordById('subscriptions',sub.id); assert.equal(stored.getString('next_payment'),'2027-02-26'); assert.equal(stored.getBool('inactive'),true); assert.equal(f.app.countRecords('payment_records'),3); });
test('calendar projection accepts last weekdays and rejects ordinary month-end dates', t => { const f=fixture(t), sub=f.sub(); const {projectedOccurrence}=load('domain/lib/calendar-move.js'); assert.equal(projectedOccurrence(f.app,sub,'2027-01-29'),true); assert.equal(projectedOccurrence(f.app,sub,'2027-01-31'),false); assert.equal(projectedOccurrence(f.app,sub,'2027-02-26'),true); });
test('account backup preserves the new cycle and maps it when imported', t => { const f=fixture(t), sub=f.sub(); const backup=load('domain/lib/account-backup.js'); const exported=backup.exportAccount(f.app,f.user.id); assert(exported.cycles.some(c=>c.name==='Last-Weekday')); const other=f.create('users',{email:'other@example.test',password:'hash'}); backup.importAccount(f.app,other.id,exported,false,{recoverHistory:false}); const restored=f.app.findRecordsByFilter('subscriptions','user = {:id}','',1,0,{id:other.id})[0]; assert(restored); assert.equal(f.app.findRecordById('cycles',restored.getString('cycle')).getString('name'),'Last-Weekday'); assert.equal(restored.getString('next_payment'),sub.getString('next_payment')); });
