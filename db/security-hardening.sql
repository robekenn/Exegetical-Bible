begin;

-- The symmetric block check is internal to the definer RPCs. The exposed
-- friendship helper still returns only whether the caller can contact someone.
revoke all on function public.community_blocked(uuid,uuid) from public,anon,authenticated;

create or replace function public.submit_community_report(p_category text,p_details text,p_subject uuid default null,p_message uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare reporter_id uuid:=auth.uid(); message public.friend_messages; snapshot jsonb;
begin
 if reporter_id is null then raise exception 'Sign in required'; end if;
 if p_category is null or p_category not in ('abuse','privacy','support','accessibility') then
  raise exception 'Invalid community report category';
 end if;
 if p_message is not null then
  select * into message from public.friend_messages where id=p_message and recipient=reporter_id and removed_at is null;
  if not found or p_subject is distinct from message.sender or p_category<>'abuse' then
   raise exception 'Message unavailable for this report';
  end if;
  snapshot:=jsonb_build_object('sender',message.sender,'recipient',message.recipient,'body',message.body,
   'verse',message.verse,'created_at',message.created_at);
 end if;
 if (select count(*) from public.community_reports where reporter=reporter_id and created_at>now()-interval '1 day')>=10 then
  raise exception 'Daily report limit reached';
 end if;
 perform public.community_rate('report',10,86400);
 insert into public.community_reports(reporter,subject,message_id,category,details,evidence)
 values(reporter_id,coalesce(message.sender,p_subject),p_message,p_category,trim(p_details),snapshot);
end;
$$;

-- Preserve suspect historical evidence, but do not present it as verified.
update public.community_reports r set evidence=r.evidence||jsonb_build_object('sender',m.sender,'recipient',m.recipient)
from public.friend_messages m
where r.message_id=m.id and r.evidence is not null and not (r.evidence ? 'sender');

-- Keep the original details available as a dismissed support submission.
update public.community_reports
set category='support',status='dismissed'
where category='appeal' and ban_id is null;
alter table public.community_reports drop constraint if exists community_reports_verified_appeal;
alter table public.community_reports add constraint community_reports_verified_appeal
 check ((category='appeal')=(ban_id is not null));

create table if not exists moderation.provider_budgets(
 provider text not null, bucket text not null, window_start timestamptz not null,
 hits integer not null, primary key(provider,bucket,window_start)
);
create index if not exists provider_budgets_window on moderation.provider_budgets(window_start);
revoke all on moderation.provider_budgets from public,anon,authenticated;

create or replace function public.reserve_bible_provider_budget(
 p_provider text,p_client text,p_cost integer,p_daily_limit integer
) returns integer language plpgsql security definer set search_path='' as $$
declare
 stamp timestamptz; minute_start timestamptz; hour_start timestamptz; day_start timestamptz;
 quota record;
 used integer;
begin
 if p_provider is null or p_provider not in ('esv','api-bible') or p_client is null or p_client !~ '^[a-f0-9]{64}$'
 or p_cost is null or p_cost not between 1 and 3 or p_daily_limit is null or p_daily_limit not between 1 and 4000 then
  raise exception 'Invalid provider budget';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('exegetical-provider:'||p_provider,0));
 stamp:=clock_timestamp();
 minute_start:=date_trunc('minute',stamp,'UTC');
 hour_start:=date_trunc('hour',stamp,'UTC');
 day_start:=date_trunc('day',stamp,'UTC');
 for quota in select * from (values
  ('client:'||p_client,minute_start,60,12),
  ('minute',minute_start,60,case when p_provider='esv' then 29 else 45 end),
  ('hour',hour_start,3600,case when p_provider='esv' then 490 else 800 end),
  ('day',day_start,86400,least(p_daily_limit,case when p_provider='esv' then 2400 else 4000 end))
 ) as limits(bucket,starts,seconds,maximum)
 loop
  select hits into used from moderation.provider_budgets where provider=p_provider and bucket=quota.bucket and window_start=quota.starts;
  if coalesce(used,0)+p_cost>quota.maximum then
   return greatest(1,ceil(extract(epoch from quota.starts+make_interval(secs=>quota.seconds)-stamp))::integer);
  end if;
 end loop;
 delete from moderation.provider_budgets where provider=p_provider and window_start<stamp-interval '2 days';
 insert into moderation.provider_budgets(provider,bucket,window_start,hits)
 values(p_provider,'client:'||p_client,minute_start,p_cost),(p_provider,'minute',minute_start,p_cost),
 (p_provider,'hour',hour_start,p_cost),(p_provider,'day',day_start,p_cost)
 on conflict(provider,bucket,window_start) do update set hits=moderation.provider_budgets.hits+excluded.hits;
 return 0;
end;
$$;
revoke all on function public.reserve_bible_provider_budget(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_bible_provider_budget(text,text,integer,integer) to service_role;
commit;
