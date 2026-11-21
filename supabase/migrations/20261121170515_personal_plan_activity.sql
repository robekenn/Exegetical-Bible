-- Quitting preserves the run, membership, completion and private reflections.
alter table public.reading_plan_runs
 add column is_active boolean not null default true,
 add column activity_revision bigint not null default 0 check(activity_revision>=0);

grant update(is_active,activity_revision) on public.reading_plan_runs to authenticated;
create policy "Manage own personal plan activity" on public.reading_plan_runs for update to authenticated
 using(owner_id=(select auth.uid()) and mode='personal')
 with check(owner_id=(select auth.uid()) and mode='personal');

create function public.set_personal_reading_plan_active(p_run_id uuid,p_active boolean,p_revision bigint)
 returns setof public.reading_plan_runs language plpgsql security invoker set search_path='' as $$
declare result public.reading_plan_runs;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_active is null or p_revision is null or p_revision<0 then raise exception 'Invalid plan status' using errcode='22023'; end if;
 select * into result from public.reading_plan_runs
 where id=p_run_id and owner_id=auth.uid() and mode='personal' for update;
 if not found then raise exception 'This plan is unavailable'; end if;
 -- An identical retry also succeeds after a lost response.
 if result.is_active=p_active then return next result;return;end if;
 if result.activity_revision<>p_revision then raise exception 'This plan changed on another device' using errcode='40001';end if;
 return query update public.reading_plan_runs set is_active=p_active,activity_revision=activity_revision+1
 where id=p_run_id and owner_id=auth.uid() and mode='personal' returning *;
end; $$;
revoke all on function public.set_personal_reading_plan_active(uuid,boolean,bigint) from public,anon;
grant execute on function public.set_personal_reading_plan_active(uuid,boolean,bigint) to authenticated;
