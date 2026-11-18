-- Additive Plans foundation. The initial UI starts personal runs only.
-- Group enrollment, publishing and shared-response writes remain server-managed until their UI launches.
create schema if not exists plans_private;
revoke all on schema plans_private from public,anon,authenticated;

create table public.reading_plan_studies (
 id text primary key check(id ~ '^[a-z][a-z0-9-]{1,79}$'),
 author_id uuid references auth.users(id) on delete set null,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.reading_plan_versions (
 id text primary key check(id ~ '^[a-z][a-z0-9-]{1,89}$'),
 study_id text not null references public.reading_plan_studies(id),
 version integer not null check(version>0),
 content jsonb not null check(jsonb_typeof(content)='object' and length(content::text)<=100000),
 session_count integer not null check(session_count between 1 and 999),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 unique(study_id,version)
);
create table public.reading_plan_sessions (
 version_id text not null references public.reading_plan_versions(id),
 session_number integer not null check(session_number between 1 and 999),
 title text not null check(length(title) between 1 and 300),
 passages jsonb not null check(jsonb_typeof(passages)='array' and jsonb_array_length(passages) between 1 and 20 and length(passages::text)<=12000),
 devotional text check(length(devotional)<=100000),
 questions jsonb not null default '[]' check(jsonb_typeof(questions)='array' and length(questions::text)<=20000),
 practice text check(length(practice)<=10000),
 credits text check(length(credits)<=10000),
 primary key(version_id,session_number)
);
create table public.reading_plan_runs (
 id uuid primary key default gen_random_uuid(),
 version_id text not null references public.reading_plan_versions(id),
 owner_id uuid references auth.users(id) on delete set null,
 mode text not null check(mode in ('personal','group','community')),
 timezone text not null default 'UTC' check(length(timezone)<=80),
 starts_at timestamptz,
 created_at timestamptz not null default now(),
 check(mode<>'community' or starts_at is not null),
 unique(id,version_id)
);
create unique index reading_plan_personal_once on public.reading_plan_runs(owner_id,version_id) where mode='personal';
create index reading_plan_runs_owner on public.reading_plan_runs(owner_id);
create index reading_plan_runs_version on public.reading_plan_runs(version_id);
create table public.reading_plan_members (
 run_id uuid not null references public.reading_plan_runs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'participant' check(role in ('leader','participant')),
 removed_at timestamptz,
 joined_at timestamptz not null default now(),
 primary key(run_id,user_id)
);
create index reading_plan_members_user on public.reading_plan_members(user_id,run_id);
create table public.reading_plan_progress (
 run_id uuid not null,
 version_id text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 session_number integer not null,
 completed boolean not null default false,
 reflection text not null default '' check(length(reflection)<=20000),
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 primary key(run_id,user_id,session_number),
 foreign key(run_id,version_id) references public.reading_plan_runs(id,version_id) on delete cascade,
 foreign key(run_id,user_id) references public.reading_plan_members(run_id,user_id) on delete cascade,
 foreign key(version_id,session_number) references public.reading_plan_sessions(version_id,session_number)
);
create index reading_plan_progress_user on public.reading_plan_progress(user_id,run_id);
create index reading_plan_progress_session on public.reading_plan_progress(version_id,session_number);
-- Separate from private reflections; never silently share a progress row.
create table public.reading_plan_responses (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null,
 version_id text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 session_number integer not null,
 body text not null check(length(body) between 1 and 20000),
 created_at timestamptz not null default now(),
 foreign key(run_id,version_id) references public.reading_plan_runs(id,version_id) on delete cascade,
 foreign key(run_id,user_id) references public.reading_plan_members(run_id,user_id) on delete cascade,
 foreign key(version_id,session_number) references public.reading_plan_sessions(version_id,session_number)
);
create index reading_plan_responses_run on public.reading_plan_responses(run_id,created_at);
create index reading_plan_responses_user on public.reading_plan_responses(user_id);
create index reading_plan_responses_session on public.reading_plan_responses(version_id,session_number);
create table public.reading_plan_replies (
 id uuid primary key default gen_random_uuid(),
 response_id uuid not null references public.reading_plan_responses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(body) between 1 and 10000),
 created_at timestamptz not null default now()
);
create index reading_plan_replies_response on public.reading_plan_replies(response_id,created_at);
create index reading_plan_replies_user on public.reading_plan_replies(user_id);

