import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler,{validPath} from '../api/bible.js';
test('allows every supported resource type',()=>{for(const p of ['available_translations.json','available_commentaries.json','BSB/books.json','BSB/JHN/1.json','c/matthew-henry/GEN/50.json','d/bsb-interlinear/GEN/1.json','d/stepbible-lexicon/lexicon/G3056.json'])assert.equal(validPath(p),true,p);});
test('rejects arbitrary upstream access, traversal and malformed resources',()=>{for(const p of ['https://evil.test','../secret','BSB/../books.json','BSB/JHN/0.json','d/unknown/GEN/1.json','BSB/JHN/1.json?url=evil',null,[],{}])assert.equal(validPath(p),false,String(p));});
test('handler rejects writes before contacting upstream',async()=>{let code,body;const res={status(n){code=n;return this;},json(d){body=d;}};await handler({method:'POST'},res);assert.equal(code,405);assert.equal(body.error,'Method not allowed');});
test('handler returns invalid resource errors',async()=>{let code;const res={status(n){code=n;return this;},json(){}};await handler({method:'GET',query:{path:'../'}},res);assert.equal(code,400);});

test('malformed provider identifiers cannot become reader markup',async()=>{
 const {checkedBibleResource,checkedBooks}=await import('../lib/bible-metadata.js');
 const book={id:'JHN',name:'John',numberOfChapters:21};
 assert.deepEqual(checkedBooks({books:[{...book,numberOfChapters:'<b>21</b>'},book]}).books,[book]);
 const valid={type:'verse',number:1,content:['Verse']};
 const data={book,chapter:{number:1,content:[{type:'verse',number:'1"><img src=x>'},valid,{type:'verse',number:1000}]}};
 assert.deepEqual(checkedBibleResource('BSB/JHN/1.json',data).chapter.content,[valid]);
 assert.throws(()=>checkedBibleResource('BSB/JHN/1.json',{...data,chapter:{...data.chapter,number:'1'}}),{status:502});
});

test('shared provider limits return Retry-After while open translations remain available',async()=>{
 const {createBibleHandler}=await import('../api/bible.js');
 const {reserveProviderBudget}=await import('../lib/provider-budget.js');
 const requestBudget=req=>reserveProviderBudget(req,{ESV_API_KEY:'fixture',SUPABASE_URL:'https://example.test',SUPABASE_SECRET_KEY:'secret'},()=>({
  rpc(name,params){assert.equal(name,'reserve_bible_provider_budget');assert.match(params.p_client,/^[a-f0-9]{64}$/);return {abortSignal:async()=>({data:42})};}
 }));
 const handler=createBibleHandler(requestBudget);
 const original=global.fetch;
 const calls=[];
 global.fetch=async url=>{calls.push(String(url));return {ok:true,json:async()=>({books:[{id:'JHN',name:'John',numberOfChapters:21}]})};};
 try{
  let status,headers={};
  const res={setHeader(k,v){headers[k]=v;},status(n){status=n;return this;},json(){}};
  await handler({method:'GET',headers:{'x-vercel-forwarded-for':'192.0.2.1'},query:{path:'search.json',translation:'ESV',q:'faith'}},res);
  assert.equal(status,429);
  assert.equal(headers['Retry-After'],'42');
  assert.equal(calls.length,0);
  await handler({method:'GET',headers:{},query:{path:'BSB/books.json'}},res);
  assert.equal(status,200);
  assert.equal(calls.length,1);
 }finally{global.fetch=original;}
});
