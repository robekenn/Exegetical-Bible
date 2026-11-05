import {createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {sameOrigin} from './account.js';

const appealToken=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function createFeedbackHandler(makeClient=createClient,env=process.env){
 return async (req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!sameOrigin(req))return res.status(403).json({error:'Request must come from this site.'});
  const {category,details,token}=req.body||{};
  const message=typeof details==='string'?details.trim():'';
  if(!['bug','feedback','appeal'].includes(category)||message.length<10||message.length>3000||
   (category==='appeal'&&(typeof token!=='string'||!appealToken.test(token)))){
   return res.status(400).json({error:'Choose a valid request and enter 10–3000 characters.'});
  }
  const url=env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL;
  const key=env.SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY;
  const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key||!secret)return res.status(503).json({error:'Submissions are temporarily unavailable.'});
  try{
   const options={auth:{persistSession:false,autoRefreshToken:false}};
   let actor=null;
   if(category!=='appeal'&&req.headers.authorization){
    const bearer=req.headers.authorization.match(/^Bearer (.+)$/)?.[1];
    if(!bearer)return res.status(401).json({error:'Refresh your session and try again.'});
    const {data,error}=await makeClient(url,key,options).auth.getUser(bearer);
    if(error||!data.user)return res.status(401).json({error:'Refresh your session and try again.'});
    actor=data.user.id;
   }
   const ip=String(req.headers['x-vercel-forwarded-for']||'unknown').split(',')[0].trim();
   const bucket=actor?'user:'+actor:'guest:'+createHmac('sha256',secret).update(ip).digest('hex');
   const db=makeClient(url,secret,options);
   const {data,error}=await db.rpc('moderation_submit',{
    p_actor:actor,p_bucket:bucket,p_category:category,p_details:message,p_token:category==='appeal'?token:null
   });
   if(error)throw error;
   if(data==='limited')return res.status(429).json({error:'Daily submission limit reached. Try again tomorrow.'});
   if(data==='invalid_appeal')return res.status(404).json({error:'This appeal link is unavailable.'});
   if(data==='duplicate')return res.status(409).json({error:'An appeal has already been submitted for this ban.'});
   if(data!=='ok')return res.status(400).json({error:'The submission could not be accepted.'});
   return res.status(201).json({ok:true});
  }catch{
   return res.status(503).json({error:'Submissions are temporarily unavailable. Try again later.'});
  }
 };
}
export default createFeedbackHandler();