alter table public.reading_plan_studies enable row level security;
alter table public.reading_plan_versions enable row level security;
alter table public.reading_plan_sessions enable row level security;
alter table public.reading_plan_runs enable row level security;
alter table public.reading_plan_members enable row level security;
alter table public.reading_plan_progress enable row level security;
alter table public.reading_plan_responses enable row level security;
alter table public.reading_plan_replies enable row level security;
revoke all on public.reading_plan_studies,public.reading_plan_versions,public.reading_plan_sessions,
 public.reading_plan_runs,public.reading_plan_members,public.reading_plan_progress,
 public.reading_plan_responses,public.reading_plan_replies from public,anon,authenticated;
grant select on public.reading_plan_studies,public.reading_plan_versions,public.reading_plan_sessions to anon,authenticated;
grant select on public.reading_plan_runs,public.reading_plan_members,public.reading_plan_progress,public.reading_plan_responses,public.reading_plan_replies to authenticated;
grant insert on public.reading_plan_runs,public.reading_plan_members to authenticated;
grant insert,update on public.reading_plan_progress to authenticated;
grant all on public.reading_plan_studies,public.reading_plan_versions,public.reading_plan_sessions,
 public.reading_plan_runs,public.reading_plan_members,public.reading_plan_progress,
 public.reading_plan_responses,public.reading_plan_replies to service_role;

create policy "Published studies or own drafts" on public.reading_plan_studies for select to anon,authenticated
 using(published or author_id=(select auth.uid()));
create policy "Published versions or own drafts" on public.reading_plan_versions for select to anon,authenticated
 using(exists(select 1 from public.reading_plan_studies s where s.id=study_id and ((reading_plan_versions.published and s.published) or s.author_id=(select auth.uid()))));
create policy "Accessible session versions" on public.reading_plan_sessions for select to anon,authenticated
 using(exists(select 1 from public.reading_plan_versions v where v.id=version_id));
-- Membership visibility does not query runs, avoiding recursive RLS policies.
create policy "Own enrollment" on public.reading_plan_members for select to authenticated using(user_id=(select auth.uid()));
create policy "Accessible runs" on public.reading_plan_runs for select to authenticated
 using((mode='personal' and owner_id=(select auth.uid())) or exists(select 1 from public.reading_plan_members m where m.run_id=id and m.user_id=(select auth.uid()) and m.removed_at is null));
create policy "Start personal runs only" on public.reading_plan_runs for insert to authenticated
 with check(owner_id=(select auth.uid()) and mode='personal' and starts_at is null and timezone='UTC' and exists(select 1 from public.reading_plan_versions v where v.id=version_id and v.published));
-- The narrowly scoped ownership check avoids recursive membership/run policies.
create function plans_private.owns_personal_run(p_run_id uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.reading_plan_runs r where r.id=p_run_id and r.owner_id=auth.uid() and r.mode='personal');
$$;
revoke all on function plans_private.owns_personal_run(uuid) from public,anon;
grant usage on schema plans_private to authenticated;
grant execute on function plans_private.owns_personal_run(uuid) to authenticated;
create policy "Enroll in own personal run only" on public.reading_plan_members for insert to authenticated
 with check(user_id=(select auth.uid()) and role='leader' and removed_at is null and plans_private.owns_personal_run(run_id));
create function public.reading_plan_session_released(p_run_id uuid,p_session integer) returns boolean
 language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.reading_plan_runs r where r.id=p_run_id and
  (r.starts_at is null or ((r.starts_at at time zone r.timezone)+(p_session-1)*interval '1 day') at time zone r.timezone<=now()));
