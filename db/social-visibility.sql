begin;
-- Past conversations retain their IDs but do not reveal new profile details after unfriending.
create or replace function public.list_study_people() returns table(id uuid,username text,display_name text,avatar text) language sql stable security definer set search_path=public as $$
 with contacts as (
 select p.*, (p.id=auth.uid() or exists(select 1 from public.friendships f where(f.requester=auth.uid() and f.recipient=p.id)or(f.recipient=auth.uid() and f.requester=p.id))) as visible
 from public.profiles p where auth.uid() is not null and(p.id=auth.uid() or exists(select 1 from public.friendships f where(f.requester=auth.uid() and f.recipient=p.id)or(f.recipient=auth.uid() and f.requester=p.id))or exists(select 1 from public.friend_messages m where(m.sender=auth.uid() and m.recipient=p.id)or(m.recipient=auth.uid() and m.sender=p.id))or exists(select 1 from public.user_blocks b where b.blocker=auth.uid() and b.blocked=p.id))
 ) select c.id,case when c.visible then c.username else null end,case when c.visible then c.display_name else null end,case when c.visible then c.avatar else null end from contacts c;
$$;
revoke all on function public.list_study_people() from public,anon;
grant execute on function public.list_study_people() to authenticated;
commit;
