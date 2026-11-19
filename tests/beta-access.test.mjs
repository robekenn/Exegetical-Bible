import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {setupBetaAccess} from '../beta-access.js';
const tick=()=>new Promise(r=>setImmediate(r));
test('beta navigation fails closed and the account toggle follows verified access',async()=>{
 const dom=new JSDOM('<button id="plansNav" hidden></button><button id="mobilePlansButton" hidden></button><div id="modalBody"><button id="betaPreview" hidden><strong></strong><small></small></button></div>',{pretendToBeVisual:true});
 let user={id:'tester'},allowed=true,setting=true;const requests=[];
 const account={getUser:()=>user,getClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})}})};
 const fetcher=async(url,options)=>{requests.push({url,options});if(options.body)setting=JSON.parse(options.body).enabled;return {ok:true,json:async()=>({eligible:allowed,enabled:allowed&&setting})};};
 try{const access=setupBetaAccess({account,toast:()=>{},doc:dom.window.document,win:dom.window,fetcher});await tick();const d=dom.window.document;
 assert.equal(access.enabled,true);assert.equal(d.getElementById('plansNav').hidden,false);d.getElementById('betaPreview').click();await tick();assert.equal(access.enabled,false);assert.equal(d.getElementById('plansNav').hidden,true);assert.equal(d.getElementById('betaPreview').hidden,false);
 allowed=false;d.dispatchEvent(new dom.window.CustomEvent('visibilitychange'));await tick();assert.equal(d.getElementById('betaPreview').hidden,true);
 user=null;d.dispatchEvent(new dom.window.CustomEvent('study-auth-changed'));assert.equal(access.enabled,false);assert.equal(d.getElementById('mobilePlansButton').hidden,true);
 }finally{dom.window.close();}
});