$$;
revoke all on function public.reading_plan_session_released(uuid,integer) from public,anon;
grant execute on function public.reading_plan_session_released(uuid,integer) to authenticated;
create policy "Own private progress" on public.reading_plan_progress for select to authenticated
 using(user_id=(select auth.uid()) and public.reading_plan_session_released(run_id,session_number) and exists(select 1 from public.reading_plan_members m where m.run_id=reading_plan_progress.run_id and m.user_id=(select auth.uid()) and m.removed_at is null));
create policy "Write own progress" on public.reading_plan_progress for insert to authenticated
 with check(user_id=(select auth.uid()) and public.reading_plan_session_released(run_id,session_number) and exists(select 1 from public.reading_plan_members m where m.run_id=reading_plan_progress.run_id and m.user_id=(select auth.uid()) and m.removed_at is null));
create policy "Update own progress" on public.reading_plan_progress for update to authenticated
 using(user_id=(select auth.uid()) and public.reading_plan_session_released(run_id,session_number) and exists(select 1 from public.reading_plan_members m where m.run_id=reading_plan_progress.run_id and m.user_id=(select auth.uid()) and m.removed_at is null))
 with check(user_id=(select auth.uid()) and public.reading_plan_session_released(run_id,session_number) and exists(select 1 from public.reading_plan_members m where m.run_id=reading_plan_progress.run_id and m.user_id=(select auth.uid()) and m.removed_at is null));

create policy "Shared responses within enrolled runs" on public.reading_plan_responses for select to authenticated
 using(public.reading_plan_session_released(run_id,session_number) and exists(select 1 from public.reading_plan_runs r where r.id=run_id and r.mode<>'personal') and exists(select 1 from public.reading_plan_members m where m.run_id=reading_plan_responses.run_id and m.user_id=(select auth.uid()) and m.removed_at is null));
create policy "Replies follow visible responses" on public.reading_plan_replies for select to authenticated
 using(exists(select 1 from public.reading_plan_responses r where r.id=response_id));

create function plans_private.freeze_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.published or exists(select 1 from public.reading_plan_runs r where r.version_id=old.id) then
  if tg_op='DELETE' then raise exception 'Published plan versions must be preserved'; end if;
  if (to_jsonb(new)-'published') is distinct from (to_jsonb(old)-'published') then raise exception 'Create a new version to change a published study'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
create trigger freeze_reading_plan_version before update or delete on public.reading_plan_versions for each row execute function plans_private.freeze_version();
create function plans_private.freeze_session() returns trigger language plpgsql security invoker set search_path='' as $$
declare v text;
begin
 if tg_op='DELETE' then v=old.version_id; else v=new.version_id; end if;
 if exists(select 1 from public.reading_plan_versions p where p.id=v and p.published) or exists(select 1 from public.reading_plan_runs r where r.version_id=v) or
  (tg_op='UPDATE' and exists(select 1 from public.reading_plan_versions p where p.id=old.version_id and p.published)) then
  raise exception 'Create a new version to change published sessions';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
create trigger freeze_reading_plan_session before insert or update or delete on public.reading_plan_sessions for each row execute function plans_private.freeze_session();
create function plans_private.validate_run() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Choose a valid timezone'; end if;
 if tg_op='UPDATE' and new.version_id is distinct from old.version_id then raise exception 'A run must keep the version it started with'; end if;
 return new;
end; $$;
create trigger validate_reading_plan_run before insert or update on public.reading_plan_runs for each row execute function plans_private.validate_run();
revoke all on function plans_private.freeze_version(),plans_private.freeze_session(),plans_private.validate_run() from public,anon,authenticated;

create function public.start_personal_reading_plan(p_version_id text) returns setof public.reading_plan_runs
 language plpgsql security invoker set search_path='' as $$
