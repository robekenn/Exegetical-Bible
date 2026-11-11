import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createCommunity} from '../community.js';
test('real profile form accepts mixed case and padding, saves normalized names, and explains invalid names',async()=>{
 const dom=new JSDOM('<button id="communityButton"></button><dialog id="modal"></dialog><div id="modalBody"></div>',{url:'https://example.test/'});
 Object.assign(globalThis,{document:dom.window.document,location:dom.window.location});
 let saved;const client={from(table){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null}),order:async()=>({data:[]}),then(resolve){return Promise.resolve({data:[]}).then(resolve);},upsert:async p=>{saved=p;return {data:null};}};},rpc:async()=>({data:[]})};
 const community=createCommunity({account:{getUser:()=>({id:'test-user'}),getClient:()=>client},state:{},esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),modal:(title,html)=>document.getElementById('modalBody').innerHTML=html,toast:()=>{}});
 await community.open('profile');const input=document.getElementById('username');const form=document.getElementById('profileForm');
 document.getElementById('displayName').value='Kenneth';document.getElementById('profileTerms').checked=true;
 const enter=value=>{input.value=value;input.dispatchEvent(new dom.window.Event('input'));};
 for(const value of ['kenneth_robertson','Kenneth_Robertson',' Kenneth_Robertson ','abc','a'.repeat(24)]){enter(value);assert.equal(form.checkValidity(),true,value);}
 enter(' Kenneth_Robertson ');await form.onsubmit({preventDefault(){}});assert.equal(saved.username,'kenneth_robertson');assert.equal(document.getElementById('profileStatus').textContent,'Profile saved.');
 for(const value of ['ab','a'.repeat(25),'kenneth robertson','@kenneth','kenneth-name','kenneth.name']){enter(value);assert.equal(form.checkValidity(),false,value);assert.match(input.validationMessage,/3–24/);}
 enter('');assert.equal(form.checkValidity(),false);enter(' KENNETH_1 ');input.dispatchEvent(new dom.window.Event('blur'));assert.equal(input.value,'kenneth_1');assert.equal(input.getAttribute('aria-invalid'),'false');
 assert.match(document.getElementById('usernameHelp').textContent,/3–24/);assert.equal(document.getElementById('usernameHelp').textContent.includes('kenneth_robertson'),false);assert.equal(input.placeholder,'Choose a username');dom.window.close();
});

test('first sign-in prompts for a profile and a later photo pick persists immediately',async()=>{
 const dom=new JSDOM('<button id="accountButton"></button><button id="mobileAccountButton"></button><button id="communityButton"></button><dialog id="modal"><h2></h2><div id="modalBody"></div></dialog>',{url:'https://example.test/'});
 const window=dom.window;
 const keys=['document','location','createImageBitmap'];
 const prior=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const photo='data:image/webp;base64,AA==';
 Object.assign(globalThis,{document:window.document,location:window.location,createImageBitmap:async()=>({width:400,height:600})});
 window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});
 window.HTMLCanvasElement.prototype.toDataURL=()=>photo;
 const $=id=>document.getElementById(id),dialog=$('modal');
 dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new window.Event('close'));};
 const user={id:'profile-owner'};
 let owner=null,saved=null,updates=[];
 const client={from(table){
  let fields;
  return {select(){return this;},eq(){return this;},order(){return this;},
   maybeSingle:async()=>({data:saved}),
   upsert:async payload=>{saved=payload;return {data:null};},
   update(payload){fields=payload;return this;},
   single:async()=>{updates.push(fields);saved={...saved,...fields};return {data:saved};},
   then(resolve){return Promise.resolve({data:table==='profiles'?saved:[]}).then(resolve);}
  };
 },rpc:async()=>({data:[]})};
 try{
  const community=createCommunity({account:{getUser:()=>owner,getClient:()=>client},state:{},esc:String,modal(title,html){dialog.open=true;dialog.querySelector('h2').textContent=title;$('modalBody').innerHTML=html;},toast(){}});
  owner=user;
  document.dispatchEvent(new window.CustomEvent('study-auth-changed'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(dialog.querySelector('h2').textContent,'Set up your profile');
  assert.equal($('profileForm').checkValidity(),false);
  assert.equal($('profilePhoto').closest('details').open,false);
  $('username').value='study_friend';
  $('displayName').value='Study Friend';
  $('profileTerms').checked=true;
  assert.equal($('profileForm').checkValidity(),true);
  await $('profileForm').onsubmit({preventDefault(){}});
  assert.equal(dialog.open,false);
  assert.equal(saved.avatar,null);

  await community.open('profile');
  Object.defineProperty($('profilePhoto'),'files',{value:[new window.File(['pixels'],'mobile.jpg',{type:'image/jpeg'})]});
  await $('profilePhoto').onchange();
  assert.equal($('photoStatus').textContent,'Profile photo saved.');
  assert.equal(updates[0].avatar,photo);
  assert.equal($('mobileAccountButton').querySelector('img').getAttribute('src'),photo);
  await community.open('profile');
  assert.equal($('profileForm').querySelector('.profile-avatar').getAttribute('src'),photo);
 }finally{
  dom.window.close();
  for(const [key,descriptor]of Object.entries(prior))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
 }
});
