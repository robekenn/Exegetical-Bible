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
 for(const value of ['ab','a'.repeat(25),'kenneth robertson','@kenneth','kenneth-name','kenneth.name']){enter(value);assert.equal(form.checkValidity(),false,value);assert.match(input.validationMessage,/Example: kenneth_robertson/);}
 enter('');assert.equal(form.checkValidity(),false);enter(' KENNETH_1 ');input.dispatchEvent(new dom.window.Event('blur'));assert.equal(input.value,'kenneth_1');assert.equal(input.getAttribute('aria-invalid'),'false');
 assert.match(document.getElementById('usernameHelp').textContent,/3–24/);dom.window.close();
});
