import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdminHandler} from '../api/admin.js';
const uid='11111111-1111-4111-8111-111111111111',report='22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SECRET_KEY:'secret',ADMIN_USER_IDS:uid};
function harness({user=uid,authError=false,config=env,role=false,mailer=null}={}){let privileged=0,calls=[];const make=(url,key)=>{if(key==='public')return {auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:authError})}};privileged++;const query={select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:[]}),single:async()=>({data:{id:report,details:'Report evidence'}}),limit:async()=>({data:[]})};return {from:()=>query,rpc:async(name,payload)=>{calls.push({name,payload});return {data:name==='moderation_is_admin'?role:name==='moderation_change'?report:name==='moderation_claim_email'?[{attempt:report,email:'fixture@example.test',reason:'Fixture violation',appeal_token:uid}]:null};}};};const handler=createAdminHandler(make,config,()=>mailer);return {calls,get privileged(){return privileged;},async run(overrides={}){const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.data=data;return this;}};await handler({method:'GET',headers:{authorization:'Bearer valid',origin:'https://example.test',host:'example.test'},query:{},...overrides},res);return res;}};}
test('admin API rejects unauthenticated and unauthorized users before accessing reports',async()=>{for(const options of [{user:null},{authError:true},{user:report},{config:{...env,ADMIN_USER_IDS:''}}]){const h=harness(options),r=await h.run();assert.ok([401,403].includes(r.code));assert.ok(h.calls.every(call=>call.name==='moderation_is_admin'));assert.match(r.headers['Cache-Control'],/no-store/);}const h=harness();assert.equal((await h.run({headers:{}})).code,401);assert.equal(h.privileged,0);});
test('admin review requires same origin, validated input, and records the verified actor atomically',async()=>{const h=harness();assert.equal((await h.run({method:'POST',headers:{origin:'https://evil.test',host:'example.test'}})).code,403);assert.equal(h.privileged,0);assert.equal((await h.run({method:'POST',body:{report_id:report,status:'resolved',note:''}})).code,400);const r=await h.run({method:'POST',body:{report_id:report,status:'resolved',note:' Reviewed evidence. ',actor:report}});assert.equal(r.code,200);assert.deepEqual(h.calls,[{name:'review_community_report',payload:{p_report:report,p_actor:uid,p_status:'resolved',p_note:'Reviewed evidence.'}}]);});
test('authorized admin can list and inspect reports; malformed filters are rejected',async()=>{const h=harness();assert.equal((await h.run()).code,200);assert.equal((await h.run({query:{id:report}})).data.report.id,report);assert.equal((await h.run({query:{id:'invalid'}})).code,400);assert.equal((await h.run({query:{status:'nonsense'}})).code,400);});

test('access probe returns only verified admin eligibility without querying private data',async()=>{for(const user of [uid,report]){const h=harness({user});const r=await h.run({query:{access:'1'}});assert.equal(r.code,200);assert.deepEqual(r.data,{admin:user===uid});assert.ok(h.calls.every(call=>call.name==='moderation_is_admin'));}});

test('verified admins cannot grant roles and owners cannot ban their own account',async()=>{
 const moderator=harness({user:report,role:true});
 assert.equal((await moderator.run()).code,200);
 assert.equal((await moderator.run({method:'POST',body:{action:'promote',target:uid}})).code,403);
 assert.ok(moderator.calls.every(call=>call.name==='moderation_is_admin'));
 const owner=harness();
 assert.equal((await owner.run({method:'POST',body:{action:'ban',target:uid,confirmation:'BAN',reason:'Fixture reason'}})).code,403);
 assert.equal((await owner.run({method:'POST',body:{action:'ban',target:report,confirmation:'BAN',reason:'Fixture reason'}})).code,503);
 assert.equal(owner.calls.length,0);
});

test('ban requires explicit confirmation and reports mail failure separately from deletion',async()=>{
 const h=harness({mailer:async()=>{throw Error('Fixture SMTP failure');}});
 const action={action:'ban',target:report,reason:'Fixture reason'};
 assert.equal((await h.run({method:'POST',body:action})).code,400);
 const result=await h.run({method:'POST',body:{...action,confirmation:'BAN',actor:report}});
 assert.equal(result.code,200);
 assert.deepEqual(result.data,{ok:true,emailStatus:'failed'});
 assert.equal(h.calls[0].payload.p_actor,uid);
 assert.deepEqual(h.calls.map(call=>call.name),['moderation_change','moderation_claim_email','moderation_finish_email']);
 assert.equal(h.calls.at(-1).payload.p_sent,false);
});
