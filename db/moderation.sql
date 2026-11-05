begin;
-- Apply after db/admin.sql. All moderation data is behind service-only functions.
create schema if not exists moderation;
revoke all on schema moderation from public, anon, authenticated;
create table if not exists moderation.admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists moderation.bans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 email text not null,
 reason text not null check(length(reason) between 10 and 2000),
 appeal_token uuid not null unique default gen_random_uuid(),
 created_at timestamptz not null default now(),
 lifted_at timestamptz,
 email_status text not null default 'pending' check(email_status in ('pending','sending','sent','failed')),
 email_attempt uuid,
 email_attempted_at timestamptz
);
create unique index if not exists moderation_active_ban_email on moderation.bans(email) where lifted_at is null;
create table if not exists moderation.audit (
 id bigint generated always as identity primary key,
 actor uuid not null,
 target uuid not null,
 action text not null,
 reason text,
 created_at timestamptz not null default now()
);
create table if not exists moderation.submission_limits (
 bucket text primary key,
 day date not null,
 hits integer not null
);

alter table public.community_reports drop constraint if exists community_reports_category_check;
alter table public.community_reports add constraint community_reports_category_check
 check(category in ('abuse','privacy','support','accessibility','bug','feedback','appeal'));
alter table public.community_reports add column if not exists ban_id uuid references moderation.bans(id);
create unique index if not exists moderation_one_appeal on public.community_reports(ban_id) where ban_id is not null;

create or replace function moderation.block_banned_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exegetical-ban:'||lower(trim(new.email)),0));
 if exists(select 1 from moderation.bans where email=lower(trim(new.email)) and lifted_at is null) then
  raise exception 'This email is blocked from registration';
 end if;
 return new;
end;
$$;
drop trigger if exists exegetical_block_banned_email on auth.users;
create trigger exegetical_block_banned_email before insert or update of email on auth.users
 for each row execute function moderation.block_banned_email();

create or replace function public.moderation_is_admin(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from moderation.admins where user_id=p_user);
$$;

create or replace function public.moderation_users(p_search text,p_offset integer,p_owners uuid[])
returns table(id uuid,email text,username text,display_name text,created_at timestamptz,role text)
language sql stable security definer set search_path='' as $$
 select u.id,u.email::text,p.username,p.display_name,u.created_at,
  case when u.id=any(p_owners) then 'owner' when a.user_id is not null then 'admin' else 'member' end
 from auth.users u
 left join public.profiles p on p.id=u.id
 left join moderation.admins a on a.user_id=u.id
 where p_search='' or strpos(lower(coalesce(u.email,'')),lower(p_search))>0
  or strpos(lower(coalesce(p.username,'')),lower(p_search))>0
  or strpos(lower(coalesce(p.display_name,'')),lower(p_search))>0 or u.id::text=p_search
 order by u.created_at desc,u.id offset greatest(0,p_offset) limit 26;
$$;

create or replace function public.moderation_change(p_actor uuid,p_target uuid,p_action text,p_reason text,p_owners uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare target_email text; ban uuid; actor_owner boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(731892145);
 actor_owner := coalesce(p_actor=any(p_owners),false);
 if not actor_owner and not public.moderation_is_admin(p_actor) then
  raise exception using errcode='42501',message='Administrator access required.';
 end if;
 if p_action='lift' then
  update moderation.bans set lifted_at=now() where id=p_target and lifted_at is null returning id into ban;
  if ban is null then raise exception using errcode='P0001',message='This ban is no longer active.'; end if;
  insert into moderation.audit(actor,target,action,reason) values(p_actor,ban,p_action,p_reason);
  return ban;
 end if;
 if p_target=p_actor or p_target=any(p_owners) then
  raise exception using errcode='42501',message='This account is protected.';
 end if;
 select lower(trim(email)) into target_email from auth.users where id=p_target for update;
 if not found then raise exception using errcode='P0001',message='That account no longer exists.'; end if;
 if p_action in ('promote','demote') then
  if not actor_owner then raise exception using errcode='42501',message='Only owners can change admin roles.'; end if;
  if p_action='promote' then
   insert into moderation.admins(user_id) values(p_target) on conflict do nothing;
  else
   delete from moderation.admins where user_id=p_target;
  end if;
 elsif p_action='ban' then
  if public.moderation_is_admin(p_target) then
   raise exception using errcode='42501',message='An owner must remove this account’s admin role before banning it.';
  end if;
  if target_email is null or target_email='' then
   raise exception using errcode='P0001',message='This account has no email address to block.';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 10 and 2000 then
   raise exception using errcode='P0001',message='Enter a reason of 10–2000 characters.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exegetical-ban:'||target_email,0));
  insert into moderation.bans(user_id,email,reason) values(p_target,target_email,trim(p_reason)) returning id into ban;
  delete from auth.users where id=p_target;
 else
  raise exception using errcode='P0001',message='Invalid moderation action.';
 end if;
 insert into moderation.audit(actor,target,action,reason) values(p_actor,p_target,p_action,p_reason);
 return ban;
