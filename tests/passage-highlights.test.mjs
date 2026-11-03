import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {passageRange,setupPassageHighlights} from '../passage-highlights.js';
test('passage selection highlights a complete range in one save and leaves unrelated highlights intact',()=>{
 const d=new JSDOM('<div id="passageHighlights"></div>'+[1,2,3,4,5].map(n=>`<button data-verse="${n}"></button>`).join('')).window.document;globalThis.document=d;
 const state={book:'JHN',chapter:1,verse:1,books:[{id:'JHN',name:'John'}],data:{chapter:{content:[1,2,3,4,5].map(number=>({type:'verse',number}))}},highlights:{'JHN.1.5':true}};let saves=0,allowed=true,tools;
 tools=setupPassageHighlights({state,save:()=>saves++,renderChapter:()=>tools.decorate(),canEdit:()=>allowed,toast:()=>{}});tools.decorate();d.getElementById('togglePassageHighlights').click();assert.equal(tools.consume(4),true);tools.consume(2);assert.equal(d.querySelectorAll('.range-selected').length,3);d.getElementById('applyPassageHighlight').click();assert.equal(saves,1);assert.deepEqual(Object.keys(state.highlights).sort(),['JHN.1.2','JHN.1.3','JHN.1.4','JHN.1.5']);assert.match(d.querySelector('[data-verse="1"]').getAttribute('aria-label'),/^Study/);
 d.getElementById('togglePassageHighlights').click();tools.consume(2);tools.consume(4);d.getElementById('removePassageHighlight').click();assert.deepEqual(state.highlights,{'JHN.1.5':true});
 allowed=false;d.getElementById('togglePassageHighlights').click();d.getElementById('applyPassageHighlight').click();assert.equal(saves,2);
 state.chapter=2;tools.decorate();assert.equal(tools.consume(1),false);assert.deepEqual(passageRange([1,2,4,5],5,2),[2,4,5]);
});
