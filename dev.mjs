import http from 'node:http';
import fs from 'node:fs/promises';
import handler from './api/bible.js';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost');res.status=n=>{res.statusCode=n;return res;};res.json=d=>res.end(JSON.stringify(d));if(u.pathname==='/api/bible'){res.setHeader('Content-Type','application/json');req.query=Object.fromEntries(u.searchParams);return handler(req,res);}const p=u.pathname==='/'?'index.html':u.pathname.slice(1);if(!['index.html','app.js','style.css'].includes(p)){res.statusCode=404;return res.end('Not found');}try{res.setHeader('Content-Type',types['.'+p.split('.').at(-1)]);res.end(await fs.readFile(new URL(p,import.meta.url)));}catch{res.statusCode=404;res.end('Not found');}}).listen(3000,'0.0.0.0',()=>console.log('http://localhost:3000'));