declare result public.reading_plan_runs;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from public.reading_plan_versions v where v.id=p_version_id and v.published) then raise exception 'This plan is unavailable'; end if;
 insert into public.reading_plan_runs(version_id,owner_id,mode) values(p_version_id,auth.uid(),'personal') on conflict(owner_id,version_id) where mode='personal' do nothing;
 select * into strict result from public.reading_plan_runs where owner_id=auth.uid() and version_id=p_version_id and mode='personal';
 insert into public.reading_plan_members(run_id,user_id,role) values(result.id,auth.uid(),'leader') on conflict do nothing;
 return next result;
end; $$;
create function public.save_reading_plan_progress(p_run_id uuid,p_session integer,p_completed boolean,p_reflection text,p_revision bigint)
 returns setof public.reading_plan_progress language plpgsql security invoker set search_path='' as $$
declare version text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select r.version_id into version from public.reading_plan_runs r join public.reading_plan_members m on m.run_id=r.id where r.id=p_run_id and m.user_id=auth.uid() and m.removed_at is null;
 if version is null then raise exception 'This study is unavailable'; end if;
 if not public.reading_plan_session_released(p_run_id,p_session) then raise exception 'This session has not been released'; end if;
 if p_revision=0 then
  return query insert into public.reading_plan_progress(run_id,version_id,user_id,session_number,completed,reflection)
   values(p_run_id,version,auth.uid(),p_session,p_completed,p_reflection) on conflict do nothing returning *;
 else
  return query update public.reading_plan_progress set completed=p_completed,reflection=p_reflection,revision=revision+1,updated_at=now()
   where run_id=p_run_id and user_id=auth.uid() and session_number=p_session and revision=p_revision returning *;
 end if;
 if not found then raise exception 'This session changed on another device' using errcode='40001'; end if;
end; $$;
revoke all on function public.start_personal_reading_plan(text),public.save_reading_plan_progress(uuid,integer,boolean,text,bigint) from public,anon;
grant execute on function public.start_personal_reading_plan(text),public.save_reading_plan_progress(uuid,integer,boolean,text,bigint) to authenticated;

