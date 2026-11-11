import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
test('password forms pass symbols and Unicode unchanged and limit only new passwords',async()=>{
 const dom=new JSDOM('<button id="accountButton"></button><span id="accountStatus"></span><dialog id="modal"></dialog>',{url:'https://exegetical-bible.vercel.app/'});
 const keys=['document','window','location','history','navigator','sessionStorage','localStorage','CustomEvent','fetch','setInterval','__passwordTestClient'];const saved=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));const calls=[];
 const client={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){},
  signInWithPassword:async data=>{calls.push(['login',data.password]);return {error:{message:'Fixture sign-in response'}};},
  signUp:async data=>{calls.push(['signup',data.password]);return {data:{session:null}};}
 }};
 try{
  for(const [key,value]of Object.entries({document:dom.window.document,window:dom.window,location:dom.window.location,history:dom.window.history,navigator:dom.window.navigator,sessionStorage:dom.window.sessionStorage,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,setInterval:()=>0,__passwordTestClient:client,fetch:async url=>({ok:true,json:async()=>String(url).endsWith('/api/config')?{supabaseUrl:'https://project.supabase.co',supabaseKey:'public'}:{external:{google:true}}})}))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  let source=await readFile(new URL('../account.js',import.meta.url),'utf8');source=source.replace(/import \{createBrowserClient,parseCookieHeader,serializeCookieHeader\} from '\/vendor\/supabase.js';/,"const createBrowserClient=()=>globalThis.__passwordTestClient,parseCookieHeader=()=>[],serializeCookieHeader=()=>'';");source=source.replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../'+path.slice(2),import.meta.url).href));
  const {createAccount}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const account=await createAccount({state:{notes:{},highlights:{}},esc:String,modal:(_,html)=>document.getElementById('modal').innerHTML=html,toast(){},refresh(){},applyPreferences(){},getPreferences:()=>({}),localRead:(_,fallback)=>fallback,localWrite(){}});
  const get=id=>document.getElementById(id),event={preventDefault(){}};
  const password=`  A!b&<>"'%#+💡é  `;
  account.signIn();
  const field=get('authPassword');
  assert.equal(field.hasAttribute('minlength'),false);
  get('authEmail').value='person@example.test';
  field.value=password;
  get('authPasswordVisibility').click();
  assert.equal(field.type,'text');
  assert.equal(field.value,password);
  get('authPasswordVisibility').click();
  assert.equal(field.type,'password');
  await get('authForm').onsubmit(event);
  assert.equal(get('authMessage').dataset.kind,'error');
  get('switchAuth').click();
  assert.equal(get('authEmail').value,'person@example.test');
  get('termsConsent').checked=true;
  get('authPassword').value='💡'.repeat(19);
  await get('authForm').onsubmit(event);
  assert.match(get('authMessage').textContent,/72 bytes/);
  get('authPassword').value=password;
  await get('authForm').onsubmit(event);
  assert.equal(get('authForm').hidden,true);
  assert.equal(get('authMessage').dataset.kind,'success');
  assert.match(get('authMessage').textContent,/confirm your email/);
  assert.deepEqual(calls,[['login',password],['signup',password]]);
 }finally{dom.window.close();for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
});
