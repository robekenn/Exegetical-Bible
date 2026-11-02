begin;
alter table public.community_reports add column if not exists evidence jsonb;
create table if not exists public.community_rate_limits(user_id uuid not null references auth.users(id) on delete cascade,action text not null,window_start timestamptz not null,hits int not null,primary key(user_id,action));
alter table public.community_rate_limits enable row level security;
revoke all on public.community_rate_limits from public,anon,authenticated;
create or replace function public.community_rate(p_action text,p_limit int,p_seconds int) returns void language plpgsql security definer set search_path=public as $$
declare n int;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 -- Public callers cannot choose an unbounded window or arbitrary action counters.
 if p_action not in('request','send','report') or p_limit not between 1 and 30 or p_seconds not between 60 and 86400 then raise exception 'Invalid rate limit'; end if;
 insert into public.community_rate_limits(user_id,action,window_start,hits) values(auth.uid(),p_action,now(),1)
 on conflict(user_id,action) do update set hits=case when community_rate_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else community_rate_limits.hits+1 end,window_start=case when community_rate_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else community_rate_limits.window_start end
 returning hits into n;
 if n>p_limit then raise exception 'You have reached the current limit. Please try again later.'; end if;
end; $$;
revoke all on function public.community_rate(text,int,int) from public,anon,authenticated;
-- The security-definer action RPC is the only caller of the rate limiter.
create or replace function public.community_action(p_action text,p_person uuid default null,p_id uuid default null,p_body text default '',p_verse jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); f public.friendships; m public.friend_messages; result uuid;
begin
 if me is null then raise exception 'Sign in required'; end if;
 if p_action in('request','send') and not exists(select 1 from public.profiles where id=me and terms_version='2026-11-02') then raise exception 'Save your profile and accept the community terms first'; end if;
 if p_action='request' then
  perform public.community_rate('request',30,86400);
  if p_person=me or not exists(select 1 from public.profiles where id=p_person and discoverable) or public.community_blocked(me,p_person) then raise exception 'This profile cannot receive a request'; end if;
  if (select count(*) from public.friendships where requester=me and created_at>now()-interval '1 day')>=30 then raise exception 'Daily request limit reached'; end if;
  insert into public.friendships(requester,recipient) values(me,p_person) returning id into result;
 elsif p_action='accept' then
  update public.friendships set status='accepted' where id=p_id and recipient=me and status='pending' and not public.community_blocked(requester,recipient) returning id into result;
  if result is null then raise exception 'Request no longer available'; end if;
 elsif p_action='remove' then
  delete from public.friendships where id=p_id and me in(requester,recipient) returning id into result;
 elsif p_action='block' then
  if p_person is null or p_person=me then raise exception 'Invalid person'; end if;
  insert into public.user_blocks(blocker,blocked) values(me,p_person) on conflict do nothing;
  delete from public.friendships where (requester=me and recipient=p_person) or(requester=p_person and recipient=me);
 elsif p_action='unblock' then
  delete from public.user_blocks where blocker=me and blocked=p_person;
 elsif p_action='send' then
  perform public.community_rate('send',20,60);
  if not public.community_friends(me,p_person) then raise exception 'Only accepted friends can send messages'; end if;
  if length(p_body)>4000 or(length(trim(p_body))=0 and p_verse is null) then raise exception 'Write a message or choose a verse'; end if;
  if (select count(*) from public.friend_messages where sender=me and created_at>now()-interval '1 minute')>=20 then raise exception 'Please wait a moment before sending more messages'; end if;
  if p_verse is not null then
   if jsonb_typeof(p_verse)<>'object' or coalesce(p_verse->>'book','')!~'^[A-Z0-9]{3}$' or coalesce(p_verse->>'chapter','')!~'^[1-9][0-9]{0,2}$' or coalesce(p_verse->>'verse','')!~'^[1-9][0-9]{0,2}$' or coalesce(p_verse->>'translation','')!~'^[A-Za-z0-9_-]{1,40}$' or length(p_verse::text)>300 then raise exception 'Invalid verse reference'; end if;
  end if;
  insert into public.friend_messages(sender,recipient,body,verse) values(me,p_person,trim(p_body),p_verse) returning id into result;
 elsif p_action='retract' then
  update public.friend_messages set body='',verse=null,removed_at=now() where id=p_id and sender=me returning id into result;
  if result is null then raise exception 'Message unavailable'; end if;
 else raise exception 'Unknown community action';
 end if;
 return jsonb_build_object('ok',true,'id',result);
end; $$;
create or replace function public.submit_community_report(p_category text,p_details text,p_subject uuid default null,p_message uuid default null) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_message is not null and not exists(select 1 from public.friend_messages where id=p_message and auth.uid() in(sender,recipient)) then raise exception 'Message unavailable'; end if;
 if(select count(*) from public.community_reports where reporter=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception 'Daily report limit reached'; end if;
 perform public.community_rate('report',10,86400);
 insert into public.community_reports(reporter,subject,message_id,category,details,evidence) values(auth.uid(),p_subject,p_message,p_category,trim(p_details),(select jsonb_build_object('body',m.body,'verse',m.verse,'created_at',m.created_at) from public.friend_messages m where m.id=p_message));
end; $$;

commit;
