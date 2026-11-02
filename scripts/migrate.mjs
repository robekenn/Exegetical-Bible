import postgres from 'postgres';
import {verifyIsolation} from './verify-db.mjs';
import {readFile} from 'node:fs/promises';
const connection=process.env.POSTGRES_URL_NON_POOLING||process.env.POSTGRES_URL;
if(!connection)throw Error('Connect Supabase to the Vercel project before deploying account support.');
const sql=postgres(connection,{max:1,ssl:{rejectUnauthorized:true},connect_timeout:20});
try{
 await sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(731892144)`;const [exists]=await tx`select to_regclass('public.study_entries') as entries`;if(!exists.entries)await tx.unsafe(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));});
 console.log('Account database schema is ready.');
 await verifyIsolation(sql);
}finally{await sql.end();}
