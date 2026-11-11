import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {sessionResult,clearAccountCache} from '../security-model.js';import {readFile} from 'node:fs/promises';
test('responses from an old session cannot populate another account or signed-out UI',async()=>{let user={id:'a'},finish;const request=new Promise(r=>finish=r),result=sessionResult(request,()=>user);user={id:'b'};finish({data:{private:'secret'}});await assert.rejects(result,/Account changed/);assert.deepEqual(await sessionResult(Promise.resolve({data:[1]}),()=>user),[1]);});
test('explicit logout clears only that account cache and preserves guest/other accounts',()=>{const s=new JSDOM('',{url:'https://example.test'}).window.localStorage;for(const key of ['exegetical-user-a-notes','exegetical-user-a-streak','exegetical-user-b-notes','exegetical-notes'])s.setItem(key,'private');clearAccountCache(s,'a');assert.equal(s.getItem('exegetical-user-a-notes'),null);assert.equal(s.getItem('exegetical-user-a-streak'),null);assert.equal(s.length,2);});
test('browser policy restricts form submission, embedding and privileged device capabilities',async()=>{const v=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url))),h=Object.fromEntries(v.headers[0].headers.map(h=>[h.key,h.value]));assert.match(h['Content-Security-Policy'],/form-action 'self'/);assert.match(h['Content-Security-Policy'],/frame-ancestors 'none'/);assert.equal(h['X-Frame-Options'],'DENY');assert.match(h['Permissions-Policy'],/camera=\(\)/);assert.match(h['Strict-Transport-Security'],/max-age=31536000/);});

test('account API rejects a token for any identity other than the confirmed account',async()=>{
 const {createAccountHandler}=await import('../api/account.js');
 const first='00000000-0000-4000-8000-000000000001',second='00000000-0000-4000-8000-000000000002';
 const env={SUPABASE_URL:'https://example.test',SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-server'};
 const prior=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
 Object.assign(process.env,env);
 const deleted=[];
 const handler=createAccountHandler((url,key)=>key===env.SUPABASE_PUBLISHABLE_KEY?
  {auth:{getUser:async()=>({data:{user:{id:second}}})}}:
  {auth:{admin:{deleteUser:async id=>{deleted.push(id);return {};}}}});
 try{
  let code;
  const res={setHeader(){},status(n){code=n;return this;},json(){}};
  const req={method:'POST',headers:{origin:'https://example.test',host:'example.test',authorization:'Bearer fixture'},body:{action:'delete',confirmation:'DELETE',accountId:first}};
  await handler(req,res);
  assert.equal(code,409);
  assert.deepEqual(deleted,[]);
  await handler({...req,body:{...req.body,accountId:second}},res);
  assert.equal(code,200);
  assert.deepEqual(deleted,[second]);
 }finally{for(const [key,value]of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('profile photo conversion authenticates the request and encodes the resized JPEG as WebP',async()=>{
 const {createAccountHandler}=await import('../api/account.js');
 const {default:sharp}=await import('sharp');
 const env={SUPABASE_URL:'https://example.test',SUPABASE_PUBLISHABLE_KEY:'fixture-public'};
 const prior=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
 Object.assign(process.env,env);
 try{
  const handler=createAccountHandler(()=>({auth:{getUser:async token=>({data:{user:token==='fixture'?{id:'signed-in'}:null}})}}));
  const jpeg=await sharp({create:{width:256,height:256,channels:3,background:'#284e43'}}).jpeg().toBuffer();
  const req={method:'POST',headers:{origin:'https://example.test',host:'example.test',authorization:'Bearer invalid'},body:{action:'convert-photo',jpeg:'data:image/jpeg;base64,'+jpeg.toString('base64')}};
  let code,body;
  const res={setHeader(){},status(n){code=n;return this;},json(value){body=value;}};
  await handler(req,res);
  assert.equal(code,401);
  req.headers.authorization='Bearer fixture';
  await handler(req,res);
  assert.equal(code,200);
  assert.match(body.avatar,/^data:image\/webp;base64,/);
  const encoded=await sharp(Buffer.from(body.avatar.split(',')[1],'base64')).metadata();
  assert.deepEqual([encoded.format,encoded.width,encoded.height],['webp',256,256]);
 }finally{for(const [key,value]of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
