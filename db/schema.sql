-- Private study records. Run once for this application's Supabase project.
create table if not exists public.study_entries (
 user_id uuid not null references auth.users(id) on delete cascade,
 passage text not null check (passage ~ '^[A-Z0-9]{3}\.[1-9][0-9]{0,2}\.[1-9][0-9]{0,2}(-[1-9][0-9]{0,2})?$'),
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and length(payload::text) <= 250000),
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 primary key(user_id, passage)
);
alter table public.study_entries enable row level security;
create policy "Study records belong to their user" on public.study_entries for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.study_entries to authenticated;
revoke all on public.study_entries from anon;
create table if not exists public.study_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 settings jsonb not null default '{}'::jsonb check (length(settings::text) <= 10000)
);
alter table public.study_preferences enable row level security;
create policy "Preferences belong to their user" on public.study_preferences for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.study_preferences to authenticated;
revoke all on public.study_preferences from anon;
-- Compare-and-swap prevents silently replacing another device's note.
create or replace function public.save_study_entry(p_passage text, p_payload jsonb, p_revision bigint)
returns setof public.study_entries language plpgsql security invoker set search_path = public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_revision = 0 then
  return query insert into public.study_entries(user_id,passage,payload)
   values(auth.uid(),p_passage,p_payload) on conflict do nothing returning *;
 else
  return query update public.study_entries set payload=p_payload, revision=revision+1,updated_at=now()
   where user_id=auth.uid() and passage=p_passage and revision=p_revision returning *;
 end if;
 if not found then raise exception 'This passage changed on another device. Resolve the conflict before saving.' using errcode='40001'; end if;
end; $$;
revoke all on function public.save_study_entry(text,jsonb,bigint) from public,anon;
grant execute on function public.save_study_entry(text,jsonb,bigint) to authenticated;
