import {test} from 'node:test';
import assert from 'node:assert/strict';
import {payloadFor,recordsToState,validatePayload} from '../sync-model.js';
import {parseESV,esvChapter} from '../lib/esv.js';
import config from '../api/config.js';
test('empty notes retain highlight and deletion records for synchronization',()=>{const p=payloadFor('JHN.1.1',{}, {'JHN.1.1':true});assert.equal(p.text,'');assert.equal(p.highlighted,true);assert.equal(validatePayload('JHN.1.1',p),true);const restored=recordsToState([{passage:'JHN.1.1',payload:p}]);assert.deepEqual(restored.notes,{});assert.equal(restored.highlights['JHN.1.1'],true);});
test('malformed remote records cannot redirect notes to another passage',()=>{const p=payloadFor('JHN.1.1',{},{});assert.equal(validatePayload('GEN.1.1',p),false);assert.deepEqual(recordsToState([{passage:'GEN.1.1',payload:p}]),{notes:{},highlights:{}});});
test('ESV parser preserves words and poetic line breaks without fabricated verses',()=>{assert.deepEqual(parseESV('[1] First line.\nSecond line.\n\n[3] Third verse.'),[{type:'verse',number:1,content:['First line.\nSecond line.']},{type:'verse',number:3,content:['Third verse.']}]);});
test('ESV fails explicitly without a configured key',async()=>{const old=process.env.ESV_API_KEY;delete process.env.ESV_API_KEY;try{await assert.rejects(esvChapter({name:'John'},1),/Crossway API key/);}finally{if(old)process.env.ESV_API_KEY=old;}});
test('configuration endpoint does not expose privileged Supabase credentials',()=>{process.env.SUPABASE_SECRET_KEY='server-only-secret';process.env.SUPABASE_SERVICE_ROLE_KEY='service-only-secret';let data;config({}, {setHeader(){},status(){return this;},json(d){data=d;}});assert.equal(JSON.stringify(data).includes('server-only'),false);assert.equal(JSON.stringify(data).includes('service-only'),false);delete process.env.SUPABASE_SECRET_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;});

test('note and highlight tags round trip independently through the same private sync record',()=>{
 const key='JHN.1.1',timestamp='2026-11-16T12:00:00.000Z';
 const note={book:'JHN',bookName:'John',chapter:1,verse:1,text:'Private note',tags:['Application'],updatedAt:timestamp};
 const highlight={tags:['Encouragement'],updatedAt:timestamp};
 const payload=payloadFor(key,{[key]:note},{[key]:highlight});
 assert.equal(validatePayload(key,payload),true);
 assert.deepEqual(recordsToState([{passage:key,payload}]),{notes:{[key]:note},highlights:{[key]:highlight}});
 assert.deepEqual(recordsToState([{passage:key,payload:payloadFor(key,{}, {[key]:highlight})}]).highlights,{[key]:highlight});
 assert.deepEqual(recordsToState([{passage:key,payload:payloadFor(key,{[key]:note},{})}]).highlights,{});
 assert.equal(validatePayload(key,{...payload,tags:['App','app']}),false);
 assert.equal(validatePayload(key,{...payload,highlighted:false}),false);
});
