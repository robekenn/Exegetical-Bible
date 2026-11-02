import {createClient} from '@supabase/supabase-js';
export function sameOrigin(req){try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!sameOrigin(req))return res.status(403).json({error:'Request must come from this site'});
 if(req.body?.action!=='delete'||req.body?.confirmation!=='DELETE')return res.status(400).json({error:'Explicit account deletion confirmation required'});
 const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)return res.status(401).json({error:'Sign in required'});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,publicKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!publicKey||!secret)return res.status(503).json({error:'Account service unavailable'});
 try{const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await auth.auth.getUser(token);if(error||!data.user)return res.status(401).json({error:'Session expired. Sign in again.'});
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});const deleted=await admin.auth.admin.deleteUser(data.user.id);if(deleted.error)throw deleted.error;
 return res.status(200).json({ok:true});}catch{return res.status(502).json({error:'Unable to delete the account. Please try again.'});}
}
