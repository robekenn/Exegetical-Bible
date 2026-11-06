import {verseLink} from './community-model.js';

export function createMessaging({db,me,run,act,esc,modal,report,block,openFriends,openVerse,state,currentPassage}){
 const $=id=>document.getElementById(id);
 const drafts=new Map();
 let generation=0;
 const rpc=(name,args)=>run(db().rpc(name,args));
 const label=ref=>`${state.books.find(book=>book.id===ref.book)?.name||ref.book} ${ref.chapter}:${ref.verse}${ref.endVerse>ref.verse?'–'+ref.endVerse:''} · ${ref.translation}`;
 const title=(target,names)=>target.title||names(target.person);

 function reset(){generation++;drafts.clear();}

 function invite(){
  const link=new URL('/?invite=1',location.origin).href;
  modal('Invite a friend',`<div class="study-invite"><p>Send this link to a friend so they can create an Exegetical account. After they sign up, you can connect using their username in Friends.</p><label class="label" for="studyInviteLink">Signup link</label><input id="studyInviteLink" class="full-input" type="url" value="${esc(link)}" readonly><div class="button-row"><button type="button" id="copyStudyInvite" class="primary">Copy invite link</button><button type="button" id="backToFriends">Back to Friends</button></div><p id="inviteStatus" role="status"></p></div>`);
  $('backToFriends').onclick=openFriends;
  $('copyStudyInvite').onclick=async()=>{
   const field=$('studyInviteLink'),status=$('inviteStatus');
   try{await navigator.clipboard.writeText(link);status.textContent='Invite link copied.';}
   catch{field.focus();field.select();status.textContent='Copy the selected link to share it.';}
  };
 }

 async function open({friends,blocked,names,person=null,attachment=null}){
  const owner=me()?.id;
  if(!owner)return;
  const screen=++generation;
  const friendIds=new Set(friends);
  let selected=null,threadGeneration=0,rows=[],summaries=[],loading=false,olderAvailable=false,threadLimit=60,inboxSignature='';
  const roster=new Map();
  const initialTarget=person?{person}:null;
  modal('Messages',`<div class="message-workspace" id="messageWorkspace">
   <aside class="message-inbox" aria-label="Conversations">
    <header><div><p class="eyebrow">STUDY TOGETHER</p><h3>Inbox</h3></div><button type="button" id="newStudyGroup">New group</button></header>
    <div class="message-inbox-actions"><button type="button" id="messageFriends">Friends</button><button type="button" id="messageInvite">Invite a friend</button></div>
    <p id="inboxStatus" class="muted" role="status">${attachment?'Choose a conversation to share this attachment.':'Loading conversations…'}</p>
    <div class="message-list" id="studyChatList" aria-label="Direct and group conversations"></div>
   </aside>
   <section class="message-pane" id="studyChatPane" aria-label="Active conversation"><div class="message-welcome"><h3>Make space for a conversation</h3><p>Choose a friend or start a group to share passages and notebook notes.</p></div></section>
  </div>`);
  const root=$('messageWorkspace');
  const active=()=>generation===screen&&root.isConnected&&$('modal').open&&me()?.id===owner;
  const current=id=>active()&&id===threadGeneration;
  const key=target=>target.group_id||target.person;
  const draftFor=target=>{
   const id=owner+':'+key(target);
   if(!drafts.has(id))drafts.set(id,{text:'',attachments:[],request:null});
   return drafts.get(id);
  };
  const friendlyNames=id=>id===owner?'You':roster.get(id)||names(id);

  function drawInbox(){
   const list=$('studyChatList');
   const last=new Map(summaries.filter(target=>!blocked.has(target.person)).map(target=>[key(target),target]));
   for(const id of friends)if(!last.has(id))last.set(id,{person:id});
   if(initialTarget&&!last.has(person))last.set(person,initialTarget);
   const items=[...last.values()].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||title(a,names).localeCompare(title(b,names)));
   const signature=JSON.stringify([key(selected||{}),items]);
   if(inboxSignature===signature)return;
   inboxSignature=signature;
   list.innerHTML=items.map((target,i)=>`<button type="button" class="message-inbox-row" data-chat-index="${i}" ${key(target)===key(selected||{})?'aria-current="true"':''}><span class="message-badge" aria-hidden="true">${target.group_id?'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/></svg>':esc(title(target,names).slice(0,1).toUpperCase())}</span><span><strong>${esc(title(target,names))}</strong><small>${esc(target.preview||(target.group_id?'Group chat':'Direct message'))}</small></span></button>`).join('')||'<p class="muted">Add a friend to start a conversation.</p>';
   list.querySelectorAll('[data-chat-index]').forEach(button=>button.onclick=()=>showThread(items[Number(button.dataset.chatIndex)]));
  }

  async function refreshInbox(){
   const items=await rpc('study_chat_summaries');
   if(!active())return;
   summaries=items;
   $('inboxStatus').textContent=attachment?'Choose a conversation to share this attachment.':'';
   drawInbox();
  }

  function showGroupForm(){
   threadGeneration++;
   selected=null;
   drawInbox();
   root.classList.add('thread-open');
   const pane=$('studyChatPane');
   pane.innerHTML=`<header class="message-pane-header"><button type="button" class="message-back">← Inbox</button><div><h3>Start a study group</h3><p class="muted">Choose 2 to 11 accepted friends.</p></div></header>
    <form id="newGroupForm" class="study-group-form"><label class="label" for="studyGroupName">Group name</label><input id="studyGroupName" class="full-input" maxlength="80" required>
    <fieldset><legend>Group members</legend>${friends.map(id=>`<label><input type="checkbox" name="member" value="${esc(id)}"> ${esc(names(id))}</label>`).join('')||'<p>Add friends before creating a group.</p>'}</fieldset>
    <p id="newGroupStatus" role="status"></p><button class="primary" type="submit" ${friends.length<2?'disabled':''}>Create group</button></form>`;
   pane.querySelector('.message-back').onclick=back;
   const form=$('newGroupForm'),status=$('newGroupStatus');
   form.onsubmit=async e=>{
    e.preventDefault();
    const people=new FormData(form).getAll('member');
    if(people.length<2||people.length>11){status.textContent='Choose 2 to 11 accepted friends.';return;}
    const groupTitle=$('studyGroupName').value.trim();
    const button=e.submitter;
    button.disabled=true;
    try{
     const group=await rpc('create_study_group',{p_title:groupTitle,p_people:people});
     if(active()&&form.isConnected){showThread({group_id:group,title:groupTitle});void refreshInbox().catch(()=>{});}
    }catch(error){if(form.isConnected){status.textContent=error.message;button.disabled=false;}}
   };
   $('studyGroupName').focus();
  }

  function back(){
   threadGeneration++;
   root.classList.remove('thread-open');
   selected=null;
   drawInbox();
   $('studyChatPane').innerHTML='<div class="message-welcome"><h3>Choose a conversation</h3><p>Send a message, share passages, or attach a notebook note.</p></div>';
   $('studyChatList').querySelector('button')?.focus();
  }

  function showThread(target){
   if(!active())return;
   selected=target;
   const id=++threadGeneration;
   rows=[];
   roster.clear();
   loading=false;
   olderAvailable=false;
   threadLimit=60;
   root.classList.add('thread-open');
   drawInbox();
   const draft=draftFor(target);
   let attachmentError='';
   if(attachment&&(target.group_id||friendIds.has(target.person))){
    try{addAttachment(draft,attachment);attachment=null;$('inboxStatus').textContent='';}
    catch(error){attachmentError=error.message;}
   }
   const canSend=Boolean(target.group_id||friendIds.has(target.person));
   const chatTitle=title(target,names);
   const pane=$('studyChatPane');
   pane.innerHTML=`<header class="message-pane-header">
    <button type="button" class="message-back">← Inbox</button><div><h3>${esc(chatTitle)}</h3><p class="muted" id="messageParticipants">${target.group_id?'Group conversation':canSend?'Direct message':'Past conversation'}</p></div>
    <details class="chat-options"><summary aria-label="Conversation options">•••</summary><div>${target.group_id?'<button type="button" id="leaveStudyGroup">Leave group</button>':'<button type="button" id="blockMessagePerson">Block person</button><button type="button" id="reportConversation">Report conversation</button>'}</div></details>
   </header>
   <div class="study-message-scroll" id="studyMessageScroll" aria-label="Conversation history"><button type="button" id="olderStudyMessages" hidden>Load older messages</button><div id="studyMessageRows"><p class="loading">Opening conversation…</p></div></div>
   <form id="studyMessageForm" class="study-message-form">
    <label class="sr-only" for="studyMessageBody">Message ${esc(chatTitle)}</label><textarea id="studyMessageBody" rows="2" maxlength="4000" placeholder="Write a message…" ${canSend?'':'disabled'}>${esc(draft.text)}</textarea>
    <div id="studyMessageAttachments" class="study-message-attachments"></div>
    <div class="study-composer-actions"><div><button type="button" id="attachSelection" ${canSend?'':'disabled'}>Add selection</button><button type="button" id="openAttachmentPicker" aria-expanded="false" aria-controls="studyAttachmentPicker" ${canSend?'':'disabled'}>Add passage or note</button></div><button class="primary" type="submit" ${canSend?'':'disabled'}>Send ↑</button></div>
    <div id="studyAttachmentPicker" class="study-attachment-picker" hidden></div>
    <p id="studyMessageStatus" role="status" class="muted">${canSend?'':'Only accepted friends can send new direct messages.'}</p>
   </form>`;
   pane.querySelector('.message-back').onclick=back;
   pane.querySelector('h3').tabIndex=-1;
   pane.querySelector('h3').focus({preventScroll:true});
   const status=$('studyMessageStatus'),form=$('studyMessageForm');
   if(attachmentError)status.textContent=attachmentError;
   const text=$('studyMessageBody');
   text.oninput=()=>{draft.text=text.value;};
   function drawAttachments(){
    const box=$('studyMessageAttachments');
    box.innerHTML=draft.attachments.map((item,i)=>`<div class="study-attachment-chip"><span>${item.kind==='note'?'Note · ':''}${esc(label(item.reference))}${item.kind==='note'?'<small>'+esc(item.text.slice(0,100))+'</small>':''}</span><button type="button" data-remove-attachment="${i}" aria-label="Remove attachment ${i+1}">×</button></div>`).join('');
    box.querySelectorAll('[data-remove-attachment]').forEach(button=>button.onclick=()=>{
     draft.attachments.splice(Number(button.dataset.removeAttachment),1);
     drawAttachments();
    });
   }
   function attach(item){
    try{addAttachment(draft,item);drawAttachments();status.textContent='Attachment ready to send.';}
    catch(error){status.textContent=error.message;}
   }
   $('attachSelection').onclick=()=>attach({kind:'passage',reference:currentPassage()});
   $('openAttachmentPicker').onclick=()=>{
    const picker=$('studyAttachmentPicker');
    picker.hidden=!picker.hidden;
    $('openAttachmentPicker').setAttribute('aria-expanded',String(!picker.hidden));
    if(!picker.hidden)drawPicker(picker,attach);
   };
   drawAttachments();

   if(target.group_id){
    $('leaveStudyGroup').onclick=async()=>{
     if(!confirm('Leave this group? Its conversation will no longer be available to you.'))return;
     try{await rpc('leave_study_group',{p_group:target.group_id});if(current(id)){back();await refreshInbox();}}
     catch(error){if(current(id))status.textContent=error.message;}
    };
    void rpc('study_group_roster',{p_group:target.group_id}).then(members=>{
     if(!current(id))return;
     for(const member of members)roster.set(member.id,member.display_name);
     $('messageParticipants').textContent=members.map(member=>friendlyNames(member.id)).join(', ')||'Group conversation';
     if(rows.length)drawMessages();
    }).catch(()=>{});
   }else{
    $('blockMessagePerson').onclick=()=>block(target.person);
    $('reportConversation').onclick=()=>report('abuse',target.person);
   }

   function drawMessages(){
    const area=$('studyMessageScroll'),body=$('studyMessageRows');
    const atEnd=area.scrollHeight-area.scrollTop-area.clientHeight<70;
    body.innerHTML=rows.map(message=>{
     const mine=message.sender===owner;
     const items=message.attachments?.length?message.attachments:message.verse?[{kind:'passage',reference:message.verse}]:[];
     return `<article class="study-message ${mine?'mine':''}"><div class="study-message-meta"><strong>${esc(friendlyNames(message.sender))}</strong><time datetime="${esc(message.created_at)}">${esc(new Date(message.created_at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</time></div>
      ${message.removed_at?'<p class="muted">Message removed</p>':`${message.body?'<p>'+esc(message.body)+'</p>':''}
       ${items.map(item=>{
        const link=verseLink(item.reference);
        return link?`<div class="study-message-share">${item.kind==='note'?'<details><summary>Notebook note</summary><p>'+esc(item.text)+'</p></details>':''}<a href="${esc(link)}" data-study-passage>${esc(label(item.reference))} ↗</a></div>`:'';
       }).join('')}
       <button type="button" class="small-action" data-study-message="${esc(message.id)}">${mine?'Remove':'Report'}</button>`}</article>`;
    }).join('')||'<p class="muted message-empty">This is the start of your conversation.</p>';
    if(atEnd)area.scrollTop=area.scrollHeight;
    $('olderStudyMessages').hidden=!olderAvailable;
    body.querySelectorAll('[data-study-passage]').forEach(link=>link.onclick=e=>{
     if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
     e.preventDefault();
     const reference=Object.fromEntries(new URL(link.href).searchParams);
     $('modal').close();
     openVerse(reference);
    });
    body.querySelectorAll('[data-study-message]').forEach(button=>button.onclick=async()=>{
     const message=rows.find(item=>item.id===button.dataset.studyMessage);
     if(message.sender!==owner){report('abuse',message.sender,message.id);return;}
     if(!confirm('Remove this message for everyone? This cannot undo copies or screenshots.'))return;
     try{await act('retract',{p_id:message.id});await update();}
     catch(error){if(current(id))status.textContent=error.message;}
    });
   }

   async function update(older=false){
    if(!current(id)||loading)return;
    loading=true;
    try{
     let query=db().from('friend_messages').select('*');
     query=target.group_id?query.eq('group_id',target.group_id):query.or(`and(sender.eq.${owner},recipient.eq.${target.person}),and(sender.eq.${target.person},recipient.eq.${owner})`);
     const limit=older?threadLimit+60:threadLimit;
     const batch=await run(query.order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit));
     if(!current(id))return;
     const scroll=$('studyMessageScroll'),height=scroll.scrollHeight,offset=scroll.scrollTop;
     const before=JSON.stringify(rows);
     threadLimit=limit;
     olderAvailable=batch.length===limit&&limit<300;
     rows=batch.reverse();
     if(older||!rows.length||JSON.stringify(rows)!==before)drawMessages();
     if(older)scroll.scrollTop=offset+scroll.scrollHeight-height;
    }catch(error){if(current(id))status.textContent=error.message;}
    finally{if(current(id))loading=false;}
   }
   $('olderStudyMessages').onclick=()=>update(true);
   form.onsubmit=async e=>{
    e.preventDefault();
    const button=e.submitter;
    if(!canSend||button.disabled)return;
    const body=draft.text;
    const attachments=[...draft.attachments];
    if(!body.trim()&&!attachments.length){status.textContent='Write a message or attach study material.';return;}
    const snapshot=JSON.stringify([body,attachments]);
    if(draft.request?.snapshot!==snapshot)draft.request={snapshot,id:crypto.randomUUID()};
    button.disabled=true;
    try{
     await rpc('send_study_message',{p_id:draft.request.id,p_person:target.person||null,p_group:target.group_id||null,p_body:body,p_attachments:attachments});
     if(draft.text===body)draft.text='';
     draft.attachments=draft.attachments.filter(item=>!attachments.includes(item));
     draft.request=null;
     if(current(id)){text.value=draft.text;drawAttachments();status.textContent='Message sent.';await update();void refreshInbox().catch(()=>{});}
    }catch(error){if(current(id))status.textContent=error.message;}
    finally{if(current(id))button.disabled=false;}
   };
   void update();
   const timer=setInterval(()=>{
    if(!current(id)){clearInterval(timer);return;}
    if(document.visibilityState==='visible')void update();
   },7000);
  }

  $('newStudyGroup').onclick=showGroupForm;
  $('messageFriends').onclick=openFriends;
  $('messageInvite').onclick=invite;
  drawInbox();
  if(initialTarget)showThread(initialTarget);
  try{await refreshInbox();}
  catch(error){if(active())$('inboxStatus').textContent=error.message;}
  const inboxTimer=setInterval(()=>{
   if(!active()){clearInterval(inboxTimer);return;}
   if(document.visibilityState==='visible')void refreshInbox().catch(()=>{});
  },15000);
 }

 function drawPicker(picker,attach){
  const notes=Object.entries(state.notes).filter(([,note])=>note.text?.trim()).sort(([,a],[,b])=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  picker.innerHTML=`<div class="study-picker-fields"><label>Book<select id="attachBook">${state.books.map(book=>`<option value="${esc(book.id)}" ${book.id===state.book?'selected':''}>${esc(book.name)}</option>`).join('')}</select></label><label>Chapter<input type="number" id="attachChapter" min="1" max="999" value="${state.chapter}"></label><label>From verse<input type="number" id="attachStart" min="1" max="999" value="${state.verse}"></label><label>To verse <small>(optional)</small><input type="number" id="attachEnd" min="1" max="999"></label><button type="button" id="addCustomPassage">Add passage</button></div>
   <div class="study-picker-note"><label>Notebook note<select id="attachNote"><option value="">Choose a note</option>${notes.map(([id,note])=>`<option value="${esc(id)}">${esc(label({...note,translation:state.translation}))} · ${esc(note.text.trim().slice(0,75))}</option>`).join('')}</select></label><button type="button" id="addNotebookAttachment" ${notes.length?'':'disabled'}>Attach note copy</button></div><p class="muted">The people in this conversation can read any note you send.</p>`;
  $('addCustomPassage').onclick=()=>{
   const end=$('attachEnd').value;
   attach({kind:'passage',reference:{book:$('attachBook').value,chapter:Number($('attachChapter').value),verse:Number($('attachStart').value),...(end?{endVerse:Number(end)}:{}),translation:state.translation}});
  };
  $('addNotebookAttachment').onclick=()=>{
   const note=notes.find(([id])=>id===$('attachNote').value)?.[1];
   if(!note)return;
   const {book,chapter,verse,endVerse,text}=note;
   attach({kind:'note',reference:{book,chapter,verse,...(endVerse?{endVerse}:{}),translation:state.translation},text});
  };
 }

 return {open,invite,reset};
}

function addAttachment(draft,item){
 if(!verseLink(item.reference))throw Error('Enter a valid passage and verse range.');
 if(draft.attachments.some(existing=>JSON.stringify(existing)===JSON.stringify(item)))return;
 if(draft.attachments.length>=12)throw Error('You can attach up to 12 items per message.');
 if(new TextEncoder().encode(JSON.stringify([...draft.attachments,item])).length>950000)throw Error('These attachments are too large. Send them in separate messages.');
 draft.attachments.push(item);
}