-- Initial reference-only schedules. The bundled catalog is pinned to these versions.
insert into public.reading_plan_studies(id,published) values('mark',true);
insert into public.reading_plan_versions(id,study_id,version,content,session_count) values('mark-v1','mark',1,'{"id":"mark","versionId":"mark-v1","version":1,"title":"Read through Mark","bookName":"Mark","description":"One chapter at a time, from the beginning of Mark to the end. A manageable place to build a reading rhythm.","minutes":"5–10 min","tone":"olive","author":"Exegetical Bible","kind":"Scripture reading plan","credits":"Original passage schedule for Exegetical Bible. Scripture opens in your selected translation."}'::jsonb,16);
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',1,'Mark 1','[{"book":"MRK","bookName":"Mark","chapter":1}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',2,'Mark 2','[{"book":"MRK","bookName":"Mark","chapter":2}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',3,'Mark 3','[{"book":"MRK","bookName":"Mark","chapter":3}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',4,'Mark 4','[{"book":"MRK","bookName":"Mark","chapter":4}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',5,'Mark 5','[{"book":"MRK","bookName":"Mark","chapter":5}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',6,'Mark 6','[{"book":"MRK","bookName":"Mark","chapter":6}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',7,'Mark 7','[{"book":"MRK","bookName":"Mark","chapter":7}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',8,'Mark 8','[{"book":"MRK","bookName":"Mark","chapter":8}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',9,'Mark 9','[{"book":"MRK","bookName":"Mark","chapter":9}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',10,'Mark 10','[{"book":"MRK","bookName":"Mark","chapter":10}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',11,'Mark 11','[{"book":"MRK","bookName":"Mark","chapter":11}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',12,'Mark 12','[{"book":"MRK","bookName":"Mark","chapter":12}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',13,'Mark 13','[{"book":"MRK","bookName":"Mark","chapter":13}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',14,'Mark 14','[{"book":"MRK","bookName":"Mark","chapter":14}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',15,'Mark 15','[{"book":"MRK","bookName":"Mark","chapter":15}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('mark-v1',16,'Mark 16','[{"book":"MRK","bookName":"Mark","chapter":16}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
update public.reading_plan_versions set published=true where id='mark-v1';
insert into public.reading_plan_studies(id,published) values('john',true);
insert into public.reading_plan_versions(id,study_id,version,content,session_count) values('john-v1','john',1,'{"id":"john","versionId":"john-v1","version":1,"title":"Read through John","bookName":"John","description":"Make room for a chapter of John each session, with space to keep your own reflections along the way.","minutes":"8–12 min","tone":"clay","author":"Exegetical Bible","kind":"Scripture reading plan","credits":"Original passage schedule for Exegetical Bible. Scripture opens in your selected translation."}'::jsonb,21);
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',1,'John 1','[{"book":"JHN","bookName":"John","chapter":1}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',2,'John 2','[{"book":"JHN","bookName":"John","chapter":2}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',3,'John 3','[{"book":"JHN","bookName":"John","chapter":3}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',4,'John 4','[{"book":"JHN","bookName":"John","chapter":4}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',5,'John 5','[{"book":"JHN","bookName":"John","chapter":5}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',6,'John 6','[{"book":"JHN","bookName":"John","chapter":6}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',7,'John 7','[{"book":"JHN","bookName":"John","chapter":7}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',8,'John 8','[{"book":"JHN","bookName":"John","chapter":8}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',9,'John 9','[{"book":"JHN","bookName":"John","chapter":9}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',10,'John 10','[{"book":"JHN","bookName":"John","chapter":10}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',11,'John 11','[{"book":"JHN","bookName":"John","chapter":11}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',12,'John 12','[{"book":"JHN","bookName":"John","chapter":12}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',13,'John 13','[{"book":"JHN","bookName":"John","chapter":13}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',14,'John 14','[{"book":"JHN","bookName":"John","chapter":14}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',15,'John 15','[{"book":"JHN","bookName":"John","chapter":15}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',16,'John 16','[{"book":"JHN","bookName":"John","chapter":16}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',17,'John 17','[{"book":"JHN","bookName":"John","chapter":17}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',18,'John 18','[{"book":"JHN","bookName":"John","chapter":18}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',19,'John 19','[{"book":"JHN","bookName":"John","chapter":19}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',20,'John 20','[{"book":"JHN","bookName":"John","chapter":20}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('john-v1',21,'John 21','[{"book":"JHN","bookName":"John","chapter":21}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
update public.reading_plan_versions set published=true where id='john-v1';
insert into public.reading_plan_studies(id,published) values('psalms',true);
insert into public.reading_plan_versions(id,study_id,version,content,session_count) values('psalms-v1','psalms',1,'{"id":"psalms","versionId":"psalms-v1","version":1,"title":"A week in Psalms","bookName":"Psalms","description":"Seven selected psalms, one per session. Take a week, or move at a pace that works for you.","minutes":"2–5 min","tone":"gold","author":"Exegetical Bible","kind":"Scripture reading plan","credits":"Original passage schedule for Exegetical Bible. Scripture opens in your selected translation."}'::jsonb,7);
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('psalms-v1',1,'Psalm 1','[{"book":"PSA","bookName":"Psalm","chapter":1}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('psalms-v1',2,'Psalm 8','[{"book":"PSA","bookName":"Psalm","chapter":8}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('psalms-v1',3,'Psalm 23','[{"book":"PSA","bookName":"Psalm","chapter":23}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('psalms-v1',4,'Psalm 46','[{"book":"PSA","bookName":"Psalm","chapter":46}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('psalms-v1',5,'Psalm 51','[{"book":"PSA","bookName":"Psalm","chapter":51}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('psalms-v1',6,'Psalm 103','[{"book":"PSA","bookName":"Psalm","chapter":103}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
insert into public.reading_plan_sessions(version_id,session_number,title,passages,credits) values('psalms-v1',7,'Psalm 139','[{"book":"PSA","bookName":"Psalm","chapter":139}]'::jsonb,'Original passage schedule for Exegetical Bible. Scripture opens in your selected translation.');
update public.reading_plan_versions set published=true where id='psalms-v1';
