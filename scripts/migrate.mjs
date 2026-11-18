import postgres from 'postgres';
import {readFile} from 'node:fs/promises';
const connection=process.env.POSTGRES_URL_NON_POOLING||process.env.POSTGRES_URL;
if(!connection)throw Error('Connect Supabase to the Vercel project before deploying account support.');
const ca=await readFile(new URL('../db/supabase-ca.crt',import.meta.url),'utf8');
const sql=postgres(connection,{max:1,prepare:false,ssl:{rejectUnauthorized:true,ca},connect_timeout:20});
try{
 await sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(731892144)`;const [exists]=await tx`select to_regclass('public.study_entries') as entries`;if(!exists.entries)await tx.unsafe(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));});
 await sql.begin(async tx=>{await tx`select pg_advisory_xact_lock(731892144)`;const [exists]=await tx`select to_regclass('public.reading_plan_studies') as plans`;if(!exists.plans)await tx.unsafe(await readFile(new URL('../supabase/migrations/20261118221916_reading_plans_foundation.sql',import.meta.url),'utf8'));await tx.unsafe(await readFile(new URL('../supabase/migrations/20261118224232_reading_plan_lookup_indexes.sql',import.meta.url),'utf8'));});
 console.log('Account and reading plan database schemas are ready.');
}finally{await sql.end();}
