import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseESVHTML,esvChapter} from '../lib/esv.js';
test('ESV headings stay in order and never bleed into verses or execute upstream HTML',()=>{
 const content=parseESVHTML('<h3>First &amp; foremost</h3><p><b class="verse-num">1 </b>First <i>verse</i>.<br>Poetry line.</p><h3>Another section</h3><p><b class="verse-num">2 </b>Second verse.<script>bad()</script><b class="verse-num">3 </b>Third.</p>');
 assert.deepEqual(content,[{type:'heading',content:['First & foremost']},{type:'verse',number:1,content:['First verse.\nPoetry line.']},{type:'heading',content:['Another section']},{type:'verse',number:2,content:['Second verse.']},{type:'verse',number:3,content:['Third.']}]);
 assert.deepEqual(parseESVHTML('<p><b class="verse-num">4 </b>A passage without a title.</p>'),[{type:'verse',number:4,content:['A passage without a title.']}]);
});
test('ESV request explicitly enables official section headings and parses structured response',async()=>{
 const original=globalThis.fetch,key=process.env.ESV_API_KEY;process.env.ESV_API_KEY='test';
 try{globalThis.fetch=async url=>{assert.equal(url.pathname,'/v3/passage/html/');assert.equal(url.searchParams.get('include-headings'),'true');assert.equal(url.searchParams.get('include-chapter-numbers'),'false');return {ok:true,json:async()=>({passages:['<h3>Section title</h3><p><b class="verse-num">1 </b>Verse text.</p>']})};};const d=await esvChapter({name:'John',id:'JHN'},1);assert.equal(d.chapter.content[0].type,'heading');assert.equal(d.chapter.content[1].number,1);
 }finally{globalThis.fetch=original;if(key===undefined)delete process.env.ESV_API_KEY;else process.env.ESV_API_KEY=key;}
});
