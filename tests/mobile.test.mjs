import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {setupMobile,setupMobileViewport} from '../mobile.js';
test('phone navigation preserves drafts, opens study, and chooses a chapter without reloading',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');const dom=new JSDOM(html,{url:'https://example.test/'});const w=dom.window;w.scrollTo=()=>{};
 Object.assign(globalThis,{window:w,document:w.document,MutationObserver:w.MutationObserver,CustomEvent:w.CustomEvent,matchMedia:()=>({matches:true,addEventListener(){}})});
 const state={book:'JHN',chapter:1,verse:2,books:[{id:'JHN',name:'John',order:43,numberOfChapters:21},{id:'GEN',name:'Genesis',order:1,numberOfChapters:50}]};let navigated,verseQuery;
 const modal=(title,html)=>{document.dispatchEvent(new w.CustomEvent('study-modal-open'));document.getElementById('modalTitle').textContent=title;document.getElementById('modalBody').innerHTML=html;document.getElementById('modal').setAttribute('open','');};
 document.getElementById('modal').close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 document.getElementById('studyBody').innerHTML='<textarea id="draft">Keep this draft</textarea>';
 setupMobile({state,modal,esc:s=>String(s),navigate:(...v)=>navigated=v,toast:()=>{},openVerseSearch:(query,root)=>{verseQuery=query;root.textContent="Verse matches";}});
 document.getElementById('mobileStudyButton').click();assert.equal(document.body.classList.contains('mobile-study-open'),true);assert.equal(document.getElementById('study').getAttribute('aria-modal'),'true');
 const grip=document.getElementById('studySwipeGrip'),sheet=document.getElementById('study');
 grip.setPointerCapture=()=>{};
 grip.onpointerdown({button:0,pointerId:1,clientY:100});
 grip.onpointermove({pointerId:1,clientY:130});
 assert.equal(sheet.style.getPropertyValue('--study-swipe'),'30px');
 grip.onpointerup({pointerId:1,clientY:130});
 assert.equal(sheet.style.getPropertyValue('--study-swipe'),'');
 assert.equal(document.body.classList.contains('mobile-study-open'),true);
 grip.onpointerdown({button:0,pointerId:2,clientY:100});
 grip.onpointerup({pointerId:2,clientY:190});
 assert.equal(document.body.classList.contains('mobile-study-open'),false);
 document.getElementById('mobileStudyButton').click();
 document.getElementById('mobileReadButton').click();assert.equal(document.body.classList.contains('mobile-study-open'),false);assert.equal(document.getElementById('draft').value,'Keep this draft');
 document.dispatchEvent(new w.CustomEvent('open-mobile-study'));assert.equal(document.body.classList.contains('mobile-study-open'),true);
 document.getElementById('mobilePassageButton').click();assert.equal(document.body.classList.contains('mobile-study-open'),false);assert.equal(document.querySelectorAll('[data-mobile-book]').length,2);
 document.getElementById('mobileBookSearch').value='gen';document.getElementById('mobileBookSearch').dispatchEvent(new w.Event('input'));assert.equal(document.querySelectorAll('[data-mobile-book]').length,1);document.querySelector('[data-mobile-book="GEN"]').click();assert.equal(document.querySelectorAll('[data-mobile-chapter]').length,50);document.querySelector('[data-mobile-chapter="3"]').click();assert.deepEqual(navigated,['GEN',3]);assert.equal(document.getElementById('draft').value,'Keep this draft');document.getElementById('mobilePassageButton').click();const search=document.getElementById('mobileBookSearch');search.value='Jn 3:16';search.dispatchEvent(new w.Event('input'));assert.match(document.getElementById('mobileSearchPassage').textContent,/John 3:16/);search.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.deepEqual(navigated,['JHN',3,16]);
 document.getElementById('mobilePassageButton').click();
 const unified=document.getElementById('mobileBookSearch');
 unified.value='be still and know';
 unified.dispatchEvent(new w.Event('input'));
 document.getElementById('submitMobileBibleSearch').click();
 assert.equal(verseQuery,'be still and know');
 assert.equal(document.getElementById('mobileBookGrid').textContent,'Verse matches');
 assert.equal(document.getElementById('mobileBookSearch'),unified);
 unified.value='John';
 unified.dispatchEvent(new w.Event('input'));
 document.getElementById('mobileBookGrid').querySelector('.passage-search-result').click();
 assert.equal(verseQuery,'John');
 unified.value='Jn 3:16–18';
 unified.dispatchEvent(new w.Event('input'));
 document.getElementById('mobileSearchPassage').click();
 assert.deepEqual(navigated,['JHN',3,16,18]);
 await new Promise(r=>setImmediate(r));dom.window.close();
});

