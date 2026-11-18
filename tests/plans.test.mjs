import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createPlanStore} from '../plan-store.js';
import {planCatalog,planProgress,readPlanCache} from '../plan-catalog.js';
import {setupPlans} from '../plans.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
function cloud(){
 const runs=[],rows=[];let failed=false,lost=false,pause=null;
 function client(getUser){return {
  from(table){const filters=[];return {select(){return this;},eq(k,v){filters.push([k,v]);return this;},then(resolve,reject){const data=(table==='reading_plan_runs'?runs:rows).filter(row=>filters.every(([k,v])=>row[k]===v));return Promise.resolve(failed?{error:{message:'Network unavailable'}}:{data:structuredClone(data)}).then(resolve,reject);}};},
  async rpc(name,args){
   const owner=getUser()?.id,wait=pause;pause=null;if(wait)await wait;
   if(failed)return {error:{message:'Network unavailable'}};
   if(name==='start_personal_reading_plan'){
    let row=runs.find(r=>r.owner_id===owner&&r.version_id===args.p_version_id);
    if(!row){row={id:owner+'-'+args.p_version_id,version_id:args.p_version_id,owner_id:owner,created_at:new Date().toISOString(),mode:'personal'};runs.push(row);}
    return {data:[structuredClone(row)]};
   }
   const run=runs.find(r=>r.id===args.p_run_id&&r.owner_id===owner);if(!run)return {error:{message:'This study is unavailable'}};
   let row=rows.find(r=>r.run_id===run.id&&r.session_number===args.p_session);
   if((row?.revision||0)!==args.p_revision)return {error:{code:'40001',message:'This session changed on another device'}};
   if(!row){row={run_id:run.id,version_id:run.version_id,user_id:owner,session_number:args.p_session,revision:0};rows.push(row);}
   Object.assign(row,{reflection:args.p_reflection,completed:args.p_completed,revision:row.revision+1,updated_at:new Date().toISOString()});
   if(lost){lost=false;return {error:{message:'Response lost'}};}
   return {data:[structuredClone(row)]};
  }
 };}
 return {client,runs,rows,set failed(v){failed=v;},set lost(v){lost=v;},set pause(v){pause=v;}};
}
function signed(server,id='first',storage=memory()){
 let user={id};const account={getUser:()=>user,getClient:()=>client};const client=server.client(account.getUser);
 const store=createPlanStore({account,storage,delay:60000,online:()=>true});
 return {store,storage,account,setUser:id=>{user=id?{id}:null;}};
}

test('plans contain only reference schedules and progress follows actual session completion',()=>{
 assert.deepEqual(planCatalog.map(p=>p.sessions.length),[16,21,7]);
 for(const plan of planCatalog)for(const session of plan.sessions){assert.equal(session.devotional,null);assert.deepEqual(session.questions,[]);assert.ok(session.passages[0].chapter>0);}
 const p=planCatalog[0];assert.deepEqual(planProgress(p,{'mark-v1:1':{completed:true}}),{completed:1,total:16,percent:6,next:2,finished:false});
 assert.deepEqual(readPlanCache({format:1,runs:{unknown:{versionId:'unknown',startedAt:new Date().toISOString()}},entries:{}}),{runs:{},entries:{},pending:{}});
});

test('guest reflections and completion survive reload independently of account caches',async()=>{
 const storage=memory(),account={getUser:()=>null};let first=createPlanStore({account,storage,delay:60000});
 await first.load();first.update('mark-v1',1,{reflection:'A private reflection',completed:true});first.dispose();
 first=createPlanStore({account,storage,delay:60000});await first.load();assert.equal(first.entry('mark-v1',1).reflection,'A private reflection');assert.equal(planProgress(planCatalog[0],first.state.entries).next,2);assert.equal(first.status(),'Saved on this device');first.dispose();
});

test('signed-in progress syncs, repeated starts reuse one run and a second device resumes',async()=>{
 const server=cloud(),a=signed(server),b=signed(server);
 try{await a.store.load();a.store.start('mark-v1');a.store.start('mark-v1');a.store.update('mark-v1',1,{reflection:'Saved across devices',completed:true});await a.store.flush();assert.equal(server.runs.length,1);assert.equal(server.rows.length,1);assert.equal(a.store.status(),'Saved to your account');await b.store.load();assert.equal(b.store.entry('mark-v1',1).reflection,'Saved across devices');assert.equal(planProgress(planCatalog[0],b.store.state.entries).next,2);}finally{a.store.dispose();b.store.dispose();}
});

test('offline drafts retain their revision after reload and sync when the network returns',async()=>{
 const server=cloud(),storage=memory();let a=signed(server,'first',storage);
 await a.store.load();a.store.update('mark-v1',1,{reflection:'Original'});await a.store.flush();server.failed=true;
 a.store.update('mark-v1',1,{reflection:'Offline edit'});await a.store.flush();assert.match(a.store.status(),/Network unavailable/);a.store.dispose();a=signed(server,'first',storage);
 try{await a.store.load();assert.equal(a.store.entry('mark-v1',1).reflection,'Offline edit');assert.equal(a.store.state.pending['mark-v1:1'].baseRevision,1);server.failed=false;await a.store.flush();assert.equal(server.rows[0].reflection,'Offline edit');assert.equal(a.store.state.pending['mark-v1:1'],undefined);}finally{a.store.dispose();}
});

