import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {revealAdminButton} from '../account-access.js';
test('admin navigation remains hidden for unauthorized, failed or changed sessions',async()=>{
 const d=new JSDOM('<button hidden>Admin portal</button>').window.document,b=d.querySelector('button'),client={auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}};
 for(const [ok,admin,current] of [[true,false,true],[false,true,true],[true,true,false]]){await revealAdminButton(b,client,()=>current,async()=>({ok,json:async()=>({admin})}));assert.equal(b.hidden,true);}
 await revealAdminButton(b,client,()=>true,async()=>{throw Error('offline');});assert.equal(b.hidden,true);
 await revealAdminButton(b,client,()=>true,async()=>({ok:true,json:async()=>({admin:true})}));assert.equal(b.hidden,false);
 let current=true;await revealAdminButton(b,client,()=>current,async()=>{current=false;return {ok:true,json:async()=>({admin:true})};});assert.equal(b.hidden,true);
});
