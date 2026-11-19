create schema if not exists beta_private;
revoke all on schema beta_private from public,anon;
grant usage on schema beta_private to authenticated,service_role;
create table beta_private.testers(user_id uuid primary key references auth.users(id) on delete cascade);
create table beta_private.owners(user_id uuid primary key references auth.users(id) on delete cascade);
create table beta_private.preferences(user_id uuid primary key references auth.users(id) on delete cascade,enabled boolean not null default true);
create table beta_private.audit(id bigint generated always as identity primary key,actor uuid,target uuid,enabled boolean,created_at timestamptz not null default now());
alter table beta_private.testers enable row level security;
alter table beta_private.owners enable row level security;
alter table beta_private.preferences enable row level security;
alter table beta_private.audit enable row level security;
revoke all on all tables in schema beta_private from public,anon,authenticated;
create function beta_private.enabled() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from moderation.admins where user_id=auth.uid()) or exists(select 1 from beta_private.owners where user_id=auth.uid()) or exists(select 1 from beta_private.testers where user_id=auth.uid())) and coalesce((select enabled from beta_private.preferences where user_id=auth.uid()),true);
$$;
revoke all on function beta_private.enabled() from public,anon;
grant execute on function beta_private.enabled() to authenticated;
create function public.beta_state(p_user uuid,p_owners uuid[],p_enabled boolean default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare eligible boolean; enabled boolean;
begin
 delete from beta_private.owners where not(user_id=any(p_owners));
 insert into beta_private.owners select unnest(p_owners) on conflict do nothing;
 eligible:=exists(select 1 from moderation.admins where user_id=p_user) or p_user=any(p_owners) or exists(select 1 from beta_private.testers where user_id=p_user);
 if p_enabled is not null then
  if not eligible then raise insufficient_privilege using message='Beta access required';end if;
  insert into beta_private.preferences values(p_user,p_enabled) on conflict(user_id) do update set enabled=excluded.enabled;
 end if;
 select coalesce((select p.enabled from beta_private.preferences p where user_id=p_user),true) into enabled;
 return jsonb_build_object('eligible',eligible,'enabled',eligible and enabled);
end;$$;
create function public.assign_beta_tester(p_actor uuid,p_target uuid,p_enabled boolean,p_owners uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not(p_actor=any(p_owners)) and not exists(select 1 from moderation.admins where user_id=p_actor) then raise insufficient_privilege;end if;
 if p_enabled then insert into beta_private.testers values(p_target) on conflict do nothing;
 else delete from beta_private.testers where user_id=p_target;end if;
 insert into beta_private.audit(actor,target,enabled) values(p_actor,p_target,p_enabled);
end;$$;
revoke all on function public.beta_state(uuid,uuid[],boolean),public.assign_beta_tester(uuid,uuid,boolean,uuid[]) from public,anon,authenticated;
grant execute on function public.beta_state(uuid,uuid[],boolean),public.assign_beta_tester(uuid,uuid,boolean,uuid[]) to service_role;
create or replace function public.moderation_users(p_search text,p_offset integer,p_owners uuid[])
returns table(id uuid,email text,username text,display_name text,created_at timestamptz,role text)
language sql stable security definer set search_path='' as $$
 select u.id,u.email::text,p.username,p.display_name,u.created_at,
 case when u.id=any(p_owners) then 'owner' when a.user_id is not null then 'admin' when b.user_id is not null then 'beta tester' else 'member' end
 from auth.users u left join public.profiles p on p.id=u.id left join moderation.admins a on a.user_id=u.id left join beta_private.testers b on b.user_id=u.id
 where p_search='' or strpos(lower(coalesce(u.email,'')),lower(p_search))>0 or strpos(lower(coalesce(p.username,'')),lower(p_search))>0 or strpos(lower(coalesce(p.display_name,'')),lower(p_search))>0 or u.id::text=p_search
 order by u.created_at desc,u.id offset greatest(0,p_offset) limit 26;
$$;
do $$declare t text;begin
 foreach t in array array['reading_plan_studies','reading_plan_versions','reading_plan_sessions','reading_plan_runs','reading_plan_members','reading_plan_progress','reading_plan_responses','reading_plan_replies'] loop
 execute format('create policy "Beta access required" on public.%I as restrictive for all to authenticated using (beta_private.enabled()) with check (beta_private.enabled())',t);
 execute format('create policy "No public beta access" on public.%I as restrictive for select to anon using (false)',t);
 end loop;
end;$$;
