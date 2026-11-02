const test = it;
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const root = path.resolve(process.env.MONLINE_TRIAL_ROOT || path.join(__dirname, '../../../..'));
const load = file => require(path.join(root, 'apps/backend/src', file));
const { Repository, DataRecord } = load('storage.cjs');
const { subscriptionAmount, isTrialDate, nextTrialPaymentDate, trialEndDate } = load('domain/lib/pure/subscription-trial.mjs');
const { advanceSubscription } = load('domain/lib/subscription-schedule.js');
const { projectedOccurrence, moveCalendarPayment } = load('domain/lib/calendar-move.js');
const { saveScheduledPayment } = load('domain/lib/scheduled-payments.js');
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monline-trial-'));
  const app = new Repository(directory);
  const create = (collection, values) => { const record = new DataRecord(app.findCollectionByNameOrId(collection)); for (const [key,value] of Object.entries(values)) record.set(key,value); return app.save(record); };
  const user = create('users', { email:'trial@example.test', password:'fixture-hash', payment_tracking:true });
  const currency = create('currencies', { user:user.id, name:'Forint', code:'HUF', symbol:'Ft', rate:1, is_main:true });
  const monthly = create('cycles', { name:'Monthly' }), yearly = create('cycles', { name:'Yearly' });
  const subscription = (values={}) => create('subscriptions', { user:user.id, name:'YouTube Premium', price:200, currency:currency.id, cycle:monthly.id, frequency:1, next_payment:'2026-11-01', start_date:'2026-11-01', trial_months:3, trial_start_date:'2026-11-01', auto_renew:true, auto_mark_paid:true, ...values });
  return { app, user, currency, monthly, yearly, create, subscription, close() { app.connection.close(); const target=path.resolve(directory); assert.equal(path.dirname(target),path.resolve(os.tmpdir())); assert(path.basename(target).startsWith('monline-trial-')); fs.rmSync(target,{recursive:true,force:true}); } };
}
test('counts the starting month, keeps the normal price, and expires across a year boundary',()=>{
  const sub={ price:200, trial_months:3, trial_start_date:'2026-11-15' };
  assert.equal(trialEndDate(sub),'2027-02-15');
  assert.deepEqual(['2026-10-15','2026-11-15','2026-12-15','2027-01-15','2027-02-15'].map(date=>subscriptionAmount(sub,date)),[200,0,0,0,200]);
  assert.equal(sub.price,200);
  assert.equal(isTrialDate({...sub,record_type:'credit'},'2026-11-15'),false);
});
test('preserves billing anchors through short and leap-year months',()=>{
  const sub={price:200,trial_months:3,trial_start_date:'2027-12-31',billing_anchor_day:31};
  assert.equal(trialEndDate(sub),'2028-03-31');
  assert.equal(nextTrialPaymentDate(sub,'2028-01-31'),'2028-02-29');
  assert.equal(nextTrialPaymentDate(sub,'2028-02-29'),'2028-03-31');
  assert.equal(nextTrialPaymentDate(sub,'2028-03-31'),'');
});
test('validates and persists trial settings and rejects invalid input atomically',()=>{
 const f=fixture();try {
  const sub=f.subscription(); assert.equal(sub.getFloat('price'),200); assert.equal(sub.getFloat('trial_months'),3);
  assert.equal(f.app.findRecordById('subscriptions',sub.id).getString('trial_start_date'),'2026-11-01');
  for(const trial_months of [-1,1.5,121,'invalid'])assert.throws(()=>f.subscription({trial_months}),/trial_months_invalid/);
  assert.throws(()=>f.subscription({trial_start_date:'2026-02-30'}),/trial_start_invalid/);
  assert.equal(f.app.countRecords('subscriptions'),1);
  sub.set('trial_months',0);f.app.save(sub);assert.equal(sub.getString('trial_start_date'),'');assert.equal(subscriptionAmount(sub,'2026-11-01'),200);
 } finally {f.close();}
});
test('records three zero-cost months, resumes the normal amount, and is safe to retry',()=>{
 const f=fixture();try {
  const sub=f.subscription();advanceSubscription(f.app,sub.id,'2027-02-01');
  const records=f.app.findRecordsByFilter('payment_records','subscription_id = {:id}','due_date',0,0,{id:sub.id});
  assert.deepEqual(records.map(r=>[r.getString('due_date').slice(0,10),r.getFloat('amount')]),[['2026-11-01',0],['2026-12-01',0],['2027-01-01',0],['2027-02-01',200]]);
  assert.equal(f.app.findRecordById('subscriptions',sub.id).getString('next_payment'),'2027-03-01');
  assert.equal(f.app.findRecordById('subscriptions',sub.id).getFloat('price'),200);
  advanceSubscription(f.app,sub.id,'2027-02-01');assert.equal(f.app.countRecords('payment_records'),4);
 } finally {f.close();}
});
test('runs monthly free occurrences before resuming an annual billing cycle',()=>{
 const f=fixture();try {
  const sub=f.subscription({cycle:f.yearly.id,price:1200});
  assert.equal(projectedOccurrence(f.app,sub,'2026-12-01'),true);
  assert.equal(projectedOccurrence(f.app,sub,'2027-02-01'),true);
  assert.equal(projectedOccurrence(f.app,sub,'2027-03-01'),false);
  advanceSubscription(f.app,sub.id,'2027-02-01');
  assert.deepEqual(f.app.findRecordsByFilter('payment_records','subscription_id = {:id}','due_date',0,0,{id:sub.id}).map(r=>r.getFloat('amount')),[0,0,0,1200]);
  assert.equal(f.app.findRecordById('subscriptions',sub.id).getString('next_payment'),'2028-02-01');
 } finally {f.close();}
});
test('preserves recorded amounts and the original free amount when moving a trial payment',()=>{
 const f=fixture();try {
  const sub=f.subscription();
  assert.equal(saveScheduledPayment(f.app,sub,'2026-11-01',false),true);
  const record=f.app.findRecordsByFilter('payment_records','subscription_id = {:id}','',1,0,{id:sub.id})[0];
  record.set('amount',25);f.app.save(record);
  assert.equal(saveScheduledPayment(f.app,sub,'2026-11-01',false),false);
  assert.equal(f.app.findRecordById('payment_records',record.id).getFloat('amount'),25);
  moveCalendarPayment(f.app,f.user.id,{subscription_id:sub.id,from_date:'2027-01-01',to_date:'2027-02-02'});
  const moved=f.app.findRecordsByFilter('payment_records','scheduled_date = {:date}','',1,0,{date:'2027-01-01'})[0];
  assert.equal(moved.getFloat('amount'),0);
 } finally {f.close();}
});
test('backs up trial metadata and zero-cost payments without losing their currency',()=>{
 const f=fixture();try {
  const sub=f.subscription();saveScheduledPayment(f.app,sub,'2026-11-01',true);
  const {exportAccount,importAccount}=load('domain/lib/account-backup.js');
  const backup=exportAccount(f.app,f.user.id);
  assert.equal(backup.data.subscriptions[0].trial_months,3);
  assert.equal(backup.data.subscriptions[0].trial_start_date,'2026-11-01');
  assert.equal(backup.data.payment_records[0].amount,0);
  const other=f.create('users',{email:'restored@example.test',password:'fixture-hash'});
  importAccount(f.app,other.id,backup,false);
  const restored=f.app.findRecordsByFilter('subscriptions','user = {:id}','',1,0,{id:other.id})[0];
  assert.equal(subscriptionAmount(restored,'2026-12-01'),0);assert.equal(restored.getFloat('price'),200);
  const payment=f.app.findRecordsByFilter('payment_records','user = {:id}','',1,0,{id:other.id})[0];
  assert.equal(payment.getFloat('amount'),0);assert.equal(f.app.findRecordById('currencies',restored.getString('currency')).getString('code'),'HUF');
 } finally {f.close();}
});
test('does not estimate paid money for zero-cost trial records',()=>{
 const history=load('domain/lib/pure/subscription-history.js');
 const {advanceDate}=load('domain/lib/date-helpers.js');
 const trial={trial_months:3,trial_start_date:'2026-11-01'};
 const segments=[{from:'2026-11-01',price:200,cycleName:'Monthly',frequency:1}];
 assert.equal(history.computeSpendTotal({segments,until:'2027-02-01',advanceDate,trial}).total,200);
 assert.equal(history.summarizePaidRecords([{amount:0,due_date:'2026-11-01',paid_at:'2026-11-01T00:00:00Z'}],segments,trial).total,0);
 assert.equal(history.summarizePaidRecords([{amount:0,due_date:'2026-11-01',paid_at:'2026-11-01T00:00:00Z'}],segments,{trial_months:0}).total,0);
});
test('saves, reloads and duplicates trial settings through authenticated HTTP routes',async()=>{
 const f=fixture();let server;try {
  const express=require(path.join(root,'apps/backend/node_modules/express'));
  const {createAuth}=load('auth.cjs'),{registerDataApi}=load('data-api.cjs'),runtime=load('runtime.cjs');
  const web=express(),auth=createAuth(f.app);web.use(express.json());web.use(auth.middleware);runtime.configure(web,f.app,auth);registerDataApi(web,f.app,auth);
  const route=path.join(root,'apps/backend/src/domain/routes_subscriptions.js');delete require.cache[route];require(route);
  web.use((error,req,res,next)=>res.status(error.status||500).json({message:error.message}));
  server=await new Promise(resolve=>{const instance=web.listen(0,'127.0.0.1',()=>resolve(instance));});
  const base='http://127.0.0.1:'+server.address().port,token=f.user.newAuthToken();
  const request=(url,method='GET',body)=>fetch(base+url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const created=await request('/api/data/subscriptions','POST',{user:f.user.id,name:'YouTube Premium',price:200,currency:f.currency.id,cycle:f.monthly.id,frequency:1,next_payment:'2026-11-01',trial_months:3,trial_start_date:'2026-11-01'});
  assert.equal(created.status,201);const sub=await created.json();assert.equal(sub.trial_months,3);
  const reloaded=await request('/api/data/subscriptions/'+sub.id);assert.equal((await reloaded.json()).trial_start_date,'2026-11-01');
  const cloneResponse=await request('/api/subscription/clone','POST',{id:sub.id});assert.equal(cloneResponse.status,200);
  const cloned=f.app.findRecordById('subscriptions',(await cloneResponse.json()).id);assert.equal(cloned.getFloat('trial_months'),3);
  const changed=await request('/api/data/subscriptions/'+sub.id,'PATCH',{trial_months:2});assert.equal(changed.status,200);assert.equal((await changed.json()).trial_months,2);
  const invalid=await request('/api/data/subscriptions/'+sub.id,'PATCH',{trial_months:1.5});assert.equal(invalid.status,400);assert.equal(f.app.findRecordById('subscriptions',sub.id).getFloat('trial_months'),2);
 } finally {if(server)await new Promise(resolve=>server.close(resolve));f.close();}
});
test('registers Hungarian reminder templates and keeps translated placeholders intact',()=>{
 const language=load('notification-language.cjs');assert.equal(language.resolveLanguage('hu-HU'),'hu');assert.equal(language.resolveLanguage('hu_HU'),'hu');
 assert.equal(language.copyFor('hu').openApp,'Monline megnyitása');
 const en=JSON.parse(fs.readFileSync(path.join(root,'apps/web/src/lib/locales/en.json'),'utf8'));
 const hu=JSON.parse(fs.readFileSync(path.join(root,'apps/web/src/lib/locales/hu.json'),'utf8'));
 for(const[key,value]of Object.entries(en)){
  assert(hu[key],key+' is missing in Hungarian');
  const placeholders=text=>[...text.matchAll(/\{\{[^}]+\}\}/g)].map(m=>m[0]).sort();
  assert.deepEqual(placeholders(hu[key]),placeholders(value),key+' placeholders');
 }
 assert.equal(hu.trial_period,'Próbaidő');
});


