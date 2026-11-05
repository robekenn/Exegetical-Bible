import {createClient} from '@supabase/supabase-js';
import {sameOrigin} from './account.js';
import {moderationMailer} from '../lib/moderation-email.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses=['open','reviewing','resolved','dismissed'];
const categories=['abuse','bug','feedback','appeal','privacy','support','accessibility'];
const options={auth:{persistSession:false,autoRefreshToken:false}};

async function deliverNotice(db,send,id,appeal=false){
 const target=appeal?{p_report:id}:{p_ban:id};
 const {data,error}=await db.rpc(appeal?'moderation_claim_appeal_email':'moderation_claim_email',target);
 if(error||!data?.length)return 'pending';
 const notice=data[0];
 let sent=false;
 try{await send(notice);sent=true;}catch{}
 const result=await db.rpc(appeal?'moderation_finish_appeal_email':'moderation_finish_email',{...target,p_attempt:notice.attempt,p_sent:sent});
 return result.error?'pending':sent?'sent':'failed';
}

export function createAdminHandler(makeClient=createClient,env=process.env,makeMailer=moderationMailer){
 return async (req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  if(req.method==='POST'&&!sameOrigin(req))return res.status(403).json({error:'Request must come from this site'});
  const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return res.status(401).json({error:'Sign in to your Bible account first.'});
  const url=env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL;
  const key=env.SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY;
  const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key||!secret)return res.status(503).json({error:'Admin service unavailable.'});
  try{
   const {data,error}=await makeClient(url,key,options).auth.getUser(token);
   if(error||!data.user)return res.status(401).json({error:'Session expired. Sign in again.'});
   const actor=data.user.id;
   const owners=(env.ADMIN_USER_IDS||'').split(',').map(s=>s.trim().toLowerCase()).filter(s=>uuid.test(s));
   const owner=owners.includes(actor);
   const q=req.query||{};
   let db;
   let admin=owner;
   if(!owner){
    db=makeClient(url,secret,options);
    const role=await db.rpc('moderation_is_admin',{p_user:actor});
    admin=!role.error&&role.data===true;
   }
   if(req.method==='GET'&&q.access==='1')return res.status(200).json({admin});
   if(!admin)return res.status(403).json({error:'This account is not authorized for the admin portal.'});
   db??=makeClient(url,secret,options);
   if(req.method==='POST'){
    const b=req.body||{};
    if(b.action){
     const {action,target}=b;
     if(!['promote','demote','ban','lift','retry_email','decide_appeal','retry_appeal_email'].includes(action)||typeof target!=='string'||!uuid.test(target)){
      return res.status(400).json({error:'Choose a valid moderation action and target.'});
     }
     if(['promote','demote'].includes(action)&&!owner)return res.status(403).json({error:'Only owners can change admin roles.'});
     const reason=typeof b.reason==='string'?b.reason.trim():'';
     if(action==='ban'&&(b.confirmation!=='BAN'||reason.length<10||reason.length>2000)){
      return res.status(400).json({error:'Enter a reason of 10–2000 characters and type BAN to confirm account deletion.'});
     }
     if(action==='lift'&&(reason.length<10||reason.length>2000))return res.status(400).json({error:'Enter a reason of 10–2000 characters.'});
     if(['ban','promote','demote'].includes(action)&&(target.toLowerCase()===actor||owners.includes(target.toLowerCase()))){
      return res.status(403).json({error:'This account is protected.'});
     }
     const send=['ban','retry_email'].includes(action)?makeMailer(env):null;
     if(['ban','retry_email'].includes(action)&&!send){
      return res.status(503).json({error:'Configure moderation email before banning accounts or sending notices.'});
     }
     if(action==='decide_appeal'||action==='retry_appeal_email'){
      if(action==='decide_appeal'&&(!['accepted','denied'].includes(b.decision)||reason.length<10||reason.length>2000)){
       return res.status(400).json({error:'Choose a decision and enter a reason of 10–2000 characters.'});
      }
      const sendAppeal=makeMailer(env);
      if(!sendAppeal)return res.status(503).json({error:'Configure moderation email before sending appeal decisions.'});
      if(action==='decide_appeal'){
       const decision=await db.rpc('moderation_decide_appeal',{
        p_actor:actor,p_report:target,p_decision:b.decision,p_reason:reason,p_owners:owners
       });
       if(decision.error)throw decision.error;
      }
      let emailStatus;
      try{emailStatus=await deliverNotice(db,sendAppeal,target,true);}catch{emailStatus='pending';}
      return res.status(200).json({ok:true,emailStatus});
     }
     if(action==='retry_email')return res.status(200).json({emailStatus:await deliverNotice(db,send,target)});
     const change=await db.rpc('moderation_change',{
      p_actor:actor,p_target:target,p_action:action,p_reason:['ban','lift'].includes(action)?reason:null,p_owners:owners
     });
     if(change.error)throw change.error;
     let emailStatus;
     if(action==='ban'){
      // Deletion and the blacklist already committed. A mail failure must not be reported as a failed ban.
      try{emailStatus=await deliverNotice(db,send,change.data);}catch{emailStatus='pending';}
     }
     return res.status(200).json({ok:true,emailStatus});
    }
    if(!uuid.test(b.report_id||'')||!statuses.includes(b.status)||typeof b.note!=='string'||!b.note.trim()||b.note.trim().length>2000){
     return res.status(400).json({error:'Choose a report, status, and a note of 1–2000 characters.'});
    }
    const review=await db.rpc('review_community_report',{p_report:b.report_id,p_actor:actor,p_status:b.status,p_note:b.note.trim()});
    if(review.error)throw review.error;
    return res.status(200).json({ok:true});
   }
   const page=Math.min(10000,Math.max(0,Number.parseInt(q.page,10)||0));
   if(['users','bans','audit'].includes(q.view)){
    const search=typeof q.search==='string'?q.search.trim().slice(0,120):'';
    const args={p_offset:page*25};
    if(q.view==='users')Object.assign(args,{p_search:search,p_owners:owners});
    if(q.view==='bans'){
     if(q.ban&&(typeof q.ban!=='string'||!uuid.test(q.ban)))return res.status(400).json({error:'Invalid ban ID'});
     args.p_id=q.ban||null;
    }
    const result=await db.rpc('moderation_'+q.view,args);
    if(result.error)throw result.error;
    return res.status(200).json({rows:result.data.slice(0,25),hasMore:result.data.length>25,page,owner,mailConfigured:Boolean(env.MODERATION_SMTP_USER&&env.MODERATION_SMTP_PASSWORD)});
   }
   if(q.id){
    if(typeof q.id!=='string'||!uuid.test(q.id))return res.status(400).json({error:'Invalid report ID'});
    const [report,history]=await Promise.all([
     db.from('community_reports').select('*').eq('id',q.id).single(),
     db.from('report_review_events').select('*').eq('report_id',q.id).order('created_at',{ascending:false}).limit(100)
    ]);
    if(report.error||history.error)throw report.error||history.error;
    let appeal;
    if(report.data.category==='appeal'&&report.data.ban_id){
     const result=await db.rpc('moderation_appeal_status',{p_report:q.id});
     if(result.error)throw result.error;
     appeal=result.data[0]||null;
    }
    return res.status(200).json({report:report.data,history:history.data,appeal});
   }
   let query=db.from('community_reports').select('id,reporter,subject,category,details,status,created_at');
   if(q.status&&q.status!=='all'){
    if(!statuses.includes(q.status))return res.status(400).json({error:'Invalid status'});
    query=query.eq('status',q.status);
   }
   if(q.category&&q.category!=='all'){
    if(!categories.includes(q.category))return res.status(400).json({error:'Invalid report type'});
    query=q.category==='abuse'?query.or('category.eq.abuse,subject.not.is.null'):query.eq('category',q.category);
   }
   const reports=await query.order('created_at',{ascending:false}).order('id').range(page*25,page*25+24);
   if(reports.error)throw reports.error;
   return res.status(200).json({reports:reports.data,page});
  }catch(error){
   if(error.code==='42501')return res.status(403).json({error:'You do not have permission for this action.'});
   if(error.code==='P0001')return res.status(409).json({error:error.message});
   return res.status(502).json({error:'Unable to complete this request. Check the moderation database setup and retry.'});
  }
 };
}
export default createAdminHandler();
