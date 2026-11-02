import {randomUUID} from 'node:crypto';
export async function verifyIsolation(sql){
 const rollback=Error('Rollback verification fixtures');const a=randomUUID(),b=randomUUID();
 try{await sql.begin(async tx=>{
  await tx`insert into auth.users(id) values(${a}),(${b})`;
  await tx`insert into public.study_entries(user_id,passage,payload) values(${a},'JHN.1.1','{}'::jsonb),(${b},'GEN.1.1','{}'::jsonb)`;
  await tx`set local role authenticated`;
  await tx`select set_config('request.jwt.claim.sub',${a},true)`;
  const rows=await tx`select user_id from public.study_entries`;
  if(rows.length!==1||rows[0].user_id!==a)throw Error('Account isolation failed: records leaked across users.');
  const denied=await tx`update public.study_entries set payload='{}'::jsonb where user_id=${b} returning user_id`;
  if(denied.length)throw Error('Account isolation failed: another user record was writable.');
  const [saved]=await tx`select * from public.save_study_entry('JHN.1.2','{"text":"verification"}'::jsonb,0)`;
  if(saved.user_id!==a||Number(saved.revision)!==1)throw Error('Account save ownership failed.');
  const [updated]=await tx`select * from public.save_study_entry('JHN.1.2','{"text":"updated"}'::jsonb,1)`;
  if(Number(updated.revision)!==2)throw Error('Account revisions failed.');
  await tx`reset role`;
  const [grants]=await tx`select has_table_privilege('anon','public.study_entries','SELECT') as can_read, has_function_privilege('anon','public.save_study_entry(text,jsonb,bigint)','EXECUTE') as can_write`;
  if(grants.can_read||grants.can_write)throw Error('Anonymous users have access to account notes.');
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 console.log('Verified owner-only reads, writes, revisions and anonymous access denial; fixtures rolled back.');
}
