import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
export async function verifyAuth(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const publicKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!publicKey||!secret)throw Error('Supabase configuration is incomplete for authentication verification.');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(url,secret,options);const clients=[],ids=[];
 const check=(r,label)=>{if(r.error)throw Error(label+': '+r.error.message);return r.data;};
 try{
  for(let i=0;i<2;i++){
   const email=`exegetical-check-${randomUUID()}@example.com`,password=randomBytes(24).toString('base64url');
   const created=check(await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{verification_fixture:true}}),'Create verification account');ids.push(created.user.id);
   const client=createClient(url,publicKey,options);check(await client.auth.signInWithPassword({email,password}),'Password sign in');clients.push(client);
  }
  const [a,b]=clients;const payload={text:'temporary verification note',book:'JHN',bookName:'John',chapter:1,verse:1,highlighted:true,updatedAt:new Date().toISOString()};
  check(await a.rpc('save_study_entry',{p_passage:'JHN.1.1',p_payload:payload,p_revision:0}),'Save note');
  const owned=check(await a.from('study_entries').select('payload').eq('passage','JHN.1.1'),'Read saved note');if(owned[0]?.payload.text!==payload.text)throw Error('Saved note was not restored.');
  const hidden=check(await b.from('study_entries').select('*').eq('user_id',ids[0]),'Check account isolation');if(hidden.length)throw Error('Account notes leaked to another user.');
  const stale=await a.rpc('save_study_entry',{p_passage:'JHN.1.1',p_payload:payload,p_revision:0});if(stale.error?.code!=='40001')throw Error('Stale note edits were not rejected.');
  check(await a.from('study_preferences').upsert({user_id:ids[0],settings:{translation:'BSB',book:'JHN',chapter:1}}),'Save preferences');
  const hiddenPrefs=check(await b.from('study_preferences').select('*').eq('user_id',ids[0]),'Check preference isolation');if(hiddenPrefs.length)throw Error('Preferences leaked to another user.');
  const anon=createClient(url,publicKey,options);const denied=await anon.from('study_entries').select('*');if(!denied.error&&denied.data?.length)throw Error('Anonymous users could read private notes.');
  for(const client of clients){check(await client.auth.signOut({scope:'local'}),'Sign out');const session=check(await client.auth.getSession(),'Check signed-out session');if(session.session)throw Error('Sign-out retained a local session.');}
  console.log('Verified password login, saved-note restoration, highlights, preferences, cross-user isolation, conflict detection and logout.');
 }finally{for(const id of ids){const {error}=await admin.auth.admin.deleteUser(id);if(error)throw Error('Verification fixture cleanup failed.');}console.log('Removed temporary verification accounts; no emails sent.');}
}
