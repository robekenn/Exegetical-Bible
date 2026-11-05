import test from 'node:test';
import assert from 'node:assert/strict';
import {createFeedbackHandler} from '../api/feedback.js';

test('feedback accepts guest submissions and token-based appeals through a private, same-origin endpoint',async()=>{
 const calls=[];
 let result='ok';
 const handler=createFeedbackHandler((_,key)=>key==='public'?{auth:{getUser:async()=>({data:{user:{id:'verified'}}})}}:{
  rpc:async(name,body)=>{calls.push({name,body});return {data:result};}
 },{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SECRET_KEY:'fixture'});
 const origin={origin:'https://example.test',host:'example.test','x-vercel-forwarded-for':'192.0.2.10'};
 async function submit(body,headers=origin){
  const output={};
  await handler({method:'POST',headers,body},{
   setHeader(name,value){output[name]=value;},
   status(code){output.code=code;return this;},
   json(value){output.data=value;}
  });
  return output;
 }
 assert.equal((await submit({category:'bug',details:'Synthetic report'},{...origin,origin:'https://other.test'})).code,403);
 assert.equal((await submit({category:'abuse',details:'Synthetic report'})).code,400);
 const guest=await submit({category:'bug',details:'Synthetic report',reporter:'forged'});
 assert.equal(guest.code,201);
 assert.equal(guest['Cache-Control'],'private, no-store');
 assert.equal(calls[0].body.p_actor,null);
 assert.match(calls[0].body.p_bucket,/^guest:[a-f0-9]{64}$/);
 await submit({category:'feedback',details:'Synthetic report'},{...origin,authorization:'Bearer fixture'});
 assert.equal(calls[1].body.p_actor,'verified');
 const token='11111111-1111-4111-8111-111111111111';
 result='duplicate';
 const appeal=await submit({category:'appeal',details:'Synthetic appeal',token});
 assert.equal(appeal.code,409);
 assert.equal(calls[2].body.p_token,token);
 assert.equal(calls[2].body.p_actor,null);
 assert.equal(JSON.stringify(appeal.data).includes(token),false);
});
