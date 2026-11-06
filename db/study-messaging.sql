begin;
select pg_advisory_xact_lock(731892145);

create table if not exists public.study_groups (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(title) between 1 and 80),
 created_at timestamptz not null default now()
);
create table if not exists public.study_group_members (
 group_id uuid not null references public.study_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(group_id,user_id)
);
create index if not exists study_group_members_user on public.study_group_members(user_id,group_id);

alter table public.friend_messages
 alter column recipient drop not null,
 add column if not exists group_id uuid references public.study_groups(id) on delete cascade,
 add column if not exists attachments jsonb not null default '[]';
-- Replace the old body/verse check while preserving legacy messages and tombstones.
alter table public.friend_messages drop constraint if exists friend_messages_check1;
alter table public.friend_messages drop constraint if exists friend_messages_content;
alter table public.friend_messages add constraint friend_messages_content check (
 length(body)>0 or verse is not null or attachments <> '[]' or removed_at is not null
);
alter table public.friend_messages drop constraint if exists friend_messages_destination;
alter table public.friend_messages add constraint friend_messages_destination check (
 (recipient is null) <> (group_id is null)
);
create index if not exists study_group_messages on public.friend_messages(group_id,created_at desc,id desc) where group_id is not null;

alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
revoke all on public.study_groups,public.study_group_members from public,anon,authenticated;
grant select on public.study_groups to authenticated;

-- Used by the policies below. The caller can only check their own membership.
create or replace function public.is_study_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.study_group_members where group_id=p_group and user_id=auth.uid());
$$;
revoke all on function public.is_study_group_member(uuid) from public,anon;
grant execute on function public.is_study_group_member(uuid) to authenticated;

drop policy if exists "Members see study groups" on public.study_groups;
create policy "Members see study groups" on public.study_groups for select to authenticated
 using(public.is_study_group_member(id));
create or replace function public.can_read_study_group_message(p_message uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.friend_messages m where m.id=p_message
  and public.is_study_group_member(m.group_id) and not public.community_blocked(auth.uid(),m.sender));
$$;
revoke all on function public.can_read_study_group_message(uuid) from public,anon;
grant execute on function public.can_read_study_group_message(uuid) to authenticated;

drop policy if exists "Participants see messages" on public.friend_messages;
create policy "Participants see messages" on public.friend_messages for select to authenticated
 using((select auth.uid()) in(sender,recipient) or
       (group_id is not null and public.can_read_study_group_message(id)));

create or replace function public.study_chat_summaries()
returns table(person uuid, group_id uuid, title text, created_at timestamptz, preview text)
language sql stable set search_path='' as $$
 with direct as (
  select distinct on (other.person) other.person, m.created_at, m.body, m.verse, m.attachments, m.removed_at
  from public.friend_messages m
  cross join lateral (select case when m.sender=auth.uid() then m.recipient else m.sender end as person) other
  where m.group_id is null and auth.uid() in(m.sender,m.recipient)
  order by other.person,m.created_at desc,m.id desc
 )
 select d.person,null::uuid,null::text,d.created_at,
  case when d.removed_at is not null then 'Message removed' when d.body<>'' then left(d.body,120)
       when d.verse is not null or d.attachments<>'[]' then 'Shared study material' else '' end
 from direct d
 union all
 select null::uuid,g.id,g.title,coalesce(m.created_at,g.created_at),
  case when m.removed_at is not null then 'Message removed' when m.body<>'' then left(m.body,120)
       when m.attachments<>'[]' then 'Shared study material' else 'Group created' end
 from public.study_groups g
 left join lateral (select * from public.friend_messages f where f.group_id=g.id order by f.created_at desc,f.id desc limit 1) m on true;
$$;

create or replace function public.study_group_roster(p_group uuid)
returns table(id uuid,display_name text) language sql stable security definer set search_path='' as $$
 select p.id,p.display_name from public.study_group_members m join public.profiles p on p.id=m.user_id
 where m.group_id=p_group and public.is_study_group_member(p_group)
 and not public.community_blocked(auth.uid(),m.user_id)
 order by p.display_name,p.id;
$$;

create or replace function public.create_study_group(p_title text,p_people uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); group_key uuid; members uuid[];
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor) then raise exception 'Save your profile first'; end if;
 if coalesce(length(btrim(p_title)),0) not between 1 and 80 or coalesce(cardinality(p_people),0) not between 2 and 11 then
  raise exception 'Name the group and choose 2 to 11 friends';
 end if;
 if exists(select 1 from unnest(p_people) p where p is null or p=actor or not public.community_friends(actor,p))
 or (select count(distinct p) from unnest(p_people) p)<>cardinality(p_people) then
  raise exception 'Choose distinct accepted friends';
 end if;
 members:=array_append(p_people,actor);
 if exists(select 1 from public.user_blocks where blocker=any(members) and blocked=any(members)) then
  raise exception 'This combination of friends cannot join a group';
 end if;
 perform public.community_rate('request',30,86400);
 insert into public.study_groups(title) values(btrim(p_title)) returning id into group_key;
 insert into public.study_group_members(group_id,user_id) select group_key,unnest(members);
 return group_key;
end;
$$;

