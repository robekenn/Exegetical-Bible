import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBibleHTML,apiBibleResource} from '../lib/api-bible.js';
import handler from '../api/bible.js';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const id='aaaaaaaaaaaaaaaa-01';
test('provider HTML becomes safe plain verses with headings and poetry',()=>{
 assert.deepEqual(parseBibleHTML('<p class="s1">Synthetic heading</p><p><span class="v" data-number="1">1</span>First <em>fixture</em><span class="f">omit note</span><script>omit script</script></p><p>second line<span class="v" data-number="2">2</span>&lt;img src=x&gt; text</p>'),[{type:'heading',content:['Synthetic heading']},{type:'verse',number:1,content:['First fixture\nsecond line']},{type:'verse',number:2,content:['<img src=x> text']}]);
});
test('API.Bible catalog and restricted chapter route preserve attribution, reporting and server-only authentication',async()=>{
 const originalFetch=global.fetch;const originalKey=process.env.API_BIBLE_KEY;delete process.env.API_BIBLE_KEY;await assert.rejects(apiBibleResource('available_api_bible.json'),{status:503});process.env.API_BIBLE_KEY='synthetic-secret';let calls=[];
 global.fetch=async(url,options)=>{calls.push(String(url));assert.equal(options.headers['api-key'],'synthetic-secret');return {ok:true,json:async()=>String(url).includes('/chapters/')?{data:{content:'<p><span class="v" data-number="1">1</span>Synthetic fixture.</p>',copyright:'Fixture copyright'},meta:{fumsToken:'synthetic-view-token'}}:String(url).includes('/books?')?{data:[{id:'JHN',name:'John',chapters:[{number:'intro'},{number:'1'}]}]}:{data:[{id,name:'Fixture Bible',abbreviation:'FIX',language:{id:'eng',name:'English',scriptDirection:'ltr'}}]}};};
 try{
  const catalog=await apiBibleResource('available_api_bible.json');assert.equal(catalog.translations[0].id,'AB_'+id);assert.doesNotMatch(JSON.stringify(catalog),/synthetic-secret/);
  const books=await apiBibleResource(`AB_${id}/books.json`);assert.equal(books.books[0].numberOfChapters,1);
  const chapter=await apiBibleResource(`AB_${id}/JHN/1.json`);assert.equal(chapter.translation.licenseNotice,'Fixture copyright');assert.equal(chapter.fumsToken,'synthetic-view-token');assert.equal(chapter.chapter.content[0].content[0],'Synthetic fixture.');
  const before=calls.length;await assert.rejects(apiBibleResource('AB_bbbbbbbbbbbbbbbb-01/JHN/1.json'),{status:404});assert.equal(calls.length,before);
  await assert.rejects(apiBibleResource(`AB_${id}/JHN/2.json`),{status:404});assert.equal(calls.filter(x=>x.includes('/chapters/')).length,1);
  let headers={},body,status;await handler({method:'GET',query:{path:`AB_${id}/JHN/1.json`}},{setHeader(k,v){headers[k]=v;},status(s){status=s;return this;},json(d){body=d;}});assert.equal(status,200);assert.equal(headers['Cache-Control'],'private, no-store');assert.equal(body.fumsToken,'synthetic-view-token');
  process.env.API_BIBLE_KEY='rejected-fixture';global.fetch=async()=>({ok:false,status:403});await assert.rejects(apiBibleResource('available_api_bible.json'),e=>e.status===503&&!e.message.includes('rejected-fixture'));
  delete process.env.API_BIBLE_KEY;await assert.rejects(apiBibleResource('available_api_bible.json'),{status:503});
 }finally{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.API_BIBLE_KEY;else process.env.API_BIBLE_KEY=originalKey;}
});
test('translation picker searches provider abbreviations, filters languages and escapes titles; view reports only displayed content',async()=>{
 const dom=new JSDOM(await readFile(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.test/',runScripts:'outside-only'});const context=dom.getInternalVMContext(),d=dom.window.document;d.getElementById('modal').showModal=()=>{};
 let code=await readFile(new URL('../app.js',import.meta.url),'utf8');code=code.replace(/^import .*;\n/gm,'');code=code.slice(0,code.lastIndexOf('start().catch'));vm.runInContext(code,context);
 vm.runInContext(`state.translations=[{id:'AB_${id}',shortName:'FIX',name:'<img src=x>',englishName:'Fixture Bible',language:'eng',languageEnglishName:'English',provider:'API.Bible'},{id:'OTHER',name:'Other Bible',language:'spa',languageEnglishName:'Spanish'}];`,context);
 d.getElementById('translationButton').click();assert.equal(d.querySelectorAll('.translation-option').length,2);const search=d.getElementById('translationSearch');search.value='FIX';search.dispatchEvent(new dom.window.Event('input'));assert.equal(d.querySelectorAll('.translation-option').length,1);assert.equal(d.querySelector('#translationList img'),null);
 search.value='';search.dispatchEvent(new dom.window.Event('input'));const language=d.getElementById('translationLanguage');language.value='spa';language.dispatchEvent(new dom.window.Event('change'));assert.equal(d.querySelectorAll('.translation-option').length,1);assert.match(d.getElementById('translationList').textContent,/Other Bible/);
 vm.runInContext(`reportBibleView({});`,context);assert.equal(d.getElementById('apiBibleTracker'),null);vm.runInContext(`reportBibleView({fumsToken:'fixture'});reportBibleView({fumsToken:'second'});`,context);assert.equal(d.querySelectorAll('#apiBibleTracker').length,1);assert.equal(dom.window.fumsData.length,2);dom.window.close();
});
