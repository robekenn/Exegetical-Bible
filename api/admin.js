import {createClient} from '@supabase/supabase-js';
import {sameOrigin} from './account.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createAdminHandler(makeClient=createClient,env=process.env){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 if(req.method==='POST'&&!sameOrigin(req))return res.status(403).json({error:'Request must come from this site'});
 const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)return res.status(401).json({error:'Sign in to your Bible account first.'});
 const url=env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY,secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!secret)return res.status(503).json({error:'Admin service unavailable.'});
 try{
 const auth=makeClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await auth.auth.getUser(token);
 if(error||!data.user)return res.status(401).json({error:'Session expired. Sign in again.'});
 const allowed=(env.ADMIN_USER_IDS||'').split(',').map(s=>s.trim()).filter(s=>uuid.test(s));
 if(!allowed.includes(data.user.id))return res.status(403).json({error:'This account is not authorized for the admin portal.'});
 const db=makeClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 if(req.method==='POST'){
 const b=req.body||{};if(!uuid.test(b.report_id||'')||!['open','reviewing','resolved','dismissed'].includes(b.status)||typeof b.note!=='string'||!b.note.trim()||b.note.trim().length>2000)return res.status(400).json({error:'Choose a report, status, and a note of 1–2000 characters.'});
 const r=await db.rpc('review_community_report',{p_report:b.report_id,p_actor:data.user.id,p_status:b.status,p_note:b.note.trim()});if(r.error)throw r.error;return res.status(200).json({ok:true});
 }
 const q=req.query||{};
 if(q.id){if(!uuid.test(q.id))return res.status(400).json({error:'Invalid report ID'});const [r,h]=await Promise.all([db.from('community_reports').select('*').eq('id',q.id).single(),db.from('report_review_events').select('*').eq('report_id',q.id).order('created_at',{ascending:false}).limit(100)]);if(r.error||h.error)throw r.error||h.error;return res.status(200).json({report:r.data,history:h.data});}
 const page=Math.min(10000,Math.max(0,Number.parseInt(q.page,10)||0));let query=db.from('community_reports').select('id,reporter,subject,category,details,status,created_at');
 if(q.status&&q.status!=='all'){if(!['open','reviewing','resolved','dismissed'].includes(q.status))return res.status(400).json({error:'Invalid status'});query=query.eq('status',q.status);}
 const r=await query.order('created_at',{ascending:false}).order('id').range(page*25,page*25+24);if(r.error)throw r.error;return res.status(200).json({reports:r.data,page});
 }catch{return res.status(502).json({error:'Unable to load or save reports. Confirm db/admin.sql has been applied, then retry.'});}
};}
export default createAdminHandler();