create or replace function public.leave_study_group(p_group uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_study_group_member(p_group) then raise exception 'Group unavailable'; end if;
 perform 1 from public.study_groups where id=p_group for update;
 delete from public.study_group_members where group_id=p_group and user_id=auth.uid();
 delete from public.study_groups g where g.id=p_group and not exists(select 1 from public.study_group_members where group_id=g.id);
end;
$$;

create or replace function public.send_study_message(p_id uuid,p_person uuid,p_group uuid,p_body text,p_attachments jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item jsonb; ref jsonb; body_text text:=btrim(coalesce(p_body,'')); saved uuid;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor) then raise exception 'Save your profile first'; end if;
 if p_id is null or (p_person is null)=(p_group is null) then raise exception 'Choose a conversation'; end if;
 if p_group is not null then
  perform 1 from public.study_groups where id=p_group for share;
  if not public.is_study_group_member(p_group) then raise exception 'Group unavailable'; end if;
  if exists(select 1 from public.study_group_members m where m.group_id=p_group and public.community_blocked(actor,m.user_id)) then
   raise exception 'You cannot send to this group while a block is active between you and a member';
  end if;
 elsif not public.community_friends(actor,p_person) then raise exception 'Only accepted friends can send messages';
 end if;
 if p_attachments is null or jsonb_typeof(p_attachments)<>'array' then raise exception 'Invalid attachments'; end if;
 if jsonb_array_length(p_attachments)>12 or octet_length(p_attachments::text)>1000000 or length(body_text)>4000
 or (body_text='' and p_attachments='[]') then raise exception 'Write a message or attach up to 12 items totaling less than 1 MB'; end if;
 for item in select value from jsonb_array_elements(p_attachments) loop
  if jsonb_typeof(item)<>'object' then raise exception 'Invalid attachment'; end if;
  ref:=item->'reference';
  if coalesce(jsonb_typeof(ref),'')<>'object' or ref - array['book','chapter','verse','endVerse','translation'] <> '{}'
   or coalesce(ref->>'book','')!~'^[A-Z0-9]{3}$' or coalesce(ref->>'chapter','')!~'^[1-9][0-9]{0,2}$'
   or coalesce(ref->>'verse','')!~'^[1-9][0-9]{0,2}$' or coalesce(ref->>'translation','')!~'^[A-Za-z0-9_-]{1,40}$'
   or (ref ? 'endVerse' and coalesce(ref->>'endVerse','')!~'^[1-9][0-9]{0,2}$') then raise exception 'Invalid passage'; end if;
  if coalesce((ref->>'endVerse')::int,(ref->>'verse')::int)<(ref->>'verse')::int then raise exception 'Invalid passage range'; end if;
  case item->>'kind'
   when 'passage' then
    if item - array['kind','reference'] <> '{}' then raise exception 'Invalid passage attachment'; end if;
   when 'note' then
    if item - array['kind','reference','text'] <> '{}' or coalesce(jsonb_typeof(item->'text'),'')<>'string'
     or coalesce(length(btrim(item->>'text')),0) not between 1 and 200000 then raise exception 'Shared notes must contain 1 to 200,000 characters'; end if;
   else raise exception 'Invalid attachment';
  end case;
 end loop;
 -- Retries with the same ID are safe. Never treat a different destination as a successful retry.
 if exists(select 1 from public.friend_messages where id=p_id and sender=actor
  and recipient is not distinct from p_person and group_id is not distinct from p_group) then return p_id; end if;
 perform public.community_rate('send',20,60);
 insert into public.friend_messages(id,sender,recipient,group_id,body,attachments)
 values(p_id,actor,p_person,p_group,body_text,p_attachments) on conflict(id) do nothing returning id into saved;
 if saved is null and not exists(select 1 from public.friend_messages where id=p_id and sender=actor
  and recipient is not distinct from p_person and group_id is not distinct from p_group) then raise exception 'Message ID unavailable'; end if;
 return p_id;
end;
$$;

-- Extend the existing moderation RPC without widening who may report a message.
create or replace function public.submit_community_report(p_category text,p_details text,p_subject uuid default null,p_message uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare reporter_id uuid:=auth.uid(); message public.friend_messages; snapshot jsonb;
begin
 if reporter_id is null then raise exception 'Sign in required'; end if;
 if p_category is null or p_category not in ('abuse','privacy','support','accessibility') then raise exception 'Invalid community report category'; end if;
 if p_message is not null then
  select * into message from public.friend_messages where id=p_message and sender<>reporter_id and removed_at is null
  and (recipient=reporter_id or (public.is_study_group_member(group_id) and not public.community_blocked(reporter_id,sender)));
  if not found or p_subject is distinct from message.sender or p_category<>'abuse' then raise exception 'Message unavailable for this report'; end if;
  snapshot:=jsonb_build_object('sender',message.sender,'recipient',message.recipient,'group',message.group_id,'body',message.body,
   'verse',message.verse,'attachments',message.attachments,'created_at',message.created_at);
 end if;
 if (select count(*) from public.community_reports where reporter=reporter_id and created_at>now()-interval '1 day')>=10 then
  raise exception 'Daily report limit reached';
 end if;
 perform public.community_rate('report',10,86400);
 insert into public.community_reports(reporter,subject,message_id,category,details,evidence)
 values(reporter_id,coalesce(message.sender,p_subject),p_message,p_category,trim(p_details),snapshot);
end;
$$;

-- Older clients still retract via community_action. Strip attachments when a tombstone is written.
create or replace function public.clear_retracted_study_attachments()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.removed_at is not null then new.attachments:='[]'; end if;
 return new;
end;
$$;
drop trigger if exists clear_retracted_study_attachments on public.friend_messages;
create trigger clear_retracted_study_attachments before update of removed_at on public.friend_messages
 for each row execute function public.clear_retracted_study_attachments();

revoke all on function public.study_chat_summaries(),public.study_group_roster(uuid),public.create_study_group(text,uuid[]),
 public.leave_study_group(uuid),public.send_study_message(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.study_chat_summaries(),public.study_group_roster(uuid),public.create_study_group(text,uuid[]),
 public.leave_study_group(uuid),public.send_study_message(uuid,uuid,uuid,text,jsonb) to authenticated;

commit;
