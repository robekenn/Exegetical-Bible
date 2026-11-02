begin;
alter table public.community_reports add column if not exists status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed'));
create table if not exists public.report_review_events (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.community_reports(id),
 actor uuid references auth.users(id) on delete set null,
 status text not null check(status in ('open','reviewing','resolved','dismissed')),
 note text not null check(length(note) between 1 and 2000),
 created_at timestamptz not null default now()
);
alter table public.report_review_events enable row level security;
revoke all on public.report_review_events from anon,authenticated;
create or replace function public.review_community_report(p_report uuid,p_actor uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path=public as $$
begin
 if p_status not in ('open','reviewing','resolved','dismissed') or length(trim(p_note)) not between 1 and 2000 then raise exception 'Invalid review'; end if;
 update public.community_reports set status=p_status where id=p_report;
 if not found then raise exception 'Report not found'; end if;
 insert into public.report_review_events(report_id,actor,status,note) values(p_report,p_actor,p_status,trim(p_note));
end; $$;
revoke all on function public.review_community_report(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_community_report(uuid,uuid,text,text) to service_role;
grant select on public.report_review_events to service_role;
commit;
