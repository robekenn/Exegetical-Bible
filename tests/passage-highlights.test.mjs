import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {setupPassageHighlights} from '../passage-highlights.js';
test('simple highlight mode toggles tapped verses immediately, preserves others, and exits cleanly',()=>{
 const dom=new JSDOM('<div id="passageHighlights"></div>'+[1,2,3,4,5].map(n=>`<button data-verse="${n}"></button>`).join('')),d=dom.window.document;globalThis.document=d;
 const state={book:'JHN',chapter:1,verse:1,books:[{id:'JHN',name:'John'}],data:{chapter:{content:[1,2,3,4,5].map(number=>({type:'verse',number}))}},highlights:{'JHN.1.5':true}};let saves=0,allowed=true,tools;
 tools=setupPassageHighlights({state,save:()=>saves++,renderChapter:()=>tools.decorate(),canEdit:()=>allowed,toast:()=>{}});tools.decorate();assert.equal(tools.consume(2),false);d.getElementById('togglePassageHighlights').click();tools.consume(2);tools.consume(3);assert.equal(saves,2);assert.deepEqual(Object.keys(state.highlights).sort(),['JHN.1.2','JHN.1.3','JHN.1.5']);assert.equal(d.querySelector('[data-verse="2"]').getAttribute('aria-pressed'),'true');
 tools.consume(2);assert.deepEqual(state.highlights,{'JHN.1.3':true,'JHN.1.5':true});assert.equal(d.querySelectorAll('input').length,0);
 d.getElementById('togglePassageHighlights').click();assert.equal(tools.consume(4),false);assert.match(d.querySelector('[data-verse="1"]').getAttribute('aria-label'),/^Study/);
 allowed=false;d.getElementById('togglePassageHighlights').click();assert.equal(tools.consume(4),false);assert.equal(saves,3);allowed=true;d.getElementById('togglePassageHighlights').click();state.chapter=2;tools.decorate();assert.equal(tools.consume(1),false);dom.window.close();
});

test('the highlight button immediately applies an explicit verse or range selection',()=>{
 const dom=new JSDOM('<div id="passageHighlights"></div>'+[1,2,4,5].map(n=>`<button data-verse="${n}"></button>`).join(''));
 const d=dom.window.document;
 globalThis.document=d;
 const state={book:'JHN',chapter:1,books:[{id:'JHN',name:'John'}],data:{chapter:{content:[1,2,4,5].map(number=>({type:'verse',number}))}},highlights:{'JHN.1.2':true,'JHN.2.1':true}};
 let range=[1,1],saves=0;
 const tools=setupPassageHighlights({state,getSelectedRange:()=>range,save:()=>saves++,renderChapter:()=>tools.decorate(),canEdit:()=>true,toast(){}});
 try{
  tools.decorate();
  const click=()=>d.getElementById('togglePassageHighlights').click();
  click();
  assert.equal(state.highlights['JHN.1.1'],true);
  range=[2,4];
  click();
  assert.deepEqual(state.highlights,{'JHN.1.1':true,'JHN.1.2':true,'JHN.1.4':true,'JHN.2.1':true});
  assert.equal(saves,2);
  assert.equal(d.querySelector('[data-verse="4"]').classList.contains('highlighted'),true);
  assert.equal(d.getElementById('togglePassageHighlights').getAttribute('aria-pressed'),'false');
  click();
  assert.equal(saves,2);
  assert.equal(tools.consume(5),false);
  range=null;
  click();
  assert.equal(tools.consume(5),true);
 }finally{dom.window.close();}
});
