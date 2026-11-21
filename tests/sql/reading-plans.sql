-- Disposable fixtures; the transaction always rolls back.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000131','plans-first@example.test'),
 ('00000000-0000-4000-8000-000000000132','plans-second@example.test'),
 ('00000000-0000-4000-8000-000000000133','plans-third@example.test');
insert into beta_private.testers(user_id) values ('00000000-0000-4000-8000-000000000131'),('00000000-0000-4000-8000-000000000132'),('00000000-0000-4000-8000-000000000133');
insert into public.reading_plan_studies(id,author_id) values('private-draft','00000000-0000-4000-8000-000000000131');
insert into public.reading_plan_versions(id,study_id,version,content,session_count) values('private-draft-v1','private-draft',1,'{}',1),('mark-draft-v2','mark',2,'{}',1);
insert into public.reading_plan_runs(id,version_id,owner_id,mode,starts_at,timezone) values
 ('00000000-0000-4000-8000-000000000141','mark-v1','00000000-0000-4000-8000-000000000131','group',null,'UTC'),
 ('00000000-0000-4000-8000-000000000142','mark-v1','00000000-0000-4000-8000-000000000132','group',null,'UTC'),
 ('00000000-0000-4000-8000-000000000143','mark-v1','00000000-0000-4000-8000-000000000131','community',now()-interval '12 hours','America/Los_Angeles');
insert into public.reading_plan_members(run_id,user_id,role) values
 ('00000000-0000-4000-8000-000000000141','00000000-0000-4000-8000-000000000131','leader'),
 ('00000000-0000-4000-8000-000000000142','00000000-0000-4000-8000-000000000132','leader'),
 ('00000000-0000-4000-8000-000000000143','00000000-0000-4000-8000-000000000131','leader'),
 ('00000000-0000-4000-8000-000000000143','00000000-0000-4000-8000-000000000132','participant');
insert into public.reading_plan_responses(run_id,version_id,user_id,session_number,body) values
 ('00000000-0000-4000-8000-000000000141','mark-v1','00000000-0000-4000-8000-000000000131',1,'First group only'),
 ('00000000-0000-4000-8000-000000000142','mark-v1','00000000-0000-4000-8000-000000000132',1,'Second group only'),
 ('00000000-0000-4000-8000-000000000143','mark-v1','00000000-0000-4000-8000-000000000131',1,'Released community response'),
 ('00000000-0000-4000-8000-000000000143','mark-v1','00000000-0000-4000-8000-000000000131',2,'Unreleased community response');
set local role anon;
do $$begin
 if (select count(*) from public.reading_plan_versions)<>0 then raise exception 'Beta version leaked publicly'; end if;
 begin perform public.start_personal_reading_plan('mark-v1');raise exception 'Anonymous run creation allowed';exception when insufficient_privilege then null;end;
 begin perform public.set_personal_reading_plan_active('00000000-0000-4000-8000-000000000141',false,0);raise exception 'Anonymous quit allowed';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000131',true);
