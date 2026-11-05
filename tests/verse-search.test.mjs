import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import handler from '../api/bible.js';

test('Bible proxy validates search, ranks BSB phrases first and paginates',async()=>{
 const originalFetch=globalThis.fetch;
 let requests=0;
 globalThis.fetch=async url=>{
  requests++;
  assert.equal(url,'https://bible.helloao.org/api/BSB/complete.simple.json');
  return {ok:true,json:async()=>({books:[{id:'PSA',name:'Psalms',chapters:[{chapter:{number:1,content:[
   {type:'heading',text:'Search phrase'},
   {type:'verse',number:1,text:'Phrase with search'},
   ...Array.from({length:12},(_,i)=>({type:'verse',number:i+2,text:'A search phrase fixture'}))
  ]}}]}]})};
 };
 async function request(params){
  const output={};
  await handler({method:'GET',query:{path:'search.json',translation:'BSB',q:'search phrase',...params}},
   {status(code){output.status=code;return this;},json(body){output.body=body;},setHeader(_,value){output.cache=value;}});
  return output;
 }
 try{
  assert.equal((await request({translation:'https://example.test'})).status,400);
  assert.equal((await request({q:'x'})).status,400);
  assert.equal((await request({page:'51'})).status,400);
  assert.equal(requests,0);
  const first=await request({});
  assert.equal(first.status,200);
  assert.equal(first.cache,'private, no-store');
  assert.equal(first.body.results[0].verse,2);
  assert.equal(first.body.results.length,12);
  assert.equal(first.body.hasMore,true);
  const second=await request({page:'2'});
  assert.equal(second.body.results[0].verse,1);
  assert.equal(second.body.hasMore,false);
  assert.equal(requests,1);
 }finally{globalThis.fetch=originalFetch;}
});

test('verse search displays escaped results and opens the selected verse in the searched edition',async()=>{
 const dom=new JSDOM(await readFile(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.test/',runScripts:'outside-only'});
 try{
  const context=dom.getInternalVMContext(),d=dom.window.document,dialog=d.getElementById('modal');
  dialog.showModal=()=>{dialog.open=true;};
  dialog.close=()=>{dialog.open=false;};
  const code=(await readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  vm.runInContext(code.slice(0,code.lastIndexOf('start().catch')),context);
  vm.runInContext(`
   state.translations=[{id:'BSB',name:'Berean'},{id:'ESV',name:'ESV'}];
   state.translation='ESV';
   let requested, opened;
   fetch=async url=>{requested=url;return {ok:true,json:async()=>({results:[{book:'PSA',chapter:46,verse:10,reference:'Psalm 46:10',text:'<img src=x> Synthetic fixture'}],licenseUrl:'https://berean.bible/'})};};
   api=async()=>({books:[{id:'PSA',name:'Psalms',numberOfChapters:150}]});
   navigate=async(...args)=>{opened=[state.translation,...args].join('.');};
   openVerseSearch("be still and know",document.getElementById("books"));
  `,context);
  assert.equal(d.querySelector('[data-search-edition]').value,'ESV');
  const edition=d.querySelector('[data-search-edition]');
  edition.value='BSB';
  edition.dispatchEvent(new dom.window.Event('change'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(vm.runInContext('requested',context),/translation=BSB/);
  assert.equal(d.querySelector('[data-search-results] img'),null);
  const result=d.querySelector('[data-verse-result]');
  assert.match(result.textContent,/Psalm 46:10/);
  result.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(vm.runInContext('opened',context),'BSB.PSA.46.10');
  assert.equal(dialog.open,false);
 }finally{dom.window.close();}
});
