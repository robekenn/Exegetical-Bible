begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9_]{3,24}$'),
 display_name text not null check(length(display_name) between 1 and 60),
 bio text not null default '' check(length(bio)<=600),
 location text not null default '' check(length(location)<=80),
 interests text not null default '' check(length(interests)<=200),
 avatar text check(avatar is null or (avatar ~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' and length(avatar)<100000)),
 discoverable boolean not null default false,
 terms_version text not null check(terms_version='2026-11-02'),
 updated_at timestamptz not null default now()
);
create table if not exists public.friendships (
 id uuid primary key default gen_random_uuid(),
 requester uuid not null references auth.users(id) on delete cascade,
 recipient uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(), check(requester<>recipient)
);
create unique index if not exists unique_friend_pair on public.friendships(least(requester,recipient),greatest(requester,recipient));
create table if not exists public.user_blocks (
 blocker uuid not null references auth.users(id) on delete cascade,
 blocked uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(blocker,blocked),check(blocker<>blocked)
);
create table if not exists public.friend_messages (
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references auth.users(id) on delete cascade,
 recipient uuid not null references auth.users(id) on delete cascade,
 body text not null default '' check(length(body)<=4000),
 verse jsonb,
 created_at timestamptz not null default now(),
 removed_at timestamptz,
 check(sender<>recipient),check(length(body)>0 or verse is not null or removed_at is not null)
);
create index if not exists message_conversation on public.friend_messages(sender,recipient,created_at desc);
create index if not exists message_recipient on public.friend_messages(recipient,created_at desc);
create table if not exists public.community_reports (
 id uuid primary key default gen_random_uuid(),
 reporter uuid references auth.users(id) on delete set null,
 subject uuid references auth.users(id) on delete set null,
 message_id uuid references public.friend_messages(id) on delete set null,
 category text not null check(category in ('abuse','privacy','support','accessibility')),
 details text not null check(length(details) between 10 and 3000),
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.friend_messages enable row level security;
alter table public.community_reports enable row level security;
create or replace function public.community_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() in(a,b) and exists(select 1 from public.user_blocks where (blocker=a and blocked=b) or (blocker=b and blocked=a));
$$;
create or replace function public.community_friends(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() in(a,b) and exists(select 1 from public.friendships where status='accepted' and ((requester=a and recipient=b) or(requester=b and recipient=a))) and not public.community_blocked(a,b);
$$;
-- Helpers are internal to policies and RPCs; arbitrary callers cannot probe the social graph.
revoke all on function public.community_blocked(uuid,uuid),public.community_friends(uuid,uuid) from public,anon;
grant execute on function public.community_blocked(uuid,uuid),public.community_friends(uuid,uuid) to authenticated;
create policy "Owner or friends can see profile" on public.profiles for select to authenticated using(id=(select auth.uid()) or public.community_friends((select auth.uid()),id));
create policy "Owner can create profile" on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy "Owner can edit profile" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "Participants see friendships" on public.friendships for select to authenticated using((select auth.uid()) in(requester,recipient));
create policy "Owner sees blocks" on public.user_blocks for select to authenticated using(blocker=(select auth.uid()));
create policy "Participants see messages" on public.friend_messages for select to authenticated using((select auth.uid()) in(sender,recipient));
create policy "Reporter sees own reports" on public.community_reports for select to authenticated using(reporter=(select auth.uid()));
revoke all on public.profiles,public.friendships,public.user_blocks,public.friend_messages,public.community_reports from anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.friendships,public.user_blocks,public.friend_messages,public.community_reports to authenticated;
create or replace function public.find_study_friend(p_username text) returns table(id uuid,username text,display_name text,avatar text) language sql stable security definer set search_path=public as $$
 select p.id,p.username,p.display_name,p.avatar from public.profiles p where auth.uid() is not null and p.username=lower(trim(p_username)) and p.id<>auth.uid() and (p.discoverable or public.community_friends(auth.uid(),p.id)) and not public.community_blocked(auth.uid(),p.id) limit 1;
$$;
create or replace function public.list_study_people() returns table(id uuid,username text,display_name text,avatar text) language sql stable security definer set search_path=public as $$
 select p.id,p.username,p.display_name,p.avatar from public.profiles p where auth.uid() is not null and(p.id=auth.uid() or exists(select 1 from public.friendships f where (f.requester=auth.uid() and f.recipient=p.id)or(f.recipient=auth.uid() and f.requester=p.id))or exists(select 1 from public.friend_messages m where(m.sender=auth.uid() and m.recipient=p.id)or(m.recipient=auth.uid() and m.sender=p.id))or exists(select 1 from public.user_blocks b where b.blocker=auth.uid() and b.blocked=p.id));
$$;
revoke all on function public.list_study_people() from public,anon;
grant execute on function public.list_study_people() to authenticated;
create or replace function public.community_action(p_action text,p_person uuid default null,p_id uuid default null,p_body text default '',p_verse jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); f public.friendships; m public.friend_messages; result uuid;
begin
 if me is null then raise exception 'Sign in required'; end if;
 if p_action in('request','send') and not exists(select 1 from public.profiles where id=me and terms_version='2026-11-02') then raise exception 'Save your profile and accept the community terms first'; end if;
 if p_action='request' then
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
 insert into public.community_reports(reporter,subject,message_id,category,details) values(auth.uid(),p_subject,p_message,p_category,trim(p_details));
end; $$;
revoke all on function public.find_study_friend(text),public.community_action(text,uuid,uuid,text,jsonb),public.submit_community_report(text,text,uuid,uuid) from public,anon;
grant execute on function public.find_study_friend(text),public.community_action(text,uuid,uuid,text,jsonb),public.submit_community_report(text,text,uuid,uuid) to authenticated;
-- Non-sensitive schema version marker for repeatable operations.
comment on table public.profiles is 'Exegetical community schema v1, 2026-11-02';
commit;
