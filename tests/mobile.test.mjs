import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {setupMobile} from '../mobile.js';
test('phone navigation preserves drafts, opens study, and chooses a chapter without reloading',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');const dom=new JSDOM(html,{url:'https://example.test/'});const w=dom.window;w.scrollTo=()=>{};
 Object.assign(globalThis,{window:w,document:w.document,MutationObserver:w.MutationObserver,CustomEvent:w.CustomEvent,matchMedia:()=>({matches:true,addEventListener(){}})});
 const state={book:'JHN',chapter:1,verse:2,books:[{id:'JHN',name:'John',order:43,numberOfChapters:21},{id:'GEN',name:'Genesis',order:1,numberOfChapters:50}]};let navigated;
 const modal=(title,html)=>{document.dispatchEvent(new w.CustomEvent('study-modal-open'));document.getElementById('modalTitle').textContent=title;document.getElementById('modalBody').innerHTML=html;document.getElementById('modal').setAttribute('open','');};
 document.getElementById('modal').close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 document.getElementById('studyBody').innerHTML='<textarea id="draft">Keep this draft</textarea>';
 setupMobile({state,modal,esc:s=>String(s),navigate:(...v)=>navigated=v,toast:()=>{}});
 document.getElementById('mobileStudyButton').click();assert.equal(document.body.classList.contains('mobile-study-open'),true);assert.equal(document.getElementById('study').getAttribute('aria-modal'),'true');
 document.getElementById('mobileReadButton').click();assert.equal(document.body.classList.contains('mobile-study-open'),false);assert.equal(document.getElementById('draft').value,'Keep this draft');
 document.dispatchEvent(new w.CustomEvent('open-mobile-study'));assert.equal(document.body.classList.contains('mobile-study-open'),true);
 document.getElementById('mobilePassageButton').click();assert.equal(document.body.classList.contains('mobile-study-open'),false);assert.equal(document.querySelectorAll('[data-mobile-book]').length,2);
 document.getElementById('mobileBookSearch').value='gen';document.getElementById('mobileBookSearch').dispatchEvent(new w.Event('input'));assert.equal(document.querySelectorAll('[data-mobile-book]').length,1);document.querySelector('[data-mobile-book="GEN"]').click();assert.equal(document.querySelectorAll('[data-mobile-chapter]').length,50);document.querySelector('[data-mobile-chapter="3"]').click();assert.deepEqual(navigated,['GEN',3]);assert.equal(document.getElementById('draft').value,'Keep this draft');dom.window.close();
});