test('conflicting device edits stay intact until the reader chooses a copy',async()=>{
 const server=cloud(),a=signed(server),b=signed(server);
 try{
  await a.store.load();a.store.update('mark-v1',1,{reflection:'Original'});await a.store.flush();await b.store.load();
  a.store.update('mark-v1',1,{reflection:'First device edit'});b.store.update('mark-v1',1,{reflection:'Second device edit'});await a.store.flush();await b.store.flush();
  assert.equal(b.store.entry('mark-v1',1).reflection,'Second device edit');assert.equal(b.store.state.conflicts['mark-v1:1'].reflection,'First device edit');
  b.store.resolve('mark-v1',1,'device');await b.store.flush();assert.equal(server.rows[0].reflection,'Second device edit');
  a.store.update('mark-v1',1,{reflection:'Third edit'});await a.store.flush();assert.ok(a.store.state.conflicts['mark-v1:1']);a.store.resolve('mark-v1',1,'account');assert.equal(a.store.entry('mark-v1',1).reflection,'Second device edit');
 }finally{a.store.dispose();b.store.dispose();}
});

test('a lost save response retries idempotently without a false conflict',async()=>{
 const server=cloud(),a=signed(server);
 try{await a.store.load();a.store.update('mark-v1',1,{reflection:'Successfully stored'});server.lost=true;await a.store.flush();assert.match(a.store.status(),/Response lost/);await a.store.flush();assert.equal(server.rows.length,1);assert.equal(server.rows[0].revision,1);assert.equal(Object.keys(a.store.state.pending).length,0);assert.equal(Object.keys(a.store.state.conflicts).length,0);}finally{a.store.dispose();}
});

test('an edit made during an in-flight save is queued against the returned revision',async()=>{
 const server=cloud(),a=signed(server);
 try{await a.store.load();a.store.start('mark-v1');await a.store.flush();a.store.update('mark-v1',1,{reflection:'First'});let release;server.pause=new Promise(r=>{release=r;});const pending=a.store.flush();await tick();a.store.update('mark-v1',1,{reflection:'Latest'});release();await pending;await a.store.flush();assert.equal(server.rows[0].reflection,'Latest');assert.equal(server.rows[0].revision,2);assert.equal(Object.keys(a.store.state.pending).length,0);}finally{a.store.dispose();}
});

test('an old request cannot write another account’s cache or display its reflections',async()=>{
 const server=cloud(),a=signed(server);let release;
 try{await a.store.load();a.store.update('mark-v1',1,{reflection:'First account private'});server.pause=new Promise(r=>{release=r;});const pending=a.store.flush();await tick();a.setUser('second');await a.store.load();release();await pending;assert.equal(a.store.owner,'second');assert.equal(a.store.entry('mark-v1',1).reflection,'');assert.doesNotMatch(a.storage.getItem('exegetical-user-second-plans')||'',/First account private/);a.setUser(null);await a.store.load();assert.equal(a.store.entry('mark-v1',1).reflection,'');}finally{a.store.dispose();}
});

test('guest import is explicit, preserves the guest copy and does not overwrite an account plan',async()=>{
 const server=cloud(),storage=memory(),guest=createPlanStore({account:{getUser:()=>null},storage,delay:60000});await guest.load();guest.update('mark-v1',1,{reflection:'Guest Mark'});guest.update('john-v1',1,{reflection:'Guest John'});guest.dispose();
 const a=signed(server,'first',storage);
 try{await a.store.load();assert.equal(Object.keys(a.store.state.runs).length,0);assert.equal(a.store.guestAvailable(),true);a.store.update('mark-v1',1,{reflection:'Account Mark'});await a.store.flush();assert.equal(a.store.importGuest(),1);await a.store.flush();assert.equal(a.store.entry('mark-v1',1).reflection,'Account Mark');assert.equal(a.store.entry('john-v1',1).reflection,'Guest John');assert.match(storage.getItem('exegetical-plans'),/Guest Mark/);}finally{a.store.dispose();}
});

test('storage failures and oversized reflections are visible and do not claim successful saving',async()=>{
 const store=createPlanStore({account:{getUser:()=>null},storage:{getItem:()=>null,setItem(){throw Error('Quota');}},delay:60000});
 try{await store.load();store.update('mark-v1',1,{reflection:'Keep this safe'});assert.match(store.status(),/Could not save/);assert.throws(()=>store.update('mark-v1',1,{reflection:'x'.repeat(20001)}),/20,000/);assert.equal(store.entry('mark-v1',1).reflection,'Keep this safe');}finally{store.dispose();}
});

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
async function ui(run){
 const dom=new JSDOM(html,{url:'https://example.test/'}),w=dom.window,d=w.document;w.scrollTo=()=>{};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let opened=null;const controller=setupPlans({account:{getUser:()=>null},esc:escape,toast:()=>{},getTranslation:()=> 'BSB',openPassage:async ref=>{opened=ref;return true;},doc:d,win:w,storage:w.localStorage});
 try{await run({w,d,controller,opened:()=>opened});}finally{controller.store.dispose();w.close();}
}