end;
$$;

create or replace function public.moderation_bans(p_offset integer,p_id uuid)
returns table(id uuid,email text,reason text,created_at timestamptz,lifted_at timestamptz,email_status text)
language sql stable security definer set search_path='' as $$
 select b.id,b.email,b.reason,b.created_at,b.lifted_at,b.email_status from moderation.bans b
 where p_id is null or b.id=p_id
 order by b.created_at desc,b.id offset greatest(0,p_offset) limit 26;
$$;

create or replace function public.moderation_audit(p_offset integer)
returns table(actor uuid,target uuid,action text,reason text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select a.actor,a.target,a.action,a.reason,a.created_at from moderation.audit a
 order by a.id desc offset greatest(0,p_offset) limit 26;
$$;

create or replace function public.moderation_claim_email(p_ban uuid)
returns table(email text,reason text,appeal_token uuid,attempt uuid)
language sql security definer set search_path='' as $$
 update moderation.bans b set email_status='sending',email_attempt=gen_random_uuid(),email_attempted_at=now()
 where b.id=p_ban and b.lifted_at is null and
 (b.email_status in ('pending','failed') or (b.email_status='sending' and b.email_attempted_at<now()-interval '5 minutes'))
 returning b.email,b.reason,b.appeal_token,b.email_attempt;
$$;

create or replace function public.moderation_finish_email(p_ban uuid,p_attempt uuid,p_sent boolean)
returns void language sql security definer set search_path='' as $$
 update moderation.bans set email_status=case when p_sent then 'sent' else 'failed' end
 where id=p_ban and email_attempt=p_attempt and email_status='sending';
$$;

create or replace function public.moderation_submit(p_actor uuid,p_bucket text,p_category text,p_details text,p_token uuid)
returns text language plpgsql security definer set search_path='' as $$
declare count_today integer; ban uuid;
begin
 if p_category not in ('bug','feedback','appeal') or length(trim(p_details)) not between 10 and 3000 then return 'invalid'; end if;
 insert into moderation.submission_limits(bucket,day,hits) values(p_bucket,current_date,1)
 on conflict(bucket) do update set day=current_date,
  hits=case when moderation.submission_limits.day=current_date then moderation.submission_limits.hits+1 else 1 end
 returning hits into count_today;
 if count_today>10 then return 'limited'; end if;
 if p_category='appeal' then
  select id into ban from moderation.bans where appeal_token=p_token and lifted_at is null;
  if ban is null then return 'invalid_appeal'; end if;
 end if;
 insert into public.community_reports(reporter,category,details,ban_id)
 values(p_actor,p_category,trim(p_details),ban)
 on conflict(ban_id) where ban_id is not null do nothing;
 if not found then return 'duplicate'; end if;
 return 'ok';
end;
$$;

revoke all on function moderation.block_banned_email() from public,anon,authenticated;
revoke all on function public.moderation_is_admin(uuid),public.moderation_users(text,integer,uuid[]),
 public.moderation_change(uuid,uuid,text,text,uuid[]),public.moderation_bans(integer,uuid),
 public.moderation_audit(integer),public.moderation_claim_email(uuid),public.moderation_finish_email(uuid,uuid,boolean),
 public.moderation_submit(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.moderation_is_admin(uuid),public.moderation_users(text,integer,uuid[]),
 public.moderation_change(uuid,uuid,text,text,uuid[]),public.moderation_bans(integer,uuid),
 public.moderation_audit(integer),public.moderation_claim_email(uuid),public.moderation_finish_email(uuid,uuid,boolean),
 public.moderation_submit(uuid,text,text,text,uuid) to service_role;
create table if not exists moderation.appeal_decisions (
 report_id uuid primary key references public.community_reports(id),
 decision text not null check(decision in ('accepted','denied')),
 reason text not null check(length(reason) between 10 and 2000),
 created_at timestamptz not null default now(),
 email_status text not null default 'pending' check(email_status in ('pending','sending','sent','failed')),
 email_attempt uuid,
 email_attempted_at timestamptz
);

create or replace function public.moderation_decide_appeal(p_actor uuid,p_report uuid,p_decision text,p_reason text,p_owners uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare ban uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(731892145);
 if not coalesce(p_actor=any(p_owners),false) and not public.moderation_is_admin(p_actor) then
  raise exception using errcode='42501',message='Administrator access required.';
 end if;
 if p_decision is null or p_decision not in ('accepted','denied') or p_reason is null or length(trim(p_reason)) not between 10 and 2000 then
  raise exception using errcode='P0001',message='Choose a decision and enter a reason of 10–2000 characters.';
 end if;
 select ban_id into ban from public.community_reports where id=p_report and category='appeal' for update;
 if ban is null then raise exception using errcode='P0001',message='Appeal not found.'; end if;
 if exists(select 1 from moderation.appeal_decisions where report_id=p_report) then
  raise exception using errcode='P0001',message='This appeal already has a decision.';
 end if;
 if p_decision='denied' and exists(select 1 from moderation.bans where id=ban and lifted_at is not null) then
  raise exception using errcode='P0001',message='The block has already been lifted. Record an accepted decision instead.';
 end if;
 if p_decision='accepted' then
  update moderation.bans set lifted_at=now() where id=ban and lifted_at is null;
 end if;
 insert into moderation.appeal_decisions(report_id,decision,reason) values(p_report,p_decision,trim(p_reason));
 update public.community_reports set status='resolved' where id=p_report;
 insert into public.report_review_events(report_id,actor,status,note)
 values(p_report,p_actor,'resolved',trim(p_reason));
 insert into moderation.audit(actor,target,action,reason)
 values(p_actor,ban,'appeal_'||p_decision,trim(p_reason));
end;
$$;

create or replace function public.moderation_appeal_status(p_report uuid)
returns table(decision text,reason text,email_status text)
language sql stable security definer set search_path='' as $$
 select d.decision,d.reason,d.email_status from moderation.appeal_decisions d where d.report_id=p_report;
$$;

create or replace function public.moderation_claim_appeal_email(p_report uuid)
returns table(email text,reason text,decision text,attempt uuid)
language sql security definer set search_path='' as $$
 update moderation.appeal_decisions d set email_status='sending',email_attempt=gen_random_uuid(),email_attempted_at=now()
 from public.community_reports r join moderation.bans b on b.id=r.ban_id
 where d.report_id=p_report and r.id=d.report_id and
 (d.email_status in ('pending','failed') or (d.email_status='sending' and d.email_attempted_at<now()-interval '5 minutes'))
 returning b.email,d.reason,d.decision,d.email_attempt;
$$;

create or replace function public.moderation_finish_appeal_email(p_report uuid,p_attempt uuid,p_sent boolean)
returns void language sql security definer set search_path='' as $$
 update moderation.appeal_decisions set email_status=case when p_sent then 'sent' else 'failed' end
 where report_id=p_report and email_attempt=p_attempt and email_status='sending';
$$;

revoke all on function public.moderation_decide_appeal(uuid,uuid,text,text,uuid[]),
 public.moderation_appeal_status(uuid),public.moderation_claim_appeal_email(uuid),
 public.moderation_finish_appeal_email(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.moderation_decide_appeal(uuid,uuid,text,text,uuid[]),
 public.moderation_appeal_status(uuid),public.moderation_claim_appeal_email(uuid),
 public.moderation_finish_appeal_email(uuid,uuid,boolean) to service_role;
-- Keep ordinary review updates from reopening or closing a decided appeal.
create or replace function public.review_community_report(p_report uuid,p_actor uuid,p_status text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare kind text;
begin
 if p_status is null or p_status not in ('open','reviewing','resolved','dismissed')
  or p_note is null or length(trim(p_note)) not between 1 and 2000 then
  raise exception using errcode='P0001',message='Invalid review.';
 end if;
 select category into kind from public.community_reports where id=p_report for update;
 if not found then raise exception using errcode='P0001',message='Report not found.'; end if;
 if kind='appeal' and (p_status in ('resolved','dismissed') or
  exists(select 1 from moderation.appeal_decisions where report_id=p_report)) then
  raise exception using errcode='P0001',message='Use the appeal decision controls to close an appeal.';
 end if;
 update public.community_reports set status=p_status where id=p_report;
 insert into public.report_review_events(report_id,actor,status,note) values(p_report,p_actor,p_status,trim(p_note));
end;
$$;
commit;
