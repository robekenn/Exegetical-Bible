import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler,{validPath} from '../api/bible.js';
test('allows every supported resource type',()=>{for(const p of ['available_translations.json','available_commentaries.json','BSB/books.json','BSB/JHN/1.json','c/matthew-henry/GEN/50.json','d/bsb-interlinear/GEN/1.json','d/stepbible-lexicon/lexicon/G3056.json'])assert.equal(validPath(p),true,p);});
test('rejects arbitrary upstream access, traversal and malformed resources',()=>{for(const p of ['https://evil.test','../secret','BSB/../books.json','BSB/JHN/0.json','d/unknown/GEN/1.json','BSB/JHN/1.json?url=evil',null,[],{}])assert.equal(validPath(p),false,String(p));});
test('handler rejects writes before contacting upstream',async()=>{let code,body;const res={status(n){code=n;return this;},json(d){body=d;}};await handler({method:'POST'},res);assert.equal(code,405);assert.equal(body.error,'Method not allowed');});
test('handler returns invalid resource errors',async()=>{let code;const res={status(n){code=n;return this;},json(){}};await handler({method:'GET',query:{path:'../'}},res);assert.equal(code,400);});
