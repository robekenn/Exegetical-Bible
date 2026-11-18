import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as syncModel from '../sync-model.js';
import {compareBibleReferences} from '../book-navigation.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=(await readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
function reader(){
 const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only'});
 const context=dom.getInternalVMContext(),doc=dom.window.document;
 const dialog=doc.getElementById('modal');dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 Object.assign(context,{...syncModel,compareBibleReferences});
 const run=code=>vm.runInContext(code,context);
 run(source.slice(0,source.lastIndexOf('start().catch')));
 run(`state.book='JHN';state.chapter=1;state.verse=1;state.books=[{id:'JHN',name:'John',numberOfChapters:21}];
  state.data={translation:{id:'BSB',name:'Berean'},chapter:{content:[{type:'verse',number:1,content:['First verse']},{type:'verse',number:2,content:['Second verse']},{type:'verse',number:3,content:['Third verse']}]}};`);
 return {dom,doc,run};
}

test('study editor tags save on the whole selection, survive edits and reloads, and filter the notebook',async()=>{
 const {dom,doc,run}=reader();
 try{
  run(`state.tab='notes';selectedRange=[1,2];renderStudy();`);
  const editor=doc.getElementById('noteText');
  editor.value='A note on both verses';editor.dispatchEvent(new dom.window.Event('input'));
  const input=doc.getElementById('studyNoteTags');
  input.value='Prayer, prayer, Questions';
  doc.getElementById('studyNoteTagForm').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  let saved=JSON.parse(dom.window.localStorage.getItem('exegetical-notes'));
  assert.deepEqual(saved['JHN.1.1-2'].tags,['Prayer','Questions']);
  assert.equal(saved['JHN.1.1-2'].endVerse,2);
  assert.equal(Object.keys(saved).length,1);
  editor.value+=' with a reflection';editor.dispatchEvent(new dom.window.Event('input'));
  run('renderStudy()');
  assert.equal(doc.getElementById('studyNoteTags').value,'Prayer, Questions');
  doc.querySelector('[data-remove-note-tag="0"]').click();
  saved=JSON.parse(dom.window.localStorage.getItem('exegetical-notes'));
  assert.deepEqual(saved['JHN.1.1-2'].tags,['Questions']);
  assert.match(saved['JHN.1.1-2'].text,/with a reflection/);
  run(`state.notes['JHN.1.3']={text:'An unrelated note',book:'JHN',bookName:'John',chapter:1,verse:3};notebook();`);
  assert.match(doc.getElementById('modalBody').textContent,/Questions/);
  doc.getElementById('notebookTag').value='questions';doc.getElementById('notebookTag').dispatchEvent(new dom.window.Event('change'));
  assert.match(doc.getElementById('noteList').textContent,/with a reflection/);
  assert.doesNotMatch(doc.getElementById('noteList').textContent,/An unrelated note/);
 }finally{dom.window.close();}
});

test('study tag validation protects empty notes and preserves saved tags on invalid input',()=>{
 const {dom,doc,run}=reader();
 try{
  run(`state.tab='notes';renderStudy();`);
  const submit=()=>doc.getElementById('studyNoteTagForm').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  doc.getElementById('studyNoteTags').value='Prayer';submit();
  assert.match(doc.getElementById('noteTagStatus').textContent,/Write a note first/);
  assert.equal(run('Object.keys(state.notes).length'),0);
  const editor=doc.getElementById('noteText');editor.value='My note';editor.dispatchEvent(new dom.window.Event('input'));
  doc.getElementById('studyNoteTags').value='Prayer';submit();
  doc.getElementById('studyNoteTags').value='x'.repeat(41);submit();
  assert.match(doc.getElementById('noteTagStatus').textContent,/40/);
  assert.equal(run(`state.notes['JHN.1.1'].tags.join(',')`),'Prayer');
  doc.getElementById('studyNoteTags').value='<img src=x onerror=alert(1)>';submit();
  assert.equal(doc.querySelector('#studyNoteTagList img'),null);
  assert.match(doc.getElementById('studyNoteTagList').textContent,/<img/);
  editor.value='';editor.dispatchEvent(new dom.window.Event('input'));
  assert.equal(doc.getElementById('studyNoteTagList').textContent,'');
  assert.equal(run('Object.keys(state.notes).length'),0);
 }finally{dom.window.close();}
});

test('commentary preserves source paragraphs, text and section coverage without executing HTML',async()=>{
 const {dom,doc,run}=reader();
 try{
  run(`state.tab='commentary';selectedRange=[1,3];state.commentary='test';state.commentaries=[{id:'test',name:'Historical work'}];
   api=async()=>({commentary:{name:'Historical work',licenseUrl:'https://example.test/license'},chapter:{content:[
    {type:'verse',number:1,content:['Opening paragraph.\\nI. A source point.\\r\\n\\r\\n<img src=x onerror=alert(1)>']},
    {type:'verse',number:3,content:['Another section.']}
   ]}});`);
  await run('renderStudy()');
  const sections=doc.querySelectorAll('.commentary-section');assert.equal(sections.length,2);
  assert.equal(sections[0].querySelector('h4').textContent,'Verses 1–2');
  assert.equal(sections[1].querySelector('h4').textContent,'Verse 3');
  assert.deepEqual([...sections[0].querySelectorAll('.commentary-text p')].map(p=>p.textContent),['Opening paragraph.','I. A source point.','<img src=x onerror=alert(1)>']);
  assert.equal(doc.querySelector('#commentaryContent img'),null);
  assert.equal(doc.querySelector('#commentaryContent .attribution a').href,'https://example.test/license');
 }finally{dom.window.close();}
});

test('compare shows readable edition cards with optional reference adjustments and preserves manual ranges',async()=>{
 const {dom,doc,run}=reader();
 try{
  run(`state.tab='compare';state.translation='BSB';state.compare='KJV';state.translations=[{id:'KJV',name:'King James'}];
   api=async()=>({translation:{id:'KJV',name:'King James'},chapter:{content:[{type:'verse',number:1,content:['Comparison one']},{type:'verse',number:2,content:['Comparison two']}]}});`);
  await run('renderStudy()');
  assert.equal(doc.querySelector('.compare-reference-options').open,false);
  assert.equal(doc.querySelectorAll('.translation-compare-card').length,2);
  assert.equal(doc.querySelector('.compare-card-role').textContent,'Reading translation');
  assert.match(doc.getElementById('compareReferenceStatus').textContent,/unverified/);
  assert.equal(doc.getElementById('compareReferenceStatus').closest('details'),null);
  assert.ok(doc.querySelector('.comparison-pair').compareDocumentPosition(doc.querySelector('.compare-reference-options'))&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  doc.getElementById('compareReference').value='1:1–2';
  doc.getElementById('compareReferenceForm').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(doc.getElementById('comparison').textContent,/Comparison one.*Comparison two/);
  assert.match(doc.getElementById('compareReferenceStatus').textContent,/chosen reference/);
  doc.getElementById('resetCompareReference').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(doc.getElementById('compareReference').value,'1:1');
 }finally{dom.window.close();}
});
