import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
test('the real Google sign-in form requires consent, starts OAuth and recovers from provider errors',async()=>{
 const dom=new JSDOM('<button id="accountButton"></button><span id="accountStatus"></span><dialog id="modal"></dialog>',{url:'https://exegetical-bible.vercel.app/'});
 const keys=['document','window','location','history','navigator','sessionStorage','localStorage','CustomEvent','fetch','setInterval','__googleTestClient'];const saved=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let calls=0;
 const client={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){},signInWithOAuth:async()=>{calls++;return {error:{message:'Provider rejected request'}};}}};
 try{
  for(const [key,value]of Object.entries({document:dom.window.document,window:dom.window,location:dom.window.location,history:dom.window.history,navigator:dom.window.navigator,sessionStorage:dom.window.sessionStorage,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,setInterval:()=>0,__googleTestClient:client,fetch:async url=>({ok:true,json:async()=>String(url).endsWith('/api/config')?{supabaseUrl:'https://project.supabase.co',supabaseKey:'public'}:{external:{google:true}}})}))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  let source=await readFile(new URL('../account.js',import.meta.url),'utf8');source=source.replace(/import \{createBrowserClient,parseCookieHeader,serializeCookieHeader\} from '\/vendor\/supabase.js';/,"const createBrowserClient=()=>globalThis.__googleTestClient,parseCookieHeader=()=>[],serializeCookieHeader=()=>'';");source=source.replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../'+path.slice(2),import.meta.url).href));
  const {createAccount}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const account=await createAccount({state:{notes:{},highlights:{}},esc:String,modal:(_,html)=>document.getElementById('modal').innerHTML=html,toast(){},refresh(){},applyPreferences(){},getPreferences:()=>({}),localRead:(_,fallback)=>fallback,localWrite(){}});
  account.signIn();const form=document.getElementById('googleAuthForm');assert.equal(document.getElementById('googleSignIn').disabled,false);
  await form.onsubmit({preventDefault(){}});assert.equal(calls,0);
  document.getElementById('googleConsent').checked=true;await form.onsubmit({preventDefault(){}});assert.equal(calls,1);assert.equal(document.getElementById('googleAuthMessage').textContent,'Provider rejected request');assert.equal(document.getElementById('googleSignIn').disabled,false);assert.equal(sessionStorage.getItem('exegetical-google-consent'),null);
 }finally{dom.window.close();for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
});
