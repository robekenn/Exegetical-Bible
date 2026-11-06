import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

for(const scenario of ['offline','conflict','unavailable','revoked on another device']){
 test(`local sign-out clears private state when sync is ${scenario}`,async()=>{
  const browser=new JSDOM('<button id="accountButton"></button><span id="accountStatus"></span><dialog id="modal"><div id="modalBody"></div></dialog>',{url:'https://example.test/'});
  const {window}=browser,doc=window.document;
  const key='sb-project-auth-token',owner='test-owner';
  let session={user:{id:owner,email:'fixture@example.test'},access_token:'fixture'};
  let validationError;
  const auth={getUser:async()=>{
   if(validationError?.name==='AuthSessionMissingError')session=null;
   return {error:validationError};
  },getSession:async()=>({data:{session}}),onAuthStateChange(){},dispose:async()=>{},
   admin:{signOut:async()=>{throw Error('Mock revocation unavailable');}}};
  let pushes=0,exports=0,revocationMessage;
  const client={auth,rpc:async()=>{pushes++;return {error:{code:scenario==='conflict'?'40001':'503',message:'Sync unavailable'}};},
   from(){return {select(){return this;},eq(){return this;},order(){return this;},
    then(resolve){resolve({data:[]});},range:async()=>({data:[]}),maybeSingle:async()=>({data:null}),upsert:async()=>({})};}};
  const globals={document:doc,window,location:window.location,navigator:{onLine:scenario!=='offline'},localStorage:window.localStorage,
   CustomEvent:window.CustomEvent,setInterval:()=>0,__signoutTestClient:()=>client,
   fetch:async()=>({ok:true,json:async()=>({supabaseUrl:'https://project.supabase.co',supabaseKey:'fixture'})})};
  const saved=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  try{
   for(const [k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
   let source=await readFile(new URL('../account.js',import.meta.url),'utf8');
   source=source.replace('createBrowserClient,parseCookieHeader,serializeCookieHeader','parseCookieHeader,serializeCookieHeader')
    .replace("from '/vendor/supabase.js';","from "+JSON.stringify(import.meta.resolve('@supabase/ssr'))+";\nconst createBrowserClient=()=>globalThis.__signoutTestClient();");
   source=source.replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../'+path.slice(2),import.meta.url).href));
   const {createAccount}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
   doc.getElementById('modal').close=function(){this.open=false;};
   doc.cookie=key+'.0=fixture; Path=/';
   window.localStorage.setItem(key,'fixture');
   const state={notes:{},highlights:{}};
   Object.defineProperty(doc,'visibilityState',{value:'visible'});
   const account=await createAccount({state,esc:String,refresh(){},applyPreferences(){},getPreferences:()=>({}),
    localRead:(k,fallback)=>k===key?fallback:JSON.parse(window.localStorage.getItem(k))??fallback,
    localWrite:(k,value)=>window.localStorage.setItem(k,JSON.stringify(value)),
    modal(title,html){doc.getElementById('modal').open=true;doc.getElementById('modalBody').innerHTML=html;},
    toast:message=>revocationMessage=message,exportBackup:()=>exports++});
   state.notes['JHN.1.1']={book:'JHN',bookName:'John',chapter:1,verse:1,text:'Private note'};
   account.changed();
   if(scenario==='revoked on another device'){
    validationError={status:503};
    doc.dispatchEvent(new window.Event('visibilitychange'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(account.getUser().id,owner);
    validationError={name:'AuthSessionMissingError'};
    doc.dispatchEvent(new window.Event('visibilitychange'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(account.getUser(),null);
    assert.deepEqual(state.notes,{});
    assert.ok(window.localStorage.getItem('exegetical-user-'+owner+'-pending'));
    return;
   }
   if(scenario!=='offline'){
    window.dispatchEvent(new window.Event('online'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(pushes);
   }
   doc.getElementById('accountButton').click();
   doc.getElementById('accountSignOut').click();
   doc.getElementById('signOutBackup').click();
   assert.equal(exports,1);
   doc.getElementById('signOutDiscard').click();
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(account.getUser(),null);
   assert.deepEqual(state.notes,{});
   assert.equal(window.localStorage.getItem(key),null);
   assert.equal(window.localStorage.getItem('exegetical-user-'+owner+'-notes'),null);
   assert.doesNotMatch(doc.cookie,/fixture/);
   assert.match(revocationMessage,/Server session revocation could not be confirmed/);
  }finally{
   window.close();
   for(const [k,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];
  }
 });
}
