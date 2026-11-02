import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {setupPolish} from '../polish.js';
test('startup exits on readiness or timeout and connectivity changes never discard drafts',()=>{
 for(const timeout of [false,true]){
 const dom=new JSDOM('<div id="appLoading"></div><div id="appShell" inert aria-busy="true"><textarea>My draft</textarea></div><div id="startupNotice" hidden></div><div id="connectionStatus" hidden></div>');const w=dom.window,d=w.document;let expire;w.setTimeout=fn=>{expire=fn;return 1;};w.clearTimeout=()=>{};
 setupPolish(d,w);if(timeout)expire();else d.dispatchEvent(new w.Event('app-ready'));
 assert.equal(d.getElementById('appLoading').hidden,true);assert.equal(d.getElementById('appShell').inert,false);assert.equal(d.getElementById('appShell').hasAttribute('aria-busy'),false);
 Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});w.dispatchEvent(new w.Event('offline'));assert.equal(d.getElementById('connectionStatus').hidden,false);
 Object.defineProperty(w.navigator,'onLine',{value:true});w.dispatchEvent(new w.Event('online'));assert.equal(d.getElementById('connectionStatus').hidden,true);assert.equal(d.querySelector('textarea').value,'My draft');dom.window.close();
 }
});
