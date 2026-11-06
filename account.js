import {passwordFitsProvider} from './password-policy.js';
import {googleProviderAvailable,signInWithGoogle} from './google-auth.js';
import {createPreferenceSync,savingStatus,favoriteIds,applyFavoriteChanges,favoriteStorageKey} from './preference-sync.js';
import {accountMenu} from './account-menu.js';
import {clearAccountCache} from './security-model.js';
import {revealAdminButton} from './account-access.js';
import {persistentCookieOptions} from './session-options.js';
import {createBrowserClient,parseCookieHeader,serializeCookieHeader} from '/vendor/supabase.js';
import {payloadFor,recordsToState,validatePayload,mergeRemoteStudy} from './sync-model.js';
export async function createAccount({state,esc,modal,toast,refresh,applyPreferences,getPreferences,localRead,localWrite,applyFavorites=()=>{},exportBackup=()=>{}}){
 const $=id=>document.getElementById(id);
 const callbackFailed=location.pathname==='/auth/callback'&&(new URLSearchParams(location.hash.slice(1)).has('error')||new URLSearchParams(location.search).has('error'));
 let config;try{config=await fetch('/api/config').then(r=>r.json());}catch{config={};}
 const authKey=config.supabaseUrl?'sb-'+new URL(config.supabaseUrl).hostname.split('.')[0]+'-auth-token':null;
 let locallyEnded=false,sessionToken;
 const fenceKey=authKey+'-local-signout';
 const fence=()=>{try{return localStorage.getItem(fenceKey);}catch{return null;}};
 const initialFence=fence();
 const sessionEnded=()=>locallyEnded||fence()!==initialFence;
 const authCookie=name=>name===authKey||name.startsWith(authKey+'.')||name.startsWith(authKey+'-');
 let client=config.supabaseUrl&&config.supabaseKey?createBrowserClient(config.supabaseUrl,config.supabaseKey,{cookies:{getAll:()=>parseCookieHeader(document.cookie),setAll:items=>{
  if(sessionEnded())return;
  for(const {name,value,options}of items)document.cookie=serializeCookieHeader(name,value,persistentCookieOptions(options,location.protocol==='https:'));
 }},auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
 const googleEnabled=await googleProviderAvailable(config);
 let user=null,ready=false,epoch=0,running=false,prefTimer,refreshing=false;
 const dirty=new Map(),revisions=new Map(),conflicts=new Set();let syncError='',preferenceSync=null;
 const device={notes:localRead('exegetical-notes',{}),highlights:localRead('exegetical-highlights',{})};
 let favoritesReady=false,favoriteRevision=0;
 let accountFavorites=[];
 const migratedFavoritesKey=favoriteStorageKey+'-migrated';
 const prefix=()=>user?'exegetical-user-'+user.id:'exegetical';
 function indicator(text){$('accountStatus').textContent=text;if($('saveStatus'))$('saveStatus').textContent=user?text:'Saved on this device.';}
 function cache(){if(!user)return;localWrite(prefix()+'-notes',state.notes);localWrite(prefix()+'-highlights',state.highlights);localWrite(prefix()+'-pending',Object.fromEntries(dirty));}
 function saveState(){return savingStatus({signedIn:Boolean(user),ready,conflicts:conflicts.size,noteError:syncError,notesPending:dirty.size,preferencesPending:Boolean(preferenceSync?.pending),preferencesError:preferenceSync?.error,online:navigator.onLine!==false});}
 function display(){ if(!user||!$('accountButton').classList.contains('has-account-avatar'))$('accountButton').textContent=user?'My account':'Sign in';$('accountButton').disabled=false;const status=saveState();indicator(!client?'Accounts unavailable':status.text);$('accountStatus').title=status.detail;const panel=document.querySelector('.account-sync');if(panel){panel.classList.toggle('needs-attention',status.attention);panel.querySelector('strong').textContent=status.saving?'Saving changes':status.attention?'Sync needs attention':'All caught up';panel.querySelector('small').textContent=status.detail;panel.querySelector(':scope > span').textContent=status.saving?'↻':status.attention?'!':'✓';}}
 function currentPayloads(){const keys=new Set([...Object.keys(state.notes),...Object.keys(state.highlights)]);return new Map([...keys].map(k=>[k,payloadFor(k,state.notes,state.highlights)]));}
 async function push(){if(!user||!ready||running||!dirty.size)return;running=true;const runEpoch=epoch;const owner=user.id;syncError='';try{for(const [k,payload]of dirty){if(conflicts.has(k))continue;const {data,error}=await client.rpc('save_study_entry',{p_passage:k,p_payload:payload,p_revision:revisions.get(k)||0});if(runEpoch!==epoch||owner!==user?.id)return;if(error){if(error.code==='40001'){conflicts.add(k);continue;}throw error;}revisions.set(k,Number(data[0].revision));if(dirty.get(k)===payload)dirty.delete(k);cache();} }catch(e){syncError=e.message;toast('Your changes are safe on this device, but have not synced. Open My account to retry.');}finally{running=false;display();if(runEpoch===epoch&&dirty.size&&!syncError&&[...dirty.keys()].some(k=>!conflicts.has(k)))setTimeout(push,250);}}
 function changed(){if(!ready&&user){toast('Wait for your account to load before editing.');return;}if(!user){device.notes=state.notes;device.highlights=state.highlights;return;}const now=currentPayloads();const previous=lastSnapshot;for(const k of new Set([...now.keys(),...previous.keys()])){const next=now.get(k)||payloadFor(k,{},{});if(JSON.stringify(now.get(k))!==JSON.stringify(previous.get(k)))dirty.set(k,next);}lastSnapshot=now;cache();display();clearTimeout(changeTimer);changeTimer=setTimeout(push,600);}
 let lastSnapshot=new Map(),changeTimer;
 function showFavorites(ids){
  accountFavorites=favoriteIds(ids);
  if(user)localWrite(prefix()+'-favorite-translations',accountFavorites);
  applyFavorites(accountFavorites);
 }
 function readPreferences(owner){
  return client.from('study_preferences').select('settings').eq('user_id',owner).maybeSingle();
 }
 function queuePreferences(favoriteChanges={}){
  if(!user||!ready||!favoritesReady)return;
  const changes={...preferenceSync.pending?.favoriteChanges,...favoriteChanges};
  preferenceSync.queue({...getPreferences(),favoriteChanges:changes});
 }
 function changeFavorite(id,selected){
  if(!user||!favoritesReady){
   toast('Wait for your account to load before changing favorites.');
   return false;
  }
  favoriteRevision++;
  const changes={[id]:selected};
  showFavorites(applyFavoriteChanges(accountFavorites,changes));
  queuePreferences(changes);
  return true;
 }
 async function loadCloud(session,force=false){if(sessionEnded()&&session)return;sessionToken=session?.access_token;const next=session?.user||null;if(!force&&next?.id===user?.id&&ready)return;if(!next&&!user&&ready)return;if(user&&!next){
  if($('modal')?.open)$('modal').close();
  $('modalBody')?.replaceChildren();
 }
 const id=++epoch;clearTimeout(changeTimer);clearTimeout(prefTimer);preferenceSync?.dispose();preferenceSync=null;user=next;document.dispatchEvent(new CustomEvent('study-auth-changed',{detail:{id:user?.id||null}}));ready=false;favoritesReady=false;dirty.clear();revisions.clear();conflicts.clear();syncError='';
 if(!user){showFavorites(localRead(favoriteStorageKey,[]));state.notes=localRead('exegetical-notes',{});state.highlights=localRead('exegetical-highlights',{});ready=true;refresh();display();return;}
 const settingsKey=prefix()+'-pending-preferences';
 preferenceSync=createPreferenceSync({
  initial:localRead(settingsKey,null),
  persist:value=>localWrite(settingsKey,value),
  isCurrent:()=>id===epoch&&Boolean(user),
  onChange:display,
  async send({favoriteChanges,...settings}){
   // Reading activity on another device must not overwrite newer favorites.
   const {data,error}=await readPreferences(next.id);
   if(error)return {error};
   if(id!==epoch)return {};
   settings.favoriteTranslations=applyFavoriteChanges(data?.settings?.favoriteTranslations,favoriteChanges);
   return client.from('study_preferences').upsert({user_id:next.id,settings});
  }
 });
 showFavorites(localRead(prefix()+'-favorite-translations',[]));
 state.notes=localRead(prefix()+'-notes',{});state.highlights=localRead(prefix()+'-highlights',{});refresh();display();
 try{const pending=localRead(prefix()+'-pending',{});for(const [k,p]of Object.entries(pending))if(validatePayload(k,p))dirty.set(k,p);
 const rows=[];for(let offset=0;;offset+=1000){const {data,error}=await client.from('study_entries').select('*').eq('user_id',user.id).order('passage').range(offset,offset+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;}
 if(id!==epoch)return;for(const r of rows)revisions.set(r.passage,Number(r.revision));const cloud=recordsToState(rows);
 // Pending edits retain their original base revision across reloads, so stale edits conflict safely.
 const savedRevs=localRead(prefix()+'-revisions',{});for(const [k,p]of dirty){revisions.set(k,Number(savedRevs[k]||0));if(p.text)cloud.notes[k]=p;else delete cloud.notes[k];if(p.highlighted)cloud.highlights[k]=true;else delete cloud.highlights[k];}
 state.notes=cloud.notes;state.highlights=cloud.highlights;lastSnapshot=currentPayloads();ready=true;cache();refresh();display();
 const {data:prefs,error}=await readPreferences(next.id);
 if(id!==epoch)return;
 if(error)throw error;
 const saved=prefs?.settings||{};
 const pendingPreferences=preferenceSync.pending;
 const legacy=localRead(migratedFavoritesKey,false)?[]:favoriteIds(localRead(favoriteStorageKey,[]));
 const migration=Object.fromEntries(legacy.map(id=>[id,true]));
 const changes={...migration,...pendingPreferences?.favoriteChanges};
 showFavorites(applyFavoriteChanges(saved.favoriteTranslations,changes));
 if(pendingPreferences||prefs)await applyPreferences(pendingPreferences||saved);
 if(id!==epoch)return;
 favoritesReady=true;
 queuePreferences(changes);
 if(legacy.length)localWrite(migratedFavoritesKey,true);
 push();
 }catch(e){if(id!==epoch)return;syncError=e.message;toast('Could not load your account. Your saved device copy is available; open My account to retry.');display();refresh();}}
 function rememberRevisions(){if(user)localWrite(prefix()+'-revisions',Object.fromEntries(revisions));}
 function mutate(){rememberRevisions();changed();}
 function preferencesChanged(){queuePreferences();}

 function endSession(revoke=false){
  const owner=user?.id,token=sessionToken;
  if(!owner||locallyEnded)return;
  locallyEnded=true;
  const options=persistentCookieOptions({maxAge:0},location.protocol==='https:');
  for(const {name}of parseCookieHeader(document.cookie)){
   if(authCookie(name))document.cookie=serializeCookieHeader(name,'',options);
  }
  try{
   for(let i=localStorage.length-1;i>=0;i--){
    const key=localStorage.key(i);
    if(key&&key!==fenceKey&&authCookie(key))localStorage.removeItem(key);
   }
   clearAccountCache(localStorage,owner);
   localStorage.setItem(fenceKey,crypto.randomUUID());
  }catch{}
  if(typeof BroadcastChannel==='function'&&authKey){
   const channel=new BroadcastChannel(authKey);
   channel.postMessage({event:'SIGNED_OUT',session:null});
   channel.close();
  }
  void client.auth.dispose?.();
  if($('modal').open)$('modal').close();
  $('modalBody')?.replaceChildren();
  lastSnapshot.clear();
  void loadCloud(null);
  if(!revoke)return;
  if(!token||navigator.onLine===false){
   toast('Signed out on this device. Server session revocation could not be confirmed.');
   return;
  }
  toast('Signed out on this device. Checking server session revocation…');
  let timer;
  const expired=()=>toast('Signed out on this device. Server session revocation could not be confirmed.');
  Promise.race([
   Promise.resolve().then(()=>client.auth.admin.signOut(token,'local')),
   new Promise((_,reject)=>{timer=setTimeout(reject,5000);})
  ]).then(({error})=>error?expired():toast('Signed out. Your account’s saved device copy was cleared.'))
   .catch(expired).finally(()=>clearTimeout(timer));
 }
 function signOut(){
  if(!user)return;
  if(!(dirty.size||syncError||preferenceSync?.pending||preferenceSync?.error||!ready)){
   endSession(true);
   return;
  }
  const owner=user.id;
  modal('Sign out on this device',`<p>Some changes may still be on this device. You can download a backup of your notes and highlights before signing out. Unsynced reading preferences will be discarded.</p><div class="button-row"><button type="button" id="signOutBackup">Export notebook backup</button><button type="button" class="danger" id="signOutDiscard">Discard and sign out</button><button type="button" id="signOutCancel">Keep working</button></div>`);
  $('signOutBackup').onclick=()=>{if(user?.id===owner)exportBackup();};
  $('signOutDiscard').onclick=()=>{if(user?.id===owner)endSession(true);};
  $('signOutCancel').onclick=accountPanel;
 }
 function passwordField(id,creating){
  return `<input id="${id}" name="password" class="full-input" type="password" ${creating?'minlength="12" ':''}autocomplete="${creating?'new-password':'current-password'}" autocapitalize="none" spellcheck="false" required><button type="button" aria-controls="${id}" id="${id}Visibility">Show password</button>`;
 }
 function bindPasswordVisibility(id){
  const input=$(id),button=$(id+'Visibility');
  button.onclick=()=>{
   const show=input.type==='password';
   input.type=show?'text':'password';
   button.textContent=show?'Hide password':'Show password';
  };
 }
 function authForm(mode='login'){if(sessionEnded()){location.reload();return;}if(!client){modal('Accounts unavailable','<p class="muted">Account storage is not configured. You can keep studying and saving device notes.</p>');return;}modal(mode==='signup'?'Create your study account':'Welcome back',`<p class="muted">Save notes, highlights, and reading preferences to your private account.</p><form id="googleAuthForm" class="google-auth-form"><label class="check-label"><input id="googleConsent" type="checkbox" required> I am at least 16, agree to the <a href="/terms/" target="_blank" rel="noopener">Terms</a>, and have read the <a href="/privacy/" target="_blank" rel="noopener">Privacy notice</a>.</label><button id="googleSignIn" class="google-signin" ${googleEnabled?'':'disabled'} type="submit"><span aria-hidden="true" class="google-g">G</span> Continue with Google</button><p id="googleAuthMessage" class="muted" role="status">${googleEnabled?'Your Google picture will be used unless you choose another.':'Google sign-in is awaiting provider setup. Email sign-in is available below.'}</p></form><div class="auth-divider"><span>or use email</span></div><form id="authForm"><label class="label" for="authEmail">Email</label><input id="authEmail" name="username" class="full-input" type="email" autocomplete="username" required><label class="label" for="authPassword">Password</label>${passwordField('authPassword',mode==='signup')}${mode==='signup'?'<label class="check-label"><input id="termsConsent" type="checkbox" required> I am at least 16 and agree to the <a href="/terms/" target="_blank" rel="noopener">Terms</a> and have read the <a href="/privacy/" target="_blank" rel="noopener">Privacy notice</a>.</label>':''}<p id="authMessage" role="status" class="muted"></p><button class="primary" id="authSubmit" type="submit">${mode==='signup'?'Create account':'Sign in'}</button></form><div class="button-row"><button id="switchAuth">${mode==='signup'?'Already have an account? Sign in':'New here? Create an account'}</button><button id="forgotPassword">Forgot password?</button></div>`);$('googleAuthForm').onsubmit=async e=>{e.preventDefault();if(!googleEnabled)return;if(!$('googleAuthForm').reportValidity())return;const button=$('googleSignIn'),message=$('googleAuthMessage');button.disabled=true;message.textContent='Opening Google…';try{sessionStorage.setItem('exegetical-google-consent',String(Date.now()));const {error}=await signInWithGoogle(client,location.origin);if(error)throw error;}catch(e){sessionStorage.removeItem('exegetical-google-consent');if(message.isConnected){message.textContent=e.message||'Google sign-in could not start. Try again.';button.disabled=false;}}};bindPasswordVisibility('authPassword');$('switchAuth').onclick=()=>authForm(mode==='signup'?'login':'signup');$('forgotPassword').onclick=()=>location.assign('/reset-password/');$('authForm').onsubmit=async e=>{e.preventDefault();const email=$('authEmail').value.trim(),password=$('authPassword').value;if(mode==='signup'&&!passwordFitsProvider(password,$('authMessage')))return;$('authSubmit').disabled=true;const result=mode==='signup'?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/auth/callback',data:{terms_version:'2026-11-02',terms_accepted_at:new Date().toISOString()}}}):await client.auth.signInWithPassword({email,password});if(result.error){if($('authMessage'))$('authMessage').textContent=result.error.message;if($('authSubmit'))$('authSubmit').disabled=false;return;}if(result.data.session){$('modal').close();await loadCloud(result.data.session);toast('Signed in. Your study space is ready.');}else{$('authMessage').textContent='Check your email to confirm your account, then sign in here.';$('authSubmit').disabled=false;}};}
 async function resolve(k){const id=epoch;const {data,error}=await client.from('study_entries').select('*').eq('user_id',user.id).eq('passage',k).maybeSingle();if(error||id!==epoch){toast('Could not load the other version. Try again.');return;}const local=dirty.get(k);modal('Choose the note to keep',`<p class="muted">${esc(k)} changed on another device. Neither version will be overwritten until you choose.</p><h3>Your device</h3><p class="conflict-note">${esc(local?.text||'(No note)')}</p><h3>Saved account version</h3><p class="conflict-note">${esc(data?.payload?.text||'(No note)')}</p><div class="button-row"><button id="keepLocal">Keep this device’s version</button><button id="keepCloud">Use account version</button></div>`);$('keepLocal').onclick=()=>{revisions.set(k,Number(data?.revision||0));rememberRevisions();conflicts.delete(k);$('modal').close();push();};$('keepCloud').onclick=()=>{dirty.delete(k);conflicts.delete(k);revisions.set(k,Number(data?.revision||0));if(data?.payload.text)state.notes[k]=data.payload;else delete state.notes[k];if(data?.payload.highlighted)state.highlights[k]=true;else delete state.highlights[k];lastSnapshot=currentPayloads();cache();refresh();display();$('modal').close();};}
 function accountPanel(){if(!user)return authForm();modal('My account',accountMenu({email:user.email,status:saveState().detail,needsAttention:saveState().attention,saving:saveState().saving,avatar:$('accountButton').querySelector('img')?.getAttribute('src')||'',initial:$('accountButton').querySelector('.account-initial')?.textContent||'Y',conflicts:[...conflicts],esc}));const adminButton=$('adminPortal'),owner=user.id;adminButton.onclick=()=>location.assign('/admin/');revealAdminButton(adminButton,client,()=>user?.id===owner&&$('adminPortal')===adminButton);$('editProfile').onclick=()=>document.dispatchEvent(new CustomEvent('open-community',{detail:'profile'}));$('openFriends').onclick=()=>document.dispatchEvent(new CustomEvent('open-community',{detail:'friends'}));$('accountSignOut').onclick=signOut;$('retrySync').onclick=async()=>{$('modal').close();if(!ready){const {data}=await client.auth.getSession();user=null;loadCloud(data.session);}else{syncError='';await push();await preferenceSync?.flush();if(!dirty.size&&!preferenceSync?.pending){const {data}=await client.auth.getSession();loadCloud(data.session,true);}}};$('importDevice').onclick=()=>{if(!ready)return toast('Load your account before importing.');const keys=new Set([...Object.keys(device.notes),...Object.keys(device.highlights)]);if(!keys.size)return toast('No guest notes or highlights to copy.');let overlaps=[...keys].filter(k=>state.notes[k]&&device.notes[k]&&state.notes[k].text!==device.notes[k].text);if(overlaps.length&&!confirm(`Replace ${overlaps.length} conflicting account note(s) with guest notes? Export a backup first if you need both versions.`))return;for(const k of keys){if(device.notes[k])state.notes[k]=device.notes[k];if(device.highlights[k])state.highlights[k]=true;}mutate();refresh();$('modal').close();toast('Guest notes copied; syncing to your account.');};document.querySelectorAll('[data-conflict]').forEach(b=>b.onclick=()=>resolve(b.dataset.conflict));}
 $('accountButton').onclick=accountPanel;
 window.addEventListener('storage',event=>{
  if(event.key!==fenceKey||!sessionEnded()||locallyEnded)return;
  locallyEnded=true;
  void client?.auth.dispose?.();
  if($('modal').open)$('modal').close();
  $('modalBody')?.replaceChildren();
  lastSnapshot.clear();
  void loadCloud(null);
 });
 async function sessionRevoked(token){
  if(!token||navigator.onLine===false)return false;
  try{
   // getUser validates the session with Auth and clears revoked browser sessions.
   const {error}=await client.auth.getUser();
   return error?.name==='AuthSessionMissingError';
  }catch{return false;}
 }
 if(client){
  const initial=await client.auth.getSession();
  if(!initial.data.session){
   const legacy=localRead(authKey,null);
   if(legacy?.access_token&&legacy?.refresh_token){
    const migrated=await client.auth.setSession({access_token:legacy.access_token,refresh_token:legacy.refresh_token});
    if(!migrated.error)localStorage.removeItem(authKey);
   }
  }
  const {data}=await client.auth.getSession();
  const session=await sessionRevoked(data.session?.access_token)?null:data.session;
  client.auth.onAuthStateChange((event,updatedSession)=>{
   if(event==='INITIAL_SESSION')return;
   setTimeout(()=>{if(!sessionEnded()||!updatedSession)loadCloud(updatedSession);},0);
  });
  if(location.pathname==='/auth/callback'&&session){
   const accepted=Number(sessionStorage.getItem('exegetical-google-consent'));
   sessionStorage.removeItem('exegetical-google-consent');
   if(accepted&&Date.now()-accepted>=0&&Date.now()-accepted<3600000&&session.user.identities?.some(i=>i.provider==='google'))await client.auth.updateUser({data:{terms_version:'2026-11-02',terms_accepted_at:new Date(accepted).toISOString()}});
  }
  await loadCloud(session);
  if(location.pathname==='/auth/callback'&&!session&&callbackFailed){
   authForm();
   $('googleAuthMessage').textContent='Sign-in was cancelled or could not be completed. Please try again.';
   history.replaceState(null,'','/');
  }
 }else{ready=true;display();}
 window.addEventListener('online',push);async function pull(){
 if(refreshing||!user||document.visibilityState!=='visible')return;
 refreshing=true;const id=epoch,owner=user.id,token=sessionToken;
 const revision=favoriteRevision;
 try{
  if(await sessionRevoked(token)){
   if(id===epoch&&token===sessionToken)await loadCloud(null);
   return;
  }
  if(id!==epoch||!ready||dirty.size)return;
  const [entries,preferences]=await Promise.all([
   client.from('study_entries').select('*').eq('user_id',owner).order('passage'),
   favoritesReady&&!preferenceSync?.pending?readPreferences(owner):null
  ]);
  if(id!==epoch)return;
  if(preferences&&!preferences.error&&revision===favoriteRevision&&!preferenceSync?.pending){
   const ids=favoriteIds(preferences.data?.settings?.favoriteTranslations);
   if(JSON.stringify(ids)!==JSON.stringify(accountFavorites))showFavorites(ids);
  }
  if(entries.error)return;
  const updated=mergeRemoteStudy(entries.data,{notes:state.notes,highlights:state.highlights,revisions,pending:dirty,editingKey:document.activeElement?.id==='noteText'?document.activeElement.dataset.noteKey:null});
  if(updated){lastSnapshot=currentPayloads();rememberRevisions();cache();refresh({background:true});}
 }finally{refreshing=false;}
 }window.addEventListener('online',()=>{pull();push();preferenceSync?.flush();display();});window.addEventListener('offline',display);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){push();preferenceSync?.flush();pull();}});setInterval(pull,30000);window.addEventListener('beforeunload',e=>{if(dirty.size||preferenceSync?.pending){e.preventDefault();e.returnValue='';}});
 return {endSession,changed:mutate,preferencesChanged,changeFavorite,getUser:()=>user,getClient:()=>client,signIn:authForm,isUser:()=>Boolean(user),canEdit:()=>!user||ready,config,status:()=>saveState().text,cacheKey:k=>user?prefix()+'-'+k:k};
}
