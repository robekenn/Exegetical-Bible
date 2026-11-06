import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createMessaging} from '../messaging.js';
import {verseLink} from '../community-model.js';

test('message inbox preserves direct messages and sends mixed attachments to groups',async()=>{
 const dom=new JSDOM('<dialog id="modal" open></dialog>',{url:'https://example.test/'});
 const {document}=dom.window;
 const timers=[];
 const globals={document,location:dom.window.location,navigator:{clipboard:{writeText:async link=>{copied=link;}}},FormData:dom.window.FormData,setInterval:fn=>timers.push(fn)};
 const saved=Object.fromEntries(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 let copied;
 for(const [k,value] of Object.entries(globals))Object.defineProperty(globalThis,k,{value,configurable:true,writable:true});
 const owner='self',friend='friend',second='second',group='group';
 const selected={book:'JHN',chapter:3,verse:16,endVerse:18,translation:'BSB'};
 const note={book:'ROM',chapter:12,verse:2,text:'<strong>Selected private note</strong>',updatedAt:'2026-11-06'};
 const state={book:'JHN',chapter:3,verse:16,translation:'BSB',books:[{id:'JHN',name:'John'},{id:'ROM',name:'Romans'}],notes:{key:note}};
 const summaries=[{person:friend,created_at:'2026-11-06T01:00:00Z',preview:'Legacy message'}];
 const legacy={id:'legacy',sender:friend,body:'Legacy message',verse:{book:'JHN',chapter:3,verse:16,translation:'BSB'},created_at:'2026-11-06T01:00:00Z'};
 const sent=[];
 const db=()=>({
  rpc(name,args){
   if(name==='study_chat_summaries')return [...summaries];
   if(name==='create_study_group'){
    assert.deepEqual(args,{p_title:'Evening study',p_people:[friend,second]});
    summaries.push({group_id:group,title:args.p_title,preview:'Group created'});
    return group;
   }
   if(name==='study_group_roster')return [{id:owner,display_name:'Me'},{id:friend,display_name:'First friend'}];
   if(name==='send_study_message'){sent.push(args);return args.p_id;}
   throw Error(name);
  },
  from(){
   let groupQuery=false;
   return {select(){return this;},eq(){groupQuery=true;return this;},or(){return this;},order(){return this;},
    limit(){return groupQuery?sent.map(m=>({id:m.p_id,body:m.p_body,sender:owner,attachments:m.p_attachments,created_at:'2026-11-06T02:00:00Z'})):[legacy];}};
  }
 });
 const get=id=>document.getElementById(id);
 const submit=async form=>form.onsubmit({preventDefault(){},submitter:form.querySelector('[type=submit]')});
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 try{
  const ui=createMessaging({db,me:()=>({id:owner}),run:async x=>x,esc,state,currentPassage:()=>selected,
   modal:(_,body)=>get('modal').innerHTML=body,openFriends(){},openVerse(){},act(){},report(){},block(){}});
  await ui.open({friends:[friend,second],blocked:new Set(),names:id=>id,person:friend});
  assert.match(get('studyMessageRows').textContent,/Legacy message/);
  assert.ok(get('studyMessageRows').querySelector('[data-study-passage]'));
  get('newStudyGroup').click();
  get('studyGroupName').value='Evening study';
  for(const checkbox of get('newGroupForm').querySelectorAll('input[type=checkbox]'))checkbox.checked=true;
  await submit(get('newGroupForm'));
  assert.match(get('studyChatPane').textContent,/Evening study/);
  get('attachSelection').click();
  get('openAttachmentPicker').click();
  get('attachNote').value='key';
  get('addNotebookAttachment').click();
  get('attachBook').value='ROM';
  get('attachChapter').value='8';
  get('attachStart').value='1';
  get('addCustomPassage').click();
  await submit(get('studyMessageForm'));
  assert.equal(sent.length,1);
  assert.equal(sent[0].p_group,group);
  assert.equal(sent[0].p_person,null);
  assert.deepEqual(sent[0].p_attachments.map(item=>item.kind),['passage','note','passage']);
  assert.equal(sent[0].p_attachments[1].text,note.text);
  assert.equal(get('studyMessageRows').querySelectorAll('[data-study-passage]').length,3);
  assert.match(get('studyMessageRows').textContent,/<strong>Selected private note<\/strong>/);
  assert.ok(!get('studyMessageRows').querySelector('details p strong'));
  assert.equal(get('studyMessageAttachments').textContent,'');
  ui.invite();
  await get('copyStudyInvite').onclick();
  assert.equal(copied,'https://example.test/?invite=1');
 }finally{
  for(const [key,descriptor] of Object.entries(saved))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  dom.window.close();
 }
});

test('shared passage links retain ranges and reject invalid references',()=>{
 const ref={book:'JHN',chapter:3,verse:16,endVerse:18,translation:'BSB'};
 assert.equal(new URL(verseLink(ref),'https://example.test').searchParams.get('endVerse'),'18');
 assert.equal(verseLink({...ref,endVerse:15}),null);
 assert.equal(verseLink({...ref,translation:'<script>'}),null);
});
