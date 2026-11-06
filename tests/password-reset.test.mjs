import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {passwordFitsProvider} from '../password-policy.js';

const [reader,html,reset]=await Promise.all(['reader-entry.js','reset-password/index.html','reset-password/reset.js'].map(path=>readFile(new URL('../'+path,import.meta.url),'utf8')));
const origin='https://exegetical-bible.vercel.app';
const recoveryHash='#access_token=recovery-token&refresh_token=refresh-token&type=recovery';

test('recovery links skip reader, telemetry, and persistent account initialization',async()=>{
 const run=new Function('location','load',`return (async()=>{${reader.replaceAll('import(', 'load(')}})()`);
 for(const pathname of ['/auth/callback','/']){
  const calls=[];
  await run({pathname,hash:recoveryHash,replace:path=>calls.push(path)},path=>calls.push(path));
  assert.deepEqual(calls,['/reset-password/'+recoveryHash]);
 }
 for(const hash of ['#access_token=signup-token&type=signup','#access_token=oauth-token','']){
  const calls=[];
  await run({pathname:'/auth/callback',hash,replace:path=>calls.push(path)},path=>calls.push(path));
  assert.deepEqual(calls,['./polish.js','./vendor/telemetry.js','./app.js']);
 }
});

async function resetPage(hash,auth){
 const dom=new JSDOM(html,{url:origin+'/reset-password/'+hash});
 const {location,document,history}=dom.window;
 const calls=[];
 const run=new Function('location','document','history','fetch','load','passwordFitsProvider',`return (async()=>{${reset.replace(/^import .*\n/,'').replaceAll('import(', 'load(')}})()`);
 const fetch=async path=>{
  calls.push(['fetch',path,location.hash]);
  return {ok:true,json:async()=>({supabaseUrl:'https://project.supabase.co',supabaseKey:'public'})};
 };
 const load=async()=>({createClient:(url,key,options)=>{
  calls.push(['options',options.auth]);
  return {auth};
 }});
 await run(location,document,history,fetch,load,passwordFitsProvider);
 return {dom,calls,get:id=>document.getElementById(id)};
}

test('valid recovery uses an isolated session and updates the exact new password',async()=>{
 const authCalls=[];
 const auth={
  setSession:async tokens=>{authCalls.push(['session',tokens]);return {data:{session:{user:{id:'test-user'}}},error:null};},
  updateUser:async data=>{authCalls.push(['update',data]);return {error:null};},
  getSession:async()=>({data:{session:{access_token:'recovery-token'}}}),
  admin:{signOut:async(token,scope)=>{authCalls.push(['signOut',token,scope]);return {error:null};}}
 };
 const {dom,calls,get}=await resetPage(recoveryHash,auth);
 try{
  assert.deepEqual(calls,[
   ['fetch','/api/config',''],
   ['options',{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}]
  ]);
  assert.deepEqual(authCalls,[['session',{access_token:'recovery-token',refresh_token:'refresh-token'}]]);
  const form=get('newPasswordForm'),input=get('newPassword');
  assert.equal(form.hidden,false);
  assert.equal(get('requestForm').hidden,true);
  assert.equal(input.minLength,12);
  const submitter=form.querySelector('[type=submit]');
  const event={preventDefault(){},submitter};
  input.value='💡'.repeat(19);
  await form.onsubmit(event);
  assert.match(get('resetStatus').textContent,/72 bytes/);
  const password=`  A!b&<>"'%#+💡é  `;
  input.value=password;
  get('newPasswordVisibility').click();
  assert.equal(input.type,'text');
  await form.onsubmit(event);
  assert.deepEqual(authCalls.slice(1),[['update',{password}],['signOut','recovery-token','global']]);
  assert.equal(input.value,'');
  assert.equal(form.hidden,true);
  assert.match(get('resetStatus').textContent,/All sessions were revoked/);
 }finally{dom.window.close();}
});

test('revocation errors can be retried without changing the password again',async()=>{
 const calls=[];
 let updateError={message:'Password is too weak'};
 const auth={
  setSession:async()=>({data:{session:{}}}),
  updateUser:async()=>{calls.push('update');return {error:updateError};},
  getSession:async()=>({data:{session:{access_token:'recovery-token'}}}),
  admin:{signOut:async(token,scope)=>{
   calls.push([token,scope]);
   return {error:calls.length===3?{status:503}:null};
  }}
 };
 const {dom,get}=await resetPage(recoveryHash,auth);
 try{
  const form=get('newPasswordForm'),input=get('newPassword'),retry=get('retrySignOut');
  const event={preventDefault(){},submitter:form.querySelector('[type=submit]')};
  input.value='new-password-with-symbols!';
  await form.onsubmit(event);
  assert.equal(form.hidden,false);
  assert.equal(retry.hidden,true);
  assert.deepEqual(calls,['update']);
  updateError=null;
  await form.onsubmit(event);
  assert.equal(form.hidden,true);
  assert.equal(input.value,'');
  assert.equal(retry.hidden,false);
  assert.match(get('resetStatus').textContent,/could not be confirmed/);
  await retry.onclick();
  assert.equal(retry.hidden,true);
  assert.match(get('resetStatus').textContent,/All sessions were revoked/);
  assert.deepEqual(calls,['update','update',['recovery-token','global'],['recovery-token','global']]);
 }finally{dom.window.close();}
});

test('missing, unrelated and expired credentials only offer a new reset email',async()=>{
 const attempts=[];
 const auth={
  setSession:async()=>{attempts.push('verify');return {error:{status:401}};},
  resetPasswordForEmail:async(email,options)=>{attempts.push([email,options.redirectTo]);return {error:null};}
 };
 for(const hash of ['',recoveryHash.replace('type=recovery','type=signup'),recoveryHash,'#type=recovery&error=access_denied']){
  const {dom,get}=await resetPage(hash,auth);
  try{
   assert.equal(get('newPasswordForm').hidden,true);
   assert.equal(get('requestForm').hidden,false);
   if(hash.includes('type=recovery'))assert.match(get('resetStatus').textContent,/invalid or has expired/);
   if(!hash){
    get('resetEmail').value='person@example.test';
    const form=get('requestForm');
    await form.onsubmit({preventDefault(){},submitter:form.querySelector('button')});
    assert.match(get('resetStatus').textContent,/If this address has an account/);
   }
  }finally{dom.window.close();}
 }
 assert.deepEqual(attempts,[['person@example.test',origin+'/auth/callback'],'verify']);
});