it.each([
  ["day", 7, "2026-11-09"],
  ["week", 1, "2026-11-09"], ["week", 2, "2026-11-16"], ["week", 3, "2026-11-23"],
  ["month", 1, "2026-12-02"], ["month", 2, "2027-01-02"], ["month", 3, "2027-02-02"],
  ["month", 6, "2027-05-02"], ["year", 1, "2027-11-02"],
])("ends a %s/%i trial on its exact date and charges only after it", (unit, duration, end) => {
  const trial = { price: 200, trial_duration: duration, trial_unit: unit, trial_start_date: "2026-11-02" };
  expect(trialEndDate(trial)).toBe(end);
  expect(subscriptionAmount(trial, "2026-11-01")).toBe(200);
  expect(subscriptionAmount(trial, "2026-11-02")).toBe(0);
  const last = new Date(end + "T12:00:00Z"); last.setUTCDate(last.getUTCDate() - 1);
  expect(subscriptionAmount(trial, last.toISOString().slice(0, 10))).toBe(0);
  expect(subscriptionAmount(trial, end)).toBe(200);
  expect(nextTrialPaymentDate(trial, "2026-11-02")).toBe(end);
});

it("catches up a weekly trial on the first paid date and preserves its new monthly billing day", () => {
  const f = fixture();
  try {
    const sub = f.subscription({trial_months:0, trial_duration:1, trial_unit:"week", trial_start_date:"2026-11-02",
      start_date:"2026-11-02", next_payment:"2026-11-02", billing_anchor_day:9});
    advanceSubscription(f.app, sub.id, "2026-12-09");
    expect(f.app.findRecordsByFilter("payment_records", "subscription_id = {:id}", "due_date", 0, 0, {id:sub.id})
      .map(row => [row.getString("due_date").slice(0,10), row.getFloat("amount")]))
      .toEqual([["2026-11-02",0],["2026-11-09",200],["2026-12-09",200]]);
    expect(f.app.findRecordById("subscriptions",sub.id).getString("next_payment")).toBe("2027-01-09");
    advanceSubscription(f.app, sub.id, "2026-12-09");
    expect(f.app.countRecords("payment_records")).toBe(3);
    const { exportAccount, importAccount } = load("domain/lib/account-backup.js");
    const backup = exportAccount(f.app, f.user.id);
    expect(backup.data.subscriptions[0]).toMatchObject({trial_duration:1,trial_unit:"week",trial_months:0});
    const other = f.create("users", {email:"weekly-restore@example.test",password:"fixture-hash"});
    importAccount(f.app, other.id, backup, false);
    const restored = f.app.findRecordsByFilter("subscriptions","user = {:id}","",1,0,{id:other.id})[0];
    expect(subscriptionAmount(restored,"2026-11-08")).toBe(0);
    expect(subscriptionAmount(restored,"2026-11-09")).toBe(200);
  } finally { f.close(); }
});

it("rejects malformed flexible trials without persisting a partial subscription", () => {
  const f = fixture();
  try {
    for (const change of [{trial_duration:-1},{trial_duration:1.5},{trial_duration:0.5},{trial_duration:521},
      {trial_duration:1,trial_unit:"invalid"},{trial_duration:1,record_type:"credit"}]) {
      expect(() => f.subscription({trial_months:0,trial_unit:"week",...change})).toThrow("trial_duration_invalid");
    }
    const subscription = f.subscription({trial_months:0,trial_duration:2,trial_unit:"week"});
    subscription.set("trial_duration",0); f.app.save(subscription);
    expect(subscription.getString("trial_start_date")).toBe("");
    expect(subscription.getString("trial_unit")).toBe("");
    expect(f.app.countRecords("subscriptions")).toBe(1);
    expect(trialEndDate({trial_duration:1,trial_unit:"month",trial_start_date:"2028-01-31"})).toBe("2028-02-29");
    expect(trialEndDate({trial_duration:1,trial_unit:"year",trial_start_date:"2028-02-29"})).toBe("2029-02-28");
  } finally { f.close(); }
});
