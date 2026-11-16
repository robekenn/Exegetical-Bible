-- Keep the underlying activity table outside the Data API schemas.
create schema if not exists activity_private;
revoke all on schema activity_private from public, anon;
grant usage on schema activity_private to authenticated, service_role;

create table if not exists activity_private.user_activity (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_seen timestamptz,
 share_with_friends boolean not null default true
);
alter table activity_private.user_activity enable row level security;
revoke all on table activity_private.user_activity from public, anon, authenticated;
grant select on table activity_private.user_activity to service_role;
create index if not exists user_activity_last_seen_idx on activity_private.user_activity(last_seen);

create or replace function activity_private.touch()
returns void language sql security definer set search_path = '' as $$
 insert into activity_private.user_activity as activity (user_id,last_seen)
 values ((select auth.uid()),now())
 on conflict (user_id) do update set last_seen=excluded.last_seen
 where activity.last_seen is null or activity.last_seen <= excluded.last_seen - interval '55 seconds';
$$;

create or replace function activity_private.friend_activity()
returns table(user_id uuid,last_seen timestamptz)
language sql stable security definer set search_path = '' as $$
 select a.user_id,a.last_seen
 from public.friendships f
 join activity_private.user_activity a on a.user_id=case
  when f.requester=(select auth.uid()) then f.recipient else f.requester end
 where f.status='accepted' and (select auth.uid()) in (f.requester,f.recipient)
 and a.share_with_friends and a.last_seen is not null
 and not exists (
  select 1 from public.user_blocks b where
   (b.blocker=f.requester and b.blocked=f.recipient)
   or (b.blocker=f.recipient and b.blocked=f.requester)
 );
$$;

create or replace function activity_private.preference(p_visible boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if p_visible is not null then
  insert into activity_private.user_activity(user_id,share_with_friends)
  values ((select auth.uid()),p_visible)
  on conflict (user_id) do update set share_with_friends=excluded.share_with_friends;
 end if;
 return coalesce((select a.share_with_friends from activity_private.user_activity a where a.user_id=(select auth.uid())),true);
end;
$$;

create or replace function public.record_study_activity()
returns void language sql security invoker set search_path = '' as $$
 select activity_private.touch();
$$;

create or replace function public.list_friend_activity()
returns table(user_id uuid,last_seen timestamptz)
language sql stable security invoker set search_path = '' as $$
 select * from activity_private.friend_activity();
$$;

create or replace function public.study_activity_preference(p_visible boolean default null)
returns boolean language sql security invoker set search_path = '' as $$
 select activity_private.preference(p_visible);
$$;

create or replace function public.moderation_activity(p_users uuid[] default '{}')
returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
  'activeCount',(select count(*) from activity_private.user_activity where last_seen >= now()-interval '5 minutes'),
  'observedAt',now(),
  'rows',coalesce((select jsonb_agg(jsonb_build_object('user_id',a.user_id,'last_seen',a.last_seen))
   from activity_private.user_activity a where a.user_id=any(p_users) and a.last_seen is not null),'[]'::jsonb)
 );
$$;

revoke all on function activity_private.touch(),activity_private.friend_activity(),activity_private.preference(boolean),
 public.record_study_activity(),public.list_friend_activity(),public.study_activity_preference(boolean)
 from public, anon, authenticated;
grant execute on function activity_private.touch(),activity_private.friend_activity(),activity_private.preference(boolean),
 public.record_study_activity(),public.list_friend_activity(),public.study_activity_preference(boolean)
 to authenticated;
revoke all on function public.moderation_activity(uuid[]) from public,anon,authenticated;
grant execute on function public.moderation_activity(uuid[]) to service_role;
