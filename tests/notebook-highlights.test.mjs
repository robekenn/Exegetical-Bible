import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

test('notebook groups consecutive saved highlights and opens the first verse', async () => {
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only'});
 try{
  const context=dom.getInternalVMContext(),document=dom.window.document;
  const modal=document.getElementById('modal');
  modal.showModal=()=>{modal.open=true;};
  modal.close=()=>{modal.open=false;};
  let code=await readFile(new URL('../app.js',import.meta.url),'utf8');
  code=code.replace(/^import .*;\n/gm,'');
  vm.runInContext(code.slice(0,code.lastIndexOf('start().catch')),context);
  vm.runInContext(`
   state.books=[{id:'JHN',name:'John',numberOfChapters:21}];
   state.highlights={'JHN.3.18':true,'JHN.3.16':true,'JHN.3.17':true,'JHN.3.19':false,'JHN.3.20':true,'JHN.4.1':true};
   state.notes={'JHN.3.16':{book:'JHN',bookName:'John',chapter:3,verse:16,text:'Personal note',updatedAt:'2026-11-04'}};
   api=async path=>({
    chapter:{content:Array.from({length:21},(_,i)=>({type:'verse',number:i+1,content:['Synthetic verse '+(i+1)+'—\\n\\ncontinued']}))},
    translation:{shortName:'BSB',licenseUrl:'https://example.test/'}
   });
   let opened;
   navigate=async (...args)=>{opened=args.join('.');};
  `,context);
  document.getElementById('notebookNav').click();
  assert.match(document.getElementById('noteList').textContent,/Personal note/);
  document.querySelector('[data-notebook-view="highlights"]').click();
  const labels=()=>[...document.querySelectorAll('[data-highlight-card] h3')].map(heading=>heading.textContent);
  assert.deepEqual(labels(),['John 3:16–18','John 3:20','John 4:1']);
  await new Promise(resolve=>setImmediate(resolve));
  const card=document.querySelector('[data-highlight-card]');
  const text=card.querySelector('[data-highlight-text]').textContent;
  for(const verse of [16,17,18])assert.match(text,new RegExp('Synthetic verse '+verse));
  assert.match(text,/Synthetic verse 16— continued/);
  assert.match(card.querySelector('[data-highlight-notes]').textContent,/Personal note/);
  card.querySelector('[data-add-highlight-note]').click();
  const editor=card.querySelector('form');
  editor.elements.text.value='Note from the highlight card';
  editor.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  assert.equal(vm.runInContext("state.notes['JHN.3.16-18'].text",context),'Note from the highlight card');
  assert.match(card.querySelector('[data-highlight-notes]').textContent,/Personal note/);
  assert.match(card.querySelector('[data-highlight-notes]').textContent,/Note from the highlight card/);
  const search=document.getElementById('noteSearch');
  search.value='John 3:16-18';
  search.dispatchEvent(new dom.window.Event('input'));
  await new Promise(resolve=>setTimeout(resolve,250));
  assert.deepEqual(labels(),['John 3:16–18']);
  document.querySelector('[data-highlight-passage]').click();
  assert.equal(vm.runInContext('opened',context),'JHN.3.16');
  assert.equal(modal.open,false);
 }finally{dom.window.close();}
});
