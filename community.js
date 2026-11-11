import {readProfilePhoto} from './profile-photo.js';
import {googleAvatarUrl,googleDisplayName,importGooglePicture} from './google-auth.js';
import {sessionResult,clearAccountCache} from './security-model.js';
import {renderAccountAvatar} from './account-avatar.js';
import {createMessaging} from './messaging.js';
import {normalizeProfile,bindUsernameField,normalizeFriendUsername} from './community-model.js';
export function createCommunity({account,state,esc,modal,toast,openVerse,currentPassage}){
 const $=id=>document.getElementById(id);const db=()=>account.getClient();const me=()=>account.getUser();let profile=null,people=new Map(),friends=[],blocks=[],view='',page=0;
 const run=request=>sessionResult(request,me);
 const act=(action,args={})=>run(db().rpc('community_action',{p_action:action,...args}));
 const name=id=>people.get(id)?.display_name||'Study friend';
 const avatar=p=>p?.avatar?`<img class="profile-avatar" src="${esc(p.avatar)}" alt="${esc(p.display_name||'Profile')} picture">`:`<span class="profile-avatar initials" aria-hidden="true">${esc((p?.display_name||'?').slice(0,1).toUpperCase())}</span>`;
 const fail=e=>toast(e.message||'Unable to complete this action.');
 async function load(){const owner=me()?.id;if(!owner)return;const [p,f,b,others]=await Promise.all([run(db().from('profiles').select('*').eq('id',owner).maybeSingle()),run(db().from('friendships').select('*').order('created_at',{ascending:false})),run(db().from('user_blocks').select('*')),run(db().rpc('list_study_people'))]);if(owner!==me()?.id)return;profile=p;renderAccountAvatar(me(),profile);friends=f;blocks=b;people=new Map(others.map(p=>[p.id,p]));}
 function header(tab){view=tab;page++;const titles={profile:'My profile',friends:'Friends',messages:'Messages',privacy:'Privacy controls'};const paths={profile:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 22v-2a8 8 0 0 1 16 0v2',friends:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2',messages:'M3 4h18v13H9l-6 4V4Z',privacy:'M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7l-9-4ZM9 12l2 2 4-4'};modal(titles[tab]||'Your community',`<div class="community-space"><nav class="community-nav" aria-label="Community pages">${Object.entries(titles).map(([key,title])=>`<button data-community="${key}" ${tab===key?'aria-current="page"':''} class="${tab===key?'active':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[key]}"/></svg><span>${key==='privacy'?'Privacy':key==='profile'?'Profile':title}</span></button>`).join('')}</nav><div id="communityContent"><p class="loading">Opening your community space…</p></div></div>`);document.querySelectorAll('[data-community]').forEach(b=>b.onclick=()=>open(b.dataset.community));}

 async function open(tab='profile'){if(!me())return account.signIn();if(tab==='messages')return chat();header(tab);const id=page;try{await load();if(id!==page)return;if(tab==='profile')profileForm();else if(tab==='privacy')privacyPanel();else friendsPanel();}catch(e){if(id===page)$('communityContent').innerHTML=`<p class="error">${esc(e.message)}<br>Close this window and try again.</p>`;}}
 function profileForm({onboarding=false}={}){
  const existing=profile?.id===me()?.id;
  let pic=profile?.avatar||null;
  const optional=`
   <section class="community-card photo-card">
    <div class="profile-intro">${avatar({...profile,avatar:pic,display_name:profile?.display_name||googleDisplayName(me())})}<h3>Profile picture</h3></div>
    <label class="label" for="profilePhoto">Choose a photo</label>
    <input type="file" id="profilePhoto" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" class="full-input" aria-describedby="photoHelp">
    <div class="profile-photo-actions">
     ${googleAvatarUrl(me())?'<button id="useGooglePhoto" type="button">Use Google picture</button>':''}
     <button id="removePhoto" type="button" ${pic?'':'hidden'}>Remove picture</button>
    </div>
    <p id="photoHelp" class="muted">Photos up to 30 MB are resized automatically.</p>
    <p id="photoStatus" class="auth-feedback" role="status"></p>
   </section>
   <section class="community-card">
    <h3>About you</h3>
    <label class="label" for="profileBio">Bio (optional)</label>
    <textarea id="profileBio" maxlength="600">${esc(profile?.bio||'')}</textarea>
    <label class="label" for="profileLocation">General location (optional)</label>
    <input id="profileLocation" class="full-input" maxlength="80" value="${esc(profile?.location||'')}">
    <label class="label" for="profileInterests">Study interests (optional)</label>
    <input id="profileInterests" class="full-input" maxlength="200" value="${esc(profile?.interests||'')}">
   </section>`;
  $('communityContent').innerHTML=`
   <form id="profileForm">
    <p class="muted">${onboarding?'Choose how you’ll appear to friends. Your email stays private.':'Manage the name and details you share with friends.'}</p>
    <section class="community-card">
     <h3>Your name</h3>
     <label class="label" for="username">Username (required)</label>
     <input id="username" class="full-input" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Choose a username" aria-describedby="usernameHelp" value="${esc(profile?.username||'')}">
     <p id="usernameHelp" class="muted">Use 3–24 letters, numbers or underscores. Capital letters are saved as lowercase.</p>
     <label class="label" for="displayName">Display name (required)</label>
     <input id="displayName" class="full-input" maxlength="60" required autocomplete="nickname" value="${esc(profile?.display_name||googleDisplayName(me()))}">
     <label class="check-label"><input id="profileDiscoverable" type="checkbox" ${profile?.discoverable?'checked':''}> Let people find me by my exact username.</label>
    </section>
    ${onboarding?`<details class="profile-optional"><summary>Add a photo or bio (optional)</summary>${optional}</details>`:optional}
    <section class="community-card">
     <h3>Profile visibility</h3>
     <p class="muted">Accepted friends can see your name, photo and any details you add.</p>
     <label class="auth-consent"><input id="profileTerms" type="checkbox" required ${existing?'checked':''}><span>I am at least 16, agree to the <a href="/terms/" target="_blank" rel="noopener">Terms</a> and <a href="/guidelines/" target="_blank" rel="noopener">Community guidelines</a>, and have read the <a href="/privacy/" target="_blank" rel="noopener">Privacy notice</a>.</span></label>
    </section>
    <div id="profileStatus" class="auth-feedback" role="status" tabindex="-1"></div>
    <div class="profile-save"><button id="saveProfile" class="primary">${existing?'Save profile':'Create profile'}</button></div>
   </form>`;
  bindUsernameField($('username'));
  const form=$('profileForm'),save=$('saveProfile'),photo=$('profilePhoto'),remove=$('removePhoto'),google=$('useGooglePhoto');
  const status=$('photoStatus'),profileStatus=$('profileStatus'),owner=me().id;
  const active=()=>form.isConnected&&owner===me()?.id;
  const setBusy=busy=>{for(const control of [save,photo,remove,google])if(control)control.disabled=busy;};
  const feedback=(element,message,kind)=>{element.dataset.kind=kind;element.textContent=message;};
  async function changePhoto(prepare,removePicture=false){
   if(!active()||save.disabled)return;
   setBusy(true);
   feedback(status,removePicture?'Removing your photo…':'Preparing your photo…','pending');
   try{
    const next=await prepare();
    if(!active())return;
    if(profile?.id===owner){
     feedback(status,'Saving your photo…','pending');
     const saved=await run(db().from('profiles').update({avatar:next,updated_at:new Date().toISOString()}).eq('id',owner).select('avatar').single());
     pic=saved.avatar;
     profile={...profile,avatar:pic};
     renderAccountAvatar(me(),profile);
     if(!active())return;
     feedback(status,pic?'Profile photo saved.':'Profile photo removed.','success');
    }else{
     pic=next;
     feedback(status,pic?'Photo ready. It will be saved when you create your profile.':'Photo removed from your draft.','success');
    }
    form.querySelector('.profile-intro .profile-avatar').outerHTML=avatar({avatar:pic,display_name:$('displayName').value||'You'});
    remove.hidden=!pic;
   }catch(error){
    if(active())feedback(status,error.message||'The photo could not be saved. Try again.','error');
   }finally{
    if(active()){photo.value='';setBusy(false);}
   }
  }
  async function convertPhoto(jpeg){
   const session=await run(db().auth.getSession());
   if(!active()||session.session?.user?.id!==owner)throw Error('Sign in again to save your photo.');
   const response=await fetch('/api/account',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.session.access_token},
    body:JSON.stringify({action:'convert-photo',jpeg})
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Could not resize your photo. Try again.');
   return result.avatar;
  }
  photo.onchange=()=>{const file=photo.files[0];if(file)return changePhoto(()=>readProfilePhoto(file,convertPhoto));};
  if(google)google.onclick=()=>changePhoto(()=>importGooglePicture(me(),convertPhoto));
  remove.onclick=()=>changePhoto(()=>null,true);
  form.onsubmit=async event=>{
   event.preventDefault();
   if(!active()||save.disabled)return;
   setBusy(true);
   feedback(profileStatus,'Saving your profile…','pending');
   try{
    const payload=normalizeProfile({username:$('username').value,display_name:$('displayName').value,bio:$('profileBio').value,location:$('profileLocation').value,interests:$('profileInterests').value,avatar:pic,discoverable:$('profileDiscoverable').checked});
    if(profile?.id===owner){
     // Photo changes save independently. Profile edits must preserve the stored photo.
     const {avatar:unused,...fields}=payload;
     profile=await run(db().from('profiles').update(fields).eq('id',owner).select('*').single());
    }else{
     await run(db().from('profiles').upsert({id:owner,...payload}));
     profile={id:owner,...payload};
    }
    renderAccountAvatar(me(),profile);
    if(!active())return;
    save.textContent='Save profile';
    if(onboarding){$('modal').close();toast('Your profile is ready.');}
    else feedback(profileStatus,'Profile saved.','success');
   }catch(error){
    if(active()){
     feedback(profileStatus,error.code==='23505'||error.message?.includes('duplicate')?'That username is already taken. Choose another.':error.message||'Your profile could not be saved. Try again.','error');
     profileStatus.focus();
    }
   }finally{
    if(active())setBusy(false);
   }
  };
 }
 function friendRow(f){const other=f.requester===me().id?f.recipient:f.requester;const p=people.get(other);return `<article class="friend-row">${avatar(p)}<div><strong>${esc(name(other))}</strong><small>@${esc(p?.username||'member')}</small></div><div class="friend-actions">${f.status==='accepted'?`<button data-chat="${other}">Message</button><button data-profile="${other}">View</button>`:f.recipient===me().id?`<button data-accept="${f.id}">Accept</button>`:'<span class="muted">Sent</span>'}<button data-remove="${f.id}">${f.status==='accepted'?'Unfriend':f.recipient===me().id?'Decline':'Cancel'}</button></div></article>`;}
 function friendsPanel(){const accepted=friends.filter(f=>f.status==='accepted'),incoming=friends.filter(f=>f.status==='pending'&&f.recipient===me().id),outgoing=friends.filter(f=>f.status==='pending'&&f.requester===me().id);$('communityContent').innerHTML=`${!profile?'<p class="error">Create your profile before sending friend requests.</p>':''}<div class="community-page-intro"><h3>Study is better together.</h3><p class="muted">Find a person by their exact username. There is no public member directory. They must turn on discovery in their profile.</p></div><section class="community-card"><div class="friend-section-heading"><h3>Find a friend</h3><button type="button" id="friendSignupInvite">Invite a friend</button></div><form id="findFriend" class="inline-form" role="search" autocomplete="off"><label class="sr-only" for="friendUsername">Exact username</label><input id="friendUsername" type="search" name="friend-search-query" enterkeyhint="search" data-1p-ignore data-lpignore="true" placeholder="Username or @username" required maxlength="80" autocapitalize="none" autocomplete="off" spellcheck="false" aria-describedby="friendSearchHelp"><button id="findFriendButton" class="primary">Find friend</button></form><p id="friendSearchHelp" class="muted">Use their exact username, with or without @. They must enable discovery in Profile.</p><div id="friendSearchResult" aria-live="polite"></div></section><h3>Requests for you <small>${incoming.length}</small></h3>${incoming.map(friendRow).join('')||'<div class="community-empty"><strong>You’re all caught up</strong><p>New friend requests will appear here.</p></div>'}<h3>Your friends <small>${accepted.length}</small></h3>${accepted.map(friendRow).join('')||'<div class="community-empty"><strong>A place for your study circle</strong><p>Find a friend above to start sharing verses and encouragement.</p></div>'}<details><summary>Sent requests (${outgoing.length})</summary>${outgoing.map(friendRow).join('')}</details>`;$('friendSignupInvite').onclick=messaging.invite;bindRows();let searchVersion=0;$('findFriend').onsubmit=async e=>{e.preventDefault();const request=++searchVersion,currentPage=page,root=$('friendSearchResult'),button=$('findFriendButton');const active=()=>request===searchVersion&&currentPage===page&&root.isConnected;let username;try{username=normalizeFriendUsername($('friendUsername').value);}catch(error){root.textContent=error.message;return;}
 if(username===profile?.username){root.textContent='That’s your username. Search for your friend’s username instead.';return;}
 button.disabled=true;button.textContent='Searching…';root.innerHTML='<p class="loading">Finding profile…</p>';
 try{const rows=await run(db().rpc('find_study_friend',{p_username:username}));if(!active())return;if(!rows.length){root.innerHTML='<div class="community-empty"><strong>No profile found</strong><p>Check the spelling and ask your friend to enable username discovery in their Profile.</p></div>';return;}
 const p=rows[0];people.set(p.id,p);const existing=friends.find(f=>f.requester===p.id||f.recipient===p.id);let action=!profile?'<span class="muted">Save your profile before sending a request.</span>':existing?.status==='accepted'?'<button id="searchMessageFriend">Message</button>':existing?.recipient===me().id?'<button id="searchAcceptFriend" class="primary">Accept request</button>':existing?'<span class="request-sent">✓ Request sent</span>':'<button id="sendFriendRequest" class="primary">Send request</button>';
 root.innerHTML=`<article class="friend-row friend-search-match">${avatar(p)}<div><strong>${esc(p.display_name)}</strong><small>@${esc(p.username)}</small></div>${action}</article>`;
 if($('searchMessageFriend'))$('searchMessageFriend').onclick=()=>chat(p.id);
 const bindAction=(id,action,args)=>{const target=$(id);if(!target)return;target.onclick=async()=>{if(!active())return;target.disabled=true;try{await act(action,args);if(!active())return;toast(action==='accept'?'Friend request accepted.':'Friend request sent.');open('friends');}catch(error){if(active()){root.insertAdjacentHTML('beforeend',`<p class="muted" role="status">${esc(error.message)}</p>`);target.disabled=false;}};};};bindAction('sendFriendRequest','request',{p_person:p.id});bindAction('searchAcceptFriend','accept',{p_id:existing?.id});
 }catch(error){if(active())root.textContent=error.message;}finally{if(active()){button.disabled=false;button.textContent='Find friend';}}};}

 function bindRows(){document.querySelectorAll('[data-chat]').forEach(b=>b.onclick=()=>chat(b.dataset.chat));document.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>viewFriend(b.dataset.profile));document.querySelectorAll('[data-accept]').forEach(b=>b.onclick=async()=>{try{await act('accept',{p_id:b.dataset.accept});open('friends');}catch(e){fail(e);}});document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{try{if(!confirm('Remove this friendship or pending request? Existing messages remain unless retracted or the account is deleted.'))return;await act('remove',{p_id:b.dataset.remove});open('friends');}catch(e){fail(e);}});}
 async function viewFriend(id){try{const p=await run(db().from('profiles').select('*').eq('id',id).single());modal(p.display_name,`<div class="profile-intro">${avatar(p)}<div><h3>${esc(p.display_name)}</h3><p class="muted">@${esc(p.username)}</p></div></div><p class="profile-bio">${esc(p.bio||'No bio added.')}</p>${p.location?'<p>General location: '+esc(p.location)+'</p>':''}${p.interests?'<p>Study interests: '+esc(p.interests)+'</p>':''}<div class="button-row"><button id="messageProfile">Message</button><button id="blockProfile">Block</button><button id="reportProfile">Report profile</button><button id="backFriends">Back to friends</button></div>`);$('messageProfile').onclick=()=>chat(id);$('blockProfile').onclick=()=>block(id);$('reportProfile').onclick=()=>report('abuse',id);$('backFriends').onclick=()=>open('friends');}catch(e){fail(e);}}
 const messaging=createMessaging({db,me,run,act,esc,modal,report,block,openFriends:()=>open('friends'),openVerse,state,currentPassage});
 function messagesPanel(person=null,attachment=null){
  view='messages';
  page++;
  const accepted=friends.filter(f=>f.status==='accepted').map(f=>f.requester===me().id?f.recipient:f.requester);
  return messaging.open({friends:accepted,blocked:new Set(blocks.map(block=>block.blocked)),names:name,person,attachment});
 }
 async function chat(person,attachment=null){
  if(!me())return account.signIn();
  header('messages');
  const id=page;
  try{await load();if(id===page&&me()&&$('modal').open)await messagesPanel(person,attachment);}
  catch(error){if(id===page&&$('communityContent'))$('communityContent').textContent=error.message;}
 }
 function shareVerse(event){
  return chat(null,event?.detail||{kind:'passage',reference:currentPassage()});
 }
 async function block(id){if(!confirm('Block this person? Their friendship will be removed and they cannot send you new requests or messages.'))return;try{await act('block',{p_person:id});toast('Person blocked.');open('privacy');}catch(e){fail(e);}}
 function report(category='support',subject=null,message=null){view='report';page++;modal(category==='abuse'?'Report a concern':'Contact & privacy request',`<form id="reportForm"><p class="muted">Sent privately to the site operator for manual review. This is not an emergency service; response times are not guaranteed.</p><label class="label" for="reportCategory">Type of request</label><select id="reportCategory">${(subject?['abuse']:['abuse','privacy','support','accessibility']).map(c=>`<option ${c===category?'selected':''}>${c}</option>`).join('')}</select><label class="label" for="reportDetails">Tell us what happened (10–3,000 characters)</label><textarea id="reportDetails" minlength="10" maxlength="3000" required></textarea><p class="muted">Include only information needed to resolve the issue. A reported message may be reviewed by the operator.</p><button id="submitReport" class="primary">Submit privately</button><p id="reportStatus" class="muted" role="status"></p></form>`);$('reportForm').onsubmit=async e=>{e.preventDefault();$('submitReport').disabled=true;try{await run(db().rpc('submit_community_report',{p_category:$('reportCategory').value,p_details:$('reportDetails').value,p_subject:subject,p_message:message}));$('reportStatus').textContent='Request received for manual review.';$('reportDetails').value='';}catch(e){$('reportStatus').textContent=e.message;}finally{if($('submitReport'))$('submitReport').disabled=false;}};}
 function privacyPanel(){$('communityContent').innerHTML=`<div class="community-page-intro"><h3>Your information, your choices.</h3><p class="muted">Turn off username discovery in My profile, remove optional details or your picture, export your records, or delete your account.</p></div><section class="community-card privacy-actions"><h3>Your data</h3><button id="exportAccount"><span><strong>Download account data</strong><small>A personal copy of your notes and account records</small></span><span aria-hidden="true">↓</span></button><button id="privacyRequest"><span><strong>Send a privacy request</strong><small>Ask a question or request help with your data</small></span><span aria-hidden="true">›</span></button></section><section class="community-card"><h3>Blocked people</h3>${blocks.map(b=>`<article class="friend-row"><span>${esc(name(b.blocked))}</span><button data-unblock="${b.blocked}">Unblock</button></article>`).join('')||'<p class="muted">You haven’t blocked anyone.</p>'}<p class="muted">Unblocking does not restore a friendship. Previously received messages may remain in the recipient’s history.</p></section><section class="community-card danger-zone"><h3>Close your account</h3><p class="muted">Permanently remove your account and its data. Download anything you want to keep first.</p><button id="deleteAccount" class="danger">Delete my account</button></section><div class="legal-links"><a href="/privacy/" target="_blank" rel="noopener">Data & privacy</a><a href="/cookies/" target="_blank" rel="noopener">Cookies</a><a href="/terms/" target="_blank" rel="noopener">Terms</a><a href="/guidelines/" target="_blank" rel="noopener">Community guidelines</a><a href="/accessibility/" target="_blank" rel="noopener">Accessibility</a></div>`;$('exportAccount').onclick=exportAccount;$('privacyRequest').onclick=()=>report('privacy');$('deleteAccount').onclick=deleteAccount;document.querySelectorAll('[data-unblock]').forEach(b=>b.onclick=async()=>{try{await act('unblock',{p_person:b.dataset.unblock});open('privacy');}catch(e){fail(e);}});}
 async function exportAccount(){try{const owner=me().id;const all=async(table)=>{let rows=[];for(let offset=0;;offset+=1000){const d=await run(db().from(table).select('*').range(offset,offset+999));rows.push(...d);if(d.length<1000)break;}return rows;};const [entries,preferences,messages,reports,groups]=await Promise.all([all('study_entries'),all('study_preferences'),all('friend_messages'),all('community_reports'),all('study_groups')]);const blob=new Blob([JSON.stringify({format:'exegetical-account-export',version:1,exportedAt:new Date().toISOString(),account:{id:owner,email:me().email},profile,entries,preferences,friendships:friends,blocks,messages,groups,reports},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='exegetical-account-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Account export downloaded.');}catch(e){fail(e);}}
 function deleteAccount(){const owner=me();if(!owner)return;view='delete';const confirmationPage=++page;modal('Delete your account',`<form id="deleteAccountForm"><p>Confirm deletion for <strong>${esc(owner.email||owner.id)}</strong>.</p><p class="error">This permanently removes your account, profile, private notes, highlights, preferences, friendships and messages stored by this app. Messages you sent are removed from their conversations. Reports may be retained without your account ID. Copies others saved outside the app cannot be recalled.</p><p class="muted">Export anything you want to keep first. This action cannot be undone.</p><label class="label" for="deleteConfirmation">Type DELETE to confirm</label><input id="deleteConfirmation" class="full-input" pattern="DELETE" required autocomplete="off"><button class="danger" id="confirmDeleteAccount">Permanently delete my account</button><p id="deletionStatus" role="status" class="muted"></p></form>`);const form=$('deleteAccountForm'),button=$('confirmDeleteAccount'),status=$('deletionStatus');
 const isCurrent=()=>form.isConnected&&$('modal').open&&confirmationPage===page&&me()?.id===owner.id;
 form.onsubmit=async event=>{
  event.preventDefault();
  if(!isCurrent())return;
  const confirmation=$('deleteConfirmation').value;
  button.disabled=true;
  try{
   const {data}=await db().auth.getSession();
   if(!isCurrent()||data.session?.user?.id!==owner.id||$('deleteConfirmation').value!==confirmation)throw Error('Account or confirmation changed. Reopen the deletion form.');
   const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({action:'delete',confirmation,accountId:owner.id})});
   const d=await r.json();
   if(!r.ok)throw Error(d.error);
   clearAccountCache(localStorage,owner.id);
   if(me()?.id===owner.id)await account.endSession();
   toast('Your account has been deleted.');
  }catch(error){if(form.isConnected){status.textContent=error.message;button.disabled=false;}}
 };
 }
 $('communityButton').onclick=()=>open('friends');document.addEventListener('open-community',e=>open(e.detail));document.addEventListener('share-study-verse',shareVerse);let communityOwner=me()?.id||null;document.addEventListener('study-auth-changed',()=>{const owner=me()?.id||null;if(owner===communityOwner)return;communityOwner=owner;page++;profile=null;friends=[];blocks=[];people.clear();messaging.reset();if($('modal').open&&view)$('modal').close();view='';refreshAccountAvatar();});
 if(location.hash==='#contact')setTimeout(()=>{if(me())report('support');else account.signIn();},100);
 let promptedOwner=null;
 async function refreshAccountAvatar(){
  const owner=me()?.id;
  renderAccountAvatar(me(),null);
  if(!owner){promptedOwner=null;return;}
  try{
   const initialPage=page;
   const saved=await run(db().from('profiles').select('display_name,username,avatar').eq('id',owner).maybeSingle());
   if(owner!==me()?.id)return;
   renderAccountAvatar(me(),profile||saved);
   if(saved||profile||promptedOwner===owner)return;
   const dialog=$('modal');
   if(!dialog||(!dialog.open&&page!==initialPage))return;
   const prompt=()=>{
    if(owner!==me()?.id||profile||promptedOwner===owner)return;
    if(dialog.open){dialog.addEventListener('close',prompt,{once:true});return;}
    promptedOwner=owner;
    view='profile';
    page++;
    modal('Set up your profile','<div class="community-space" id="communityContent"></div>');
    profileForm({onboarding:true});
   };
   prompt();
  }catch{/* Keep initials if the profile cannot load. */}
 }
 refreshAccountAvatar();
 return {open,shareVerse};
}
