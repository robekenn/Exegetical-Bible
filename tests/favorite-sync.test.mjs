import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('favorites migrate and sync across browser sessions without stale reading settings undoing removals',async()=>{
 const browser=new JSDOM('<button id="accountButton"></button><span id="accountStatus"></span>',{url:'https://example.test/',pretendToBeVisual:true});
 const storageKey='exegetical-favorite-translations';
 const cloud=new Map([['reader',{favoriteTranslations:['ESV']}]]);
 let client,authChanged;
 const session=id=>({user:{id}});
 const globals={
  document:browser.window.document,window:browser.window,location:browser.window.location,
  navigator:browser.window.navigator,CustomEvent:browser.window.CustomEvent,setInterval:()=>0,
  fetch:async url=>({ok:true,json:async()=>url==='/api/config'?{supabaseUrl:'https://project.supabase.co',supabaseKey:'public'}:{external:{google:false}}}),
  __favoriteTestClient:()=>client
 };
 const saved=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 try{
  for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  let source=await readFile(new URL('../account.js',import.meta.url),'utf8');
  source=source.replace(/import \{createBrowserClient,parseCookieHeader,serializeCookieHeader\} from '\/vendor\/supabase.js';/,
   "const createBrowserClient=()=>globalThis.__favoriteTestClient(),parseCookieHeader=()=>[],serializeCookieHeader=()=>'';");
  source=source.replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../'+path.slice(2),import.meta.url).href));
  const {createAccount}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  async function openBrowser(cache){
   let ids=[];
   client={
    auth:{getSession:async()=>({data:{session:session('reader')}}),onAuthStateChange(callback){authChanged=callback;}},
    from(table){
     return {
      select(){return this;},
      eq(_,id){this.id=id;return this;},
      order(){return this;},
      range:async()=>({data:[]}),
      async maybeSingle(){return {data:{settings:structuredClone(cloud.get(this.id))}};},
      async upsert({user_id,settings}){
       assert.equal(table,'study_preferences');
       cloud.set(user_id,structuredClone(settings));
       return {};
      }
     };
    }
   };
   const account=await createAccount({
    state:{notes:{},highlights:{}},esc:String,modal(){},toast(){},refresh(){},
    applyPreferences(){},getPreferences:()=>({chapter:2}),
    applyFavorites:value=>{ids=value;},localRead:(key,fallback)=>cache.get(key)??fallback,
    localWrite:(key,value)=>cache.set(key,structuredClone(value))
   });
   return {account,ids:()=>ids};
  }
  const sync=async()=>{browser.window.dispatchEvent(new browser.window.Event('online'));await new Promise(resolve=>setImmediate(resolve));};
  const desktop=await openBrowser(new Map([[storageKey,['AB_78a9f6124f344018-01']]]));
  assert.deepEqual(desktop.ids(),['ESV','AB_78a9f6124f344018-01']);
  await sync();
  const phone=await openBrowser(new Map());
  assert.deepEqual(phone.ids(),desktop.ids());
  phone.account.changeFavorite('ESV',false);
  await sync();
  desktop.account.preferencesChanged();
  await sync();
  assert.deepEqual(cloud.get('reader').favoriteTranslations,['AB_78a9f6124f344018-01']);
  authChanged('SIGNED_IN',session('different-reader'));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual(phone.ids(),[]);
  await sync();
 }finally{
  browser.window.close();
  for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
 }
});
