import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {setupChapterNavigation} from '../chapter-navigation.js';
function fixture(){
 const dom=new JSDOM('<button id="chapterPrevious"></button><button id="chapterNext"></button><div class="reading-content"><div id="chapterText"><button class="verse">Verse</button><a href="#">Source</a></div><button id="previous"></button><button id="next"></button></div><dialog></dialog>');
 const {window:w}=dom,d=w.document;w.matchMedia=()=>({matches:true,addEventListener(){}});
 let prev=0,next=0,pulses=0;d.getElementById('previous').onclick=()=>prev++;d.getElementById('next').onclick=()=>next++;w.navigator.vibrate=()=>pulses++;
 setupChapterNavigation(d,w);
 const target=d.querySelector('.verse');
 function touch(type,x,y=100,count=1,node=target){const e=new w.Event(type,{bubbles:true,cancelable:true});const t={clientX:x,clientY:y,identifier:1};Object.defineProperties(e,{touches:{value:type==='touchend'?[]:Array(count).fill(t)},changedTouches:{value:[t]}});node.dispatchEvent(e);return e;}
 return {d,w,touch,get counts(){return [prev,next,pulses];}};
}
test('toolbar controls mirror loading and boundaries and use existing chapter handlers',async()=>{
 const f=fixture();f.d.getElementById('chapterNext').click();assert.deepEqual(f.counts,[0,1,0]);
 f.d.getElementById('previous').disabled=true;await Promise.resolve();assert.equal(f.d.getElementById('chapterPrevious').disabled,true);f.d.getElementById('chapterPrevious').click();assert.equal(f.counts[0],0);
 f.d.getElementById('previous').disabled=false;await Promise.resolve();f.d.getElementById('chapterPrevious').click();assert.equal(f.counts[0],1);
});
test('left and right pulls commit once on release with optional haptics',()=>{
 const f=fixture();f.touch('touchstart',220);f.touch('touchmove',120);assert.deepEqual(f.counts,[0,0,1]);f.touch('touchend',120);assert.deepEqual(f.counts,[0,1,1]);
 f.touch('touchstart',120);f.touch('touchmove',230);f.touch('touchend',230);assert.deepEqual(f.counts,[1,1,2]);assert.equal(f.d.querySelector('.chapter-swipe-cue'),null);
});
test('short pulls, vertical scroll, edge gestures and multi-touch never turn a chapter',()=>{
 for(const run of [f=>{f.touch('touchstart',220);f.touch('touchmove',180);f.touch('touchend',180);},f=>{f.touch('touchstart',220);assert.equal(f.touch('touchmove',210,150).defaultPrevented,false);f.touch('touchmove',80,160);f.touch('touchend',80);},f=>{f.touch('touchstart',10);f.touch('touchmove',150);f.touch('touchend',150);},f=>{f.touch('touchstart',220);f.touch('touchmove',100,100,2);f.touch('touchend',100);}]){const f=fixture();run(f);assert.deepEqual(f.counts,[0,0,0]);}
});
test('cancel, reversed pull, loading, boundary, modal, study and text selection are safe',()=>{
 for(const mode of ['cancel','reverse','loading','boundary','dialog','study','selection']){
  const f=fixture();if(mode==='loading')f.d.getElementById('chapterText').setAttribute('aria-busy','true');if(mode==='boundary')f.d.getElementById('next').disabled=true;if(mode==='dialog')f.d.querySelector('dialog').setAttribute('open','');if(mode==='study')f.d.body.classList.add('mobile-study-open');if(mode==='selection')f.w.getSelection=()=>({toString:()=> 'Verse'});
  f.touch('touchstart',220);f.touch('touchmove',100);if(mode==='cancel')f.touch('touchcancel',100);if(mode==='reverse')f.touch('touchmove',210);f.touch('touchend',100);assert.equal(f.counts[1],0,mode);
 }
});
test('tap clicks remain intact; horizontal gesture clicks are suppressed',()=>{
 const f=fixture();let clicks=0;f.d.querySelector('.verse').onclick=()=>clicks++;
 f.touch('touchstart',220);f.touch('touchend',220);f.d.querySelector('.verse').click();assert.equal(clicks,1);
 f.touch('touchstart',220);f.touch('touchmove',100);f.touch('touchend',100);f.d.querySelector('.verse').click();assert.equal(clicks,1);
});
test('absent haptic support degrades gracefully',()=>{
 const f=fixture();delete f.w.navigator.vibrate;f.touch('touchstart',220);f.touch('touchmove',100);f.touch('touchend',100);assert.equal(f.counts[1],1);
});

test('desktop touch gestures do not navigate',()=>{
 // A fresh fixture with a desktop media query.
 const dom=new JSDOM('<div class="reading-content"><div id="chapterText">Verse</div></div><button id="previous"></button><button id="next"></button>');
 dom.window.matchMedia=()=>({matches:false,addEventListener(){}});let turns=0;dom.window.document.getElementById('next').onclick=()=>turns++;setupChapterNavigation(dom.window.document,dom.window);
 for(const [type,x] of [['touchstart',220],['touchmove',100],['touchend',100]]){const e=new dom.window.Event(type,{bubbles:true});const touch={identifier:1,clientX:x,clientY:100};Object.defineProperties(e,{touches:{value:type==='touchend'?[]:[touch]},changedTouches:{value:[touch]}});dom.window.document.getElementById('chapterText').dispatchEvent(e);}
 assert.equal(turns,0);
});