do $$declare run uuid; other uuid;begin
 if (select count(*) from public.reading_plan_versions where id='private-draft-v1')<>1 then raise exception 'Author cannot see draft';end if;
 if (select count(*) from public.reading_plan_versions where id='mark-draft-v2')<>0 then raise exception 'Unpublished version leaked';end if;
 select id into run from public.start_personal_reading_plan('mark-v1');
 select id into other from public.start_personal_reading_plan('mark-v1');
 if run<>other then raise exception 'Repeated start duplicated a personal run';end if;
 perform public.save_reading_plan_progress(run,1,true,'My private reflection',0);
 begin perform public.save_reading_plan_progress(run,1,false,'Stale overwrite',0);raise exception 'Stale save overwrote a reflection';exception when serialization_failure then null;end;
 perform public.save_reading_plan_progress(run,1,false,'Updated reflection',1);
 if (select revision from public.reading_plan_progress where run_id=run and session_number=1)<>2 then raise exception 'Revision not incremented';end if;
 perform set_config('plans_test.run',run::text,true);
 perform public.set_personal_reading_plan_active(run,false,0);
 if (select is_active from public.reading_plan_runs where id=run) then raise exception 'Quit not saved';end if;
 if (select reflection from public.reading_plan_progress where run_id=run and session_number=1)<>'Updated reflection' then raise exception 'Quit lost reflection';end if;
 perform public.set_personal_reading_plan_active(run,false,0);
 if (select activity_revision from public.reading_plan_runs where id=run)<>1 then raise exception 'Retry not idempotent';end if;
 begin perform public.set_personal_reading_plan_active(run,true,0);raise exception 'Stale status overwrote quit';exception when serialization_failure then null;end;
 perform public.set_personal_reading_plan_active(run,true,1);
 if not (select is_active from public.reading_plan_runs where id=run) then raise exception 'Resume not saved';end if;
 begin update public.reading_plan_runs set owner_id='00000000-0000-4000-8000-000000000132' where id=run;raise exception 'Activity permissions allowed reassignment';exception when insufficient_privilege then null;end;
 begin perform public.set_personal_reading_plan_active('00000000-0000-4000-8000-000000000141',false,0);raise exception 'Personal quit changed group run';exception when raise_exception then if sqlerrm<>'This plan is unavailable' then raise;end if;end;

 if exists(select 1 from public.reading_plan_responses where body in ('Second group only','Unreleased community response')) then raise exception 'Response leaked across groups or release boundary';end if;
 if (select count(*) from public.reading_plan_responses)<>2 then raise exception 'Released member responses unavailable';end if;
 begin perform public.save_reading_plan_progress('00000000-0000-4000-8000-000000000142',1,true,'Wrong group',0);raise exception 'Unauthorized group save accepted';exception when raise_exception then if sqlerrm<>'This study is unavailable' then raise;end if;end;
 begin perform public.save_reading_plan_progress('00000000-0000-4000-8000-000000000143',2,true,'Too early',0);raise exception 'Future session save accepted';exception when raise_exception then if sqlerrm<>'This session has not been released' then raise;end if;end;
 begin insert into public.reading_plan_members(run_id,user_id,role)values('00000000-0000-4000-8000-000000000142',auth.uid(),'leader');raise exception 'Leader escalation accepted';exception when insufficient_privilege then null;end;
 begin insert into public.reading_plan_runs(version_id,owner_id,mode) values('mark-v1',auth.uid(),'group');raise exception 'Unauthorized group creation accepted';exception when insufficient_privilege then null;end;
 begin perform public.save_reading_plan_progress(run,99,true,'Invalid session',0);raise exception 'Nonexistent session accepted';exception when foreign_key_violation then null;end;
end;$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000132',true);
do $$begin
 if exists(select 1 from public.reading_plan_progress) then raise exception 'Private reflection leaked';end if;
 begin perform public.set_personal_reading_plan_active(current_setting('plans_test.run')::uuid,false,2);raise exception 'Other account quit accepted';exception when raise_exception then if sqlerrm<>'This plan is unavailable' then raise;end if;end;
 if exists(select 1 from public.reading_plan_responses where body='First group only') then raise exception 'Other group leaked';end if;
 if exists(select 1 from public.reading_plan_studies where id='private-draft') then raise exception 'Other author draft leaked';end if;
end;$$;
reset role;
update public.reading_plan_members set removed_at=now() where run_id='00000000-0000-4000-8000-000000000143' and user_id='00000000-0000-4000-8000-000000000132';
set local role authenticated;
do $$begin
 if exists(select 1 from public.reading_plan_runs where id='00000000-0000-4000-8000-000000000143') then raise exception 'Removed member retained run access';end if;
 if exists(select 1 from public.reading_plan_responses where body='Released community response') then raise exception 'Removed member retained discussion access';end if;
end;$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000133',true);
do $$begin
 if exists(select 1 from public.reading_plan_runs) or exists(select 1 from public.reading_plan_responses) then raise exception 'Unenrolled account access';end if;
end;$$;
reset role;
do $$begin
 begin update public.reading_plan_sessions set title='Changed active text' where version_id='mark-v1' and session_number=1;raise exception 'Published session changed';exception when raise_exception then if sqlerrm<>'Create a new version to change published sessions' then raise;end if;end;
 begin update public.reading_plan_versions set content='{"changed":true}' where id='mark-v1';raise exception 'Published version changed';exception when raise_exception then if sqlerrm<>'Create a new version to change a published study' then raise;end if;end;
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000133',true);
select set_config('plans_test.third_run',(select id::text from public.start_personal_reading_plan('mark-v1')),true);
reset role;
delete from beta_private.testers where user_id='00000000-0000-4000-8000-000000000133';
set local role authenticated;
do $$begin
 begin perform public.set_personal_reading_plan_active(current_setting('plans_test.third_run')::uuid,false,0);raise exception 'Non-beta account quit accepted';exception when raise_exception then if sqlerrm<>'This plan is unavailable' then raise;end if;end;
end;$$;
reset role;
rollback;
