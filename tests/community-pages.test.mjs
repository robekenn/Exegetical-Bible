import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createCommunity} from '../community.js';
test('community pages preserve actions, mark privacy navigation correctly and render clear empty states',async()=>{
 const dom=new JSDOM('<button id="communityButton"></button><dialog id="modal"></dialog><div id="modalBody"></div>',{url:'https://example.test/'});Object.assign(globalThis,{document:dom.window.document,location:dom.window.location});
 const query=()=>({select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},maybeSingle:async()=>({data:null}),then(resolve){return Promise.resolve({data:[]}).then(resolve);}});
 const c=createCommunity({account:{getUser:()=>({id:'test-user'}),getClient:()=>({from:query,rpc:async()=>({data:[]})})},state:{},esc:s=>String(s),modal:(title,html)=>document.getElementById('modalBody').innerHTML=html,toast:()=>{}});
 await c.open('privacy');assert.equal(document.querySelector('[aria-current="page"]').dataset.community,'privacy');for(const id of ['exportAccount','privacyRequest','deleteAccount'])assert.ok(document.getElementById(id));assert.ok(document.getElementById('deleteAccount').closest('.danger-zone'));
 await c.open('friends');assert.ok(document.getElementById('findFriend'));assert.equal(document.querySelectorAll('.community-empty').length,2);
 await c.open('messages');await new Promise(r=>setImmediate(r));assert.match(document.getElementById('communityContent').textContent,/Your conversations start here/);
 await c.open('profile');assert.equal(document.getElementById('profileForm').querySelectorAll('.community-card').length,4);assert.equal(document.getElementById('username').placeholder,'Choose a username');dom.window.close();
});
