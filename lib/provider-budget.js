import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {createClient} from '@supabase/supabase-js';

export function reserveProviderBudget(req,env=process.env,makeClient=createClient){
 return async (provider,cost=1)=>{
  const key=provider==='esv'?env.ESV_API_KEY:env.API_BIBLE_KEY;
  if(!key)return; // The provider adapter returns its usual configuration error.
  const url=env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
  const daily=Number(provider==='esv'?env.ESV_DAILY_BUDGET??2400:env.API_BIBLE_DAILY_BUDGET??4000);
  const unavailable=()=>Object.assign(Error('Translation protection is temporarily unavailable. Try an open translation or retry shortly.'),{status:503,retryAfter:60});
  if(!url||!secret||!Number.isInteger(daily)||daily<1||daily>4000)throw unavailable();
  const address=String(req.headers?.['x-vercel-forwarded-for']||'').split(',')[0].trim();
  const client=createHmac('sha256',secret).update(isIP(address)?address:'unidentified').digest('hex');
  let result;
  try{
   const db=makeClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
   result=await db.rpc('reserve_bible_provider_budget',{p_provider:provider,p_client:client,p_cost:cost,p_daily_limit:daily}).abortSignal(AbortSignal.timeout(4000));
  }catch{throw unavailable();}
  if(result.error||!Number.isInteger(result.data)||result.data<0)throw unavailable();
  if(result.data>0)throw Object.assign(Error('This translation’s request limit was reached. Try again later or choose an open translation.'),{status:429,retryAfter:result.data});
 };
}
