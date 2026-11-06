import {passwordFitsProvider} from '../password-policy.js';

const params=new URLSearchParams(location.hash.slice(1));
const access_token=params.get('access_token');
const refresh_token=params.get('refresh_token');
const recovery=params.get('type')==='recovery';
const linkFailed=params.has('error')||new URLSearchParams(location.search).has('error');

if(location.hash||location.search)history.replaceState(null,'',location.pathname);

const status=document.getElementById('resetStatus');
const requestForm=document.getElementById('requestForm');
const passwordForm=document.getElementById('newPasswordForm');
const password=document.getElementById('newPassword');
const retrySignOut=document.getElementById('retrySignOut');
const visibility=document.getElementById('newPasswordVisibility');

const invalidLink='This reset link is invalid or has expired. Request a new link below.';
let clientPromise;

async function connect(){
 const response=await fetch('/api/config');
 if(!response.ok)throw new Error('Account configuration unavailable');
 const {supabaseUrl,supabaseKey}=await response.json();
 if(!supabaseUrl||!supabaseKey)throw new Error('Account configuration unavailable');
 const {createClient}=await import('/vendor/supabase.js');
 return createClient(supabaseUrl,supabaseKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
}

function showRequest(message){
 passwordForm.hidden=true;
 passwordForm.reset();
 status.textContent=message;
 requestForm.hidden=false;
}

requestForm.onsubmit=async event=>{
 event.preventDefault();
 const button=event.submitter;
 button.disabled=true;
 status.textContent='Sending reset link…';
 try{
  const client=await (clientPromise??=connect());
  // Use the existing Supabase redirect allowlist entry.
  const {error}=await client.auth.resetPasswordForEmail(
   document.getElementById('resetEmail').value.trim(),
   {redirectTo:location.origin+'/auth/callback'}
  );
  status.textContent=error?'Could not send a reset link. Please try again shortly.':'If this address has an account, a reset link is on its way.';
 }catch{
  clientPromise=null;
  status.textContent='Could not send a reset link. Please try again.';
 }finally{
  button.disabled=false;
 }
};

visibility.onclick=()=>{
 const show=password.type==='password';
 password.type=show?'text':'password';
 visibility.textContent=show?'Hide password':'Show password';
};

async function signOutAllDevices(){
 retrySignOut.disabled=true;
 status.textContent='Password updated. Signing out all devices…';
 try{
  const client=await clientPromise;
  const {data,error:sessionError}=await client.auth.getSession();
  if(sessionError||!data.session)throw new Error('Recovery session unavailable');
  // Use the user’s recovery token. Keep it in memory if the request needs a retry.
  const {error}=await client.auth.admin.signOut(data.session.access_token,'global');
  if(error)throw error;
  clientPromise=null;
  retrySignOut.hidden=true;
  status.textContent='Password updated. All sessions were revoked. Return to the Bible to sign in with your new password.';
 }catch{
  retrySignOut.hidden=false;
  status.textContent='Your password was updated, but sign-out on all devices could not be confirmed. Retry below.';
 }finally{
  retrySignOut.disabled=false;
 }
}

retrySignOut.onclick=signOutAllDevices;

passwordForm.onsubmit=async event=>{
 event.preventDefault();
 if(!passwordFitsProvider(password.value,status))return;
 const button=event.submitter;
 button.disabled=true;
 status.textContent='Updating password…';
 try{
  const client=await clientPromise;
  const {error}=await client.auth.updateUser({password:password.value});
  if(error){
   if(error.status===401||error.code==='session_not_found')showRequest(invalidLink);
   else status.textContent=error.message||'Could not update your password. Please try again.';
   return;
  }
  passwordForm.reset();
  passwordForm.hidden=true;
  await signOutAllDevices();
 }catch{
  status.textContent='Could not update your password. Please try again.';
 }finally{
  button.disabled=false;
 }
};

if(!recovery||!access_token||!refresh_token||linkFailed){
 showRequest(recovery||linkFailed?invalidLink:'Enter your email address to request a password reset link.');
}else{
 status.textContent='Checking your reset link…';
 try{
  const client=await (clientPromise=connect());
  const {data,error}=await client.auth.setSession({access_token,refresh_token});
  if(error||!data.session)showRequest(invalidLink);
  else{
   status.textContent='Choose a new password. Changing it will sign out all devices on your account.';
   passwordForm.hidden=false;
  }
 }catch{
  clientPromise=null;
  showRequest('Could not verify your reset link. Reopen the email link to try again, or request a new one below.');
 }
}