test('desktop passage picker uses themed book and chapter controls with a current-book shortcut',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),dom=new JSDOM(html,{url:'https://example.test/'}),w=dom.window;w.scrollTo=()=>{};
 Object.assign(globalThis,{window:w,document:w.document,MutationObserver:w.MutationObserver,CustomEvent:w.CustomEvent,matchMedia:()=>({matches:false,addEventListener(){}})});
 const state={book:'JHN',chapter:2,verse:1,books:[{id:'JHN',name:'John',order:43,numberOfChapters:21}]};let navigated;
 const modal=(title,html)=>{document.getElementById('modalBody').innerHTML=html;};document.getElementById('modal').close=()=>{};
 setupMobile({state,modal,esc:s=>String(s),navigate:(...v)=>navigated=v,toast:()=>{}});
 document.getElementById('mobilePassageButton').click();document.getElementById('pickerCurrentChapter').click();
 assert.equal(document.querySelector('[data-mobile-chapter="2"]').getAttribute('aria-current'),'true');
 document.querySelector('[data-mobile-chapter="3"]').click();assert.deepEqual(navigated,['JHN',3]);assert.equal(document.getElementById('mobilePassageButton').classList.contains('mobile-only'),false);dom.window.close();
});

test('closing Study for navigation unlocks the reader before the verse jump',async()=>{
 const {setupForegroundScroll}=await import('../foreground-scroll.js');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://example.test/'}),w=dom.window,d=w.document;
 Object.assign(globalThis,{window:w,document:d,MutationObserver:w.MutationObserver,CustomEvent:w.CustomEvent,matchMedia:()=>({matches:true,addEventListener(){}})});
 const controller=setupForegroundScroll(d,w);
 const jumps=[];
 Object.defineProperty(w,'scrollY',{value:240});
 w.scrollTo=(x,y)=>jumps.push(y);
 try{
  setupMobile({state:{books:[]},modal(){},esc:String,navigate(){},toast(){},refreshForeground:controller.refresh});
  d.getElementById('mobileStudyButton').click();
  await Promise.resolve(); // Allow the overlay observer to lock the reader.
  assert.equal(d.body.style.position,'fixed');
  d.dispatchEvent(new w.Event('close-mobile-study'));
  assert.equal(d.body.style.position,'');
  assert.equal(d.getElementById('reader').inert,false);
  w.scrollTo(0,1200);
  await Promise.resolve();
  assert.deepEqual(jumps,[240,1200]);
 }finally{controller.destroy();dom.window.close();}
});

test('phone keyboard changes fit the dialog and reveal focus within its scroll container',()=>{
 const dom=new JSDOM('<dialog open><div style="overflow-y:auto"><textarea></textarea></div></dialog>');
 const {window:w}=dom,d=w.document,style=d.documentElement.style;
 const viewport=new w.EventTarget();
 Object.assign(viewport,{height:800,offsetTop:0,scale:1});
 const frames=[];
 const browser={visualViewport:viewport,innerHeight:800,requestAnimationFrame:fn=>frames.push(fn),getComputedStyle:w.getComputedStyle};
 const phone=new w.EventTarget();
 phone.matches=true;
 const field=d.querySelector('textarea'),scroller=field.parentElement;
 Object.defineProperties(scroller,{clientHeight:{value:300},scrollHeight:{value:650}});
 scroller.getBoundingClientRect=()=>({top:80,bottom:550});
 field.getBoundingClientRect=()=>({top:400-scroller.scrollTop,bottom:460-scroller.scrollTop,height:60});
 try{
  setupMobileViewport(browser,d,phone);
  frames.shift()();
  field.focus();
  viewport.height=375;
  viewport.offsetTop=25;
  viewport.dispatchEvent(new w.Event('resize'));
  viewport.dispatchEvent(new w.Event('scroll'));
  assert.equal(frames.length,1);
  frames.shift()();
  assert.equal(style.getPropertyValue('--mobile-viewport-height'),'375px');
  assert.equal(style.getPropertyValue('--mobile-viewport-top'),'25px');
  assert.equal(style.getPropertyValue('--mobile-viewport-bottom'),'400px');
  assert.equal(scroller.scrollTop,68);
  viewport.scale=1.5;
  viewport.dispatchEvent(new w.Event('resize'));
  frames.shift()();
  assert.equal(style.getPropertyValue('--mobile-viewport-height'),'');
  assert.equal(scroller.scrollTop,68);
  Object.assign(viewport,{height:800,offsetTop:0,scale:1});
  viewport.dispatchEvent(new w.Event('resize'));
  frames.shift()();
  assert.equal(style.getPropertyValue('--mobile-viewport-height'),'800px');
  assert.equal(scroller.scrollTop,68);
 }finally{dom.window.close();}
});
