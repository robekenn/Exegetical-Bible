import postgres from 'postgres';
import {readFile} from 'node:fs/promises';

const ref=process.argv[2];
const authUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
const connection=process.env.POSTGRES_URL_NON_POOLING||process.env.POSTGRES_URL;
if(!/^[a-z0-9]{20}$/.test(ref||'')||!authUrl||new URL(authUrl).hostname!==ref+'.supabase.co'||!connection){
 throw Error('Supply the expected Supabase project reference and the matching database environment.');
}
// Direct Supabase URLs identify the project in the host. Pooler URLs put it in the username.
const dbUrl=new URL(connection);
if(dbUrl.hostname!=='db.'+ref+'.supabase.co'&&decodeURIComponent(dbUrl.username)!=='postgres.'+ref){
 throw Error('The database URL does not belong to the expected Supabase project.');
}
const ca=await readFile(new URL('../db/supabase-ca.crt',import.meta.url),'utf8');
const sql=postgres(connection,{max:1,prepare:false,ssl:{rejectUnauthorized:true,ca},connect_timeout:20});
try{
 const migration=await readFile(new URL('../db/study-messaging.sql',import.meta.url),'utf8');
 await sql.unsafe(migration);
 const [result]=await sql`select to_regprocedure('public.send_study_message(uuid,uuid,uuid,text,jsonb)') is not null as ready`;
 if(!result.ready)throw Error('Messaging schema was not detected after migration.');
 console.log('Study messaging migration applied.');
}catch(error){
 console.error('Study messaging migration failed.',error.code||'Database connection error');
 process.exitCode=1;
}finally{await sql.end({timeout:5});}
