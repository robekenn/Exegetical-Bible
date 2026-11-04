import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('commentary controls survive missing coverage, network failures and stale requests',async()=>{
 const dom=new JSDOM(await readFile(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.test/',runScripts:'outside-only'}),context=dom.getInternalVMContext(),d=dom.window.document;
 let code=await readFile(new URL('../app.js',import.meta.url),'utf8');code=code.replace(/^import .*;\n/gm,'');code=code.slice(0,code.lastIndexOf('start().catch'));vm.runInContext(code,context);
 vm.runInContext(`state.book='SNG';state.chapter=8;state.verse=1;state.books=[{id:'SNG',name:'Song',numberOfChapters:8}];state.commentaries=[{id:'missing',name:'Missing work'},{id:'available',name:'Available work'}];state.commentary='missing';state.data={chapter:{content:[{type:'verse',number:1,content:['A selected verse']}]}};state.tab='commentary';api=async()=>{const e=Error('This resource does not cover this passage.');e.status=404;throw e;};`,context);
 await vm.runInContext('renderStudy()',context);
 assert.equal(d.querySelectorAll('#commentarySelect option').length,2);assert.match(d.getElementById('commentaryContent').textContent,/No coverage for this chapter/);assert.match(d.getElementById('studyBody').textContent,/A selected verse/);d.getElementById('chooseAnotherCommentary').click();assert.equal(d.activeElement.id,'commentarySelect');
 vm.runInContext(`api=async()=>({commentary:{name:'Available work',licenseUrl:'https://example.test/license'},chapter:{content:[{type:'verse',number:1,content:['Sourced commentary.']}]}});`,context);
 const select=d.getElementById('commentarySelect');select.value='available';select.dispatchEvent(new dom.window.Event('change'));await new Promise(r=>setImmediate(r));assert.match(d.getElementById('commentaryContent').textContent,/Sourced commentary/);assert.equal(d.getElementById('commentarySelect').value,'available');
 vm.runInContext(`api=async()=>{throw Error('Network unavailable');};`,context);await vm.runInContext('renderStudy()',context);assert.match(d.getElementById('commentaryContent').textContent,/Network unavailable/);assert.ok(d.getElementById('commentarySelect'));assert.ok(d.querySelector('#commentaryContent .retry'));
 vm.runInContext(`let rejectOld;api=()=>new Promise((resolve,reject)=>{rejectOld=reject;});let oldRequest=renderStudy();`,context);assert.ok(d.getElementById('commentarySelect'));assert.equal(d.getElementById('commentaryContent').getAttribute('aria-busy'),'true');
 vm.runInContext(`api=async()=>({commentary:{name:'Available work'},chapter:{content:[{type:'verse',number:1,content:['Newer result']}]}});state.commentary='available';`,context);await vm.runInContext('renderStudy()',context);await vm.runInContext(`rejectOld(Error('Old request failed'));oldRequest;`,context);assert.match(d.getElementById('commentaryContent').textContent,/Newer result/);assert.doesNotMatch(d.getElementById('commentaryContent').textContent,/Old request failed/);dom.window.close();
});
