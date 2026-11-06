import http from 'node:http';
import fs from 'node:fs/promises';
import handler from './api/bible.js';
import config from './api/config.js';
import feedback from './api/feedback.js';
import admin from './api/admin.js';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost');res.status=n=>{res.statusCode=n;return res;};res.json=d=>res.end(JSON.stringify(d));if(u.pathname==='/api/config')return config(req,res);if(['/api/admin','/api/feedback'].includes(u.pathname)){
 res.setHeader('Content-Type','application/json');req.query=Object.fromEntries(u.searchParams);
 if(req.method==='POST'){
  try{let body='';for await(const chunk of req){body+=chunk;if(body.length>16000)return res.status(413).json({error:'Request is too large.'});}req.body=JSON.parse(body);}
  catch{return res.status(400).json({error:'Invalid JSON.'});}
 }
 return (u.pathname==='/api/admin'?admin:feedback)(req,res);
}if(u.pathname==='/api/bible'){res.setHeader('Content-Type','application/json');req.query=Object.fromEntries(u.searchParams);return handler(req,res);}let p=['/','/auth/callback'].includes(u.pathname)?'index.html':u.pathname.slice(1);if(/^\/admin\/?$/.test(u.pathname))p='admin/index.html';if(/^\/(terms|privacy|cookies|guidelines|accessibility|contact|feedback|appeal|changelog|about|reset-password)\/?$/.test(u.pathname))p=u.pathname.replace(/^\/|\/$/g,'')+'/index.html';if(!['admin/index.html','admin/admin.js','admin/admin.css','reset-password/reset.js','reset-password/reset.css'].includes(p)&&!/^(terms|privacy|cookies|guidelines|accessibility|contact|feedback|appeal|changelog|about|reset-password)\/index.html$/.test(p)&&!['index.html','reader-entry.js','password-policy.js','app.js','style.css','account.js','sync-model.js','vendor/supabase.js','vendor/telemetry.js','community.js','community-model.js','session-options.js','mobile.js','account-avatar.js','account-access.js','polish.js','streak.js','security-model.js','account-menu.js','passage-highlights.js','foreground-scroll.js','preference-sync.js','google-auth.js','book-navigation.js','feedback.js','theme.js','404.html'].includes(p)){res.statusCode=404;res.setHeader('Content-Type','text/html');return res.end(await fs.readFile(new URL('dist/404.html',import.meta.url),'utf8'));}try{res.setHeader('Content-Type',types['.'+p.split('.').at(-1)]);res.end(await fs.readFile(new URL('dist/'+p,import.meta.url)));}catch{res.statusCode=404;res.end('Not found');}}).listen(3000,'0.0.0.0',()=>console.log('http://localhost:3000'));
