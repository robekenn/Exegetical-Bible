import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {searchPassage,setupBookSidebar} from '../book-navigation.js';
const books=[{id:'GEN',name:'Genesis',order:1,numberOfChapters:50},{id:'PSA',name:'Psalms',order:19,numberOfChapters:150},{id:'JHN',name:'John',order:43,numberOfChapters:21},{id:'ROM',name:'Romans',order:45,numberOfChapters:16},{id:'1CO',name:'1 Corinthians',order:46,numberOfChapters:16},{id:'1JN',name:'1 John',order:62,numberOfChapters:5}];
test('passage search handles abbreviations, numbered books, chapter limits and unavailable books',()=>{
 for(const [q,book,chapter,verse]of [['John 3:16','JHN',3,16],['jn3:16','JHN',3,16],['Psalm 23','PSA',23,1],['1 Cor 13:4','1CO',13,4],['First John 2:1','1JN',2,1],['Romans8','ROM',8,1]])assert.deepEqual(Object.values(searchPassage(q,books).target).slice(0,3),[book,chapter,verse]);
 assert.equal(searchPassage('John',books).target,undefined);assert.equal(searchPassage('gen',books).books[0].id,'GEN');assert.match(searchPassage('John 22',books).error,/21 chapters/);assert.match(searchPassage('John 0',books).error,/Choose 1/);assert.match(searchPassage('John 3:0',books).error,/verse number/);assert.match(searchPassage('Matthew 3',books).error,/not found/);assert.equal(searchPassage('<script>alert(1)</script>',books).books.length,0);
});
test('sidebar opens chapter choices without navigating and passage navigation requires an explicit action',async()=>{
 const dom=new JSDOM(await readFile(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.test/'});dom.window.HTMLElement.prototype.scrollIntoView=()=>{};Object.assign(globalThis,{document:dom.window.document,matchMedia:()=>({matches:false})});let destination;const state={books,book:'JHN',chapter:1,verse:1,translation:'BSB',testament:'new'};
 const sidebar=setupBookSidebar({state,esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),navigate:async(...args)=>destination=args,toast(){}});sidebar.render();
 assert.equal(document.querySelector('[data-book="GEN"]'),null);
 const input=document.getElementById('bookFilter');input.value='Psalm 23';input.dispatchEvent(new dom.window.Event('input'));assert.equal(destination,undefined);assert.equal(document.getElementById('sidebarSearchResult').textContent.includes('Psalms 23'),true);document.getElementById('sidebarSearchResult').click();assert.deepEqual(destination,['PSA',23,1]);
 document.getElementById('clearBookSearch').click();assert.equal(document.activeElement,input);input.value='Romans';input.dispatchEvent(new dom.window.Event('input'));destination=null;document.querySelector('[data-book="ROM"]').click();assert.equal(destination,null);assert.equal(document.querySelectorAll('[data-side-chapter]').length,16);document.querySelector('[data-side-chapter="8"]').click();assert.deepEqual(destination,['ROM',8,1]);
 input.value='John 999';input.dispatchEvent(new dom.window.Event('input'));assert.equal(document.getElementById('sidebarSearchResult'),null);assert.match(document.getElementById('bookSearchStatus').textContent,/21 chapters/);
 document.getElementById('sidebarCurrent').click();assert.equal(input.value,'');assert.equal(state.testament,'all');assert.equal(document.querySelector('[data-book="GEN"]')!==null,true);assert.equal(document.querySelector('[data-book="JHN"]').getAttribute('aria-expanded'),'true');dom.window.close();
});