test('Plans connects catalog, overview, session list, reader return and completion without losing a draft',async()=>{
 await ui(async({w,d,controller,opened})=>{
  d.getElementById('plansNav').click();assert.equal(d.getElementById('plansPage').hidden,false);assert.equal(d.querySelector('.workspace').hidden,true);assert.equal(d.querySelectorAll('.plan-card').length,3);
  d.querySelector('[data-plan-action="explore"][data-version="mark-v1"]').click();assert.equal(d.querySelectorAll('.plan-session-list li').length,16);
  d.querySelector('.plan-overview-start button').click();assert.match(d.querySelector('h1[tabindex]').textContent,/Mark 1/);
  const editor=d.getElementById('planReflection');editor.focus();editor.value='<script>private reflection</script>';editor.dispatchEvent(new w.Event('input'));assert.equal(d.activeElement,editor);assert.equal(d.querySelector('#plansPage script'),null);
  d.querySelector('[data-plan-action="passage"]').click();await tick();assert.equal(opened().book,'MRK');assert.equal(d.getElementById('plansPage').hidden,true);assert.equal(d.getElementById('planReadingBar').hidden,false);
  d.getElementById('returnToPlan').click();assert.equal(d.getElementById('planReflection').value,'<script>private reflection</script>');
  d.getElementById('planComplete').click();assert.equal(controller.store.entry('mark-v1',1).completed,true);assert.match(d.querySelector('.plan-session-heading h1').textContent,/Mark 2/);
  d.querySelector('.plan-session-pagination [data-plan-action="explore"]').click();assert.equal(d.querySelectorAll('.plan-session-list li').length,16);assert.match(d.querySelector('.plan-session-list li small').textContent,/Completed/);
  d.querySelector('.plan-breadcrumb button').click();assert.ok(d.querySelector('.plan-continue'));
 });
});

test('mobile Plans navigation opens a plan, returns to reading, and empty filters stay useful',async()=>{
 await ui(async({d})=>{
  d.getElementById('mobilePlansButton').click();assert.equal(d.getElementById('mobilePlansButton').getAttribute('aria-current'),'page');
  d.querySelector('[data-filter="finished"]').click();assert.match(d.querySelector('.plan-empty').textContent,/finished plans/);
  d.querySelector('.plan-empty button').click();assert.equal(d.querySelectorAll('.plan-card').length,3);
  d.getElementById('mobileReadButton').click();assert.equal(d.getElementById('plansPage').hidden,true);assert.equal(d.querySelector('.workspace').hidden,false);
 });
});

test('account changes clear a hidden reflection and unsynced sign-out can be cancelled',async()=>{
 const dom=new JSDOM(html,{url:'https://example.test/'}),w=dom.window,d=w.document;w.scrollTo=()=>{};w.confirm=()=>false;
 const server=cloud();let user={id:'first'};const account={getUser:()=>user,getClient:()=>client};const client=server.client(account.getUser);
 const controller=setupPlans({account,esc:s=>String(s??''),toast:()=>{},getTranslation:()=> 'BSB',openPassage:async()=>true,doc:d,win:w,storage:w.localStorage});
 try{
  await controller.store.load();controller.store.update('mark-v1',1,{reflection:'Private first-account writing'});
  d.getElementById('plansNav').click();d.querySelector('.plan-card [data-version="mark-v1"]').click();assert.equal(d.getElementById('planReflection').value,'Private first-account writing');
  assert.equal(d.dispatchEvent(new w.CustomEvent('study-before-signout',{cancelable:true})),false);
  d.getElementById('readNav').click();user={id:'second'};d.dispatchEvent(new w.CustomEvent('study-auth-changed'));assert.doesNotMatch(d.getElementById('plansPage').textContent,/Private first-account/);await tick();
  d.getElementById('plansNav').click();assert.doesNotMatch(d.getElementById('plansPage').textContent,/Private first-account/);assert.equal(controller.store.entry('mark-v1',1).reflection,'');
 }finally{controller.store.dispose();w.close();}
});

test('finishing a plan offers review and sessions can be marked incomplete again',async()=>{
 await ui(async({d,controller})=>{
  for(let number=1;number<=6;number++)controller.store.update('psalms-v1',number,{completed:true});
  d.getElementById('plansNav').click();d.querySelector('.plan-card [data-version="psalms-v1"]').click();assert.match(d.querySelector('.plan-session-heading h1').textContent,/139/);
  d.getElementById('planComplete').click();assert.ok(d.querySelector('.plan-finished'));assert.equal(planProgress(planCatalog[2],controller.store.state.entries).finished,true);
  d.querySelector('[data-plan-action="explore"]').click();d.querySelector('.plan-session-list li button').click();d.getElementById('planIncomplete').click();assert.equal(planProgress(planCatalog[2],controller.store.state.entries).finished,false);
 });
});
