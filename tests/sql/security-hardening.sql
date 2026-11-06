-- Run on a disposable database after applying the community, moderation,
-- and security-hardening migrations. Fixture writes are rolled back.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000081','sender-security-fixture@example.test'),
 ('00000000-0000-4000-8000-000000000082','recipient-security-fixture@example.test'),
 ('00000000-0000-4000-8000-000000000083','other-security-fixture@example.test');
insert into public.friend_messages(id,sender,recipient,body) values
 ('00000000-0000-4000-8000-000000000084','00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000082','Fixture message');
insert into public.user_blocks(blocker,blocked) values
 ('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000082');
insert into moderation.bans(id,user_id,email,reason,appeal_token) values
 ('00000000-0000-4000-8000-000000000085','00000000-0000-4000-8000-000000000081','ban-security-fixture@example.test','Fixture ban reason','00000000-0000-4000-8000-000000000086');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000082',true);
do $$
begin
 begin
  perform public.submit_community_report('abuse','Fixture report for wrong subject','00000000-0000-4000-8000-000000000083','00000000-0000-4000-8000-000000000084');
  raise exception 'Accepted a mismatched report';
 exception when raise_exception then
  if sqlerrm<>'Message unavailable for this report' then raise; end if;
 end;
 begin
  perform public.submit_community_report('appeal','Fixture appeal without ban');
  raise exception 'Accepted an unverified appeal';
 exception when raise_exception then
  if sqlerrm<>'Invalid community report category' then raise; end if;
 end;
 perform public.submit_community_report('abuse','Fixture verified report','00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000084');
 if not exists(select 1 from public.community_reports where details='Fixture verified report' and evidence->>'sender'=subject::text and evidence->>'recipient'=reporter::text) then
  raise exception 'Evidence did not preserve the correct identities';
 end if;
end;
$$;
do $$
declare who uuid; expected integer;
begin
 foreach who in array array['00000000-0000-4000-8000-000000000081'::uuid,'00000000-0000-4000-8000-000000000082'::uuid,'00000000-0000-4000-8000-000000000083'::uuid] loop
  perform set_config('request.jwt.claim.sub',who::text,true);
  expected:=case when who='00000000-0000-4000-8000-000000000081' then 1 else 0 end;
  if (select count(*) from public.user_blocks)<>expected then raise exception 'Block list privacy failed'; end if;
  if public.community_friends('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000082') then
   raise exception 'Blocked or unrelated contact was allowed';
  end if;
  begin
   perform public.community_blocked('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000082');
   raise exception 'Direct block lookup was allowed';
  exception when insufficient_privilege then null;
  end;
 end loop;
end;
$$;
reset role;
set local role service_role;
do $$
begin
 if public.moderation_submit(null,'security-fixture','appeal','Fixture verified appeal','00000000-0000-4000-8000-000000000086')<>'ok'
 or public.moderation_submit(null,'security-fixture','appeal','Fixture duplicate appeal','00000000-0000-4000-8000-000000000086')<>'duplicate' then
  raise exception 'Verified appeals must be one per ban';
 end if;
 if public.reserve_bible_provider_budget('esv',repeat('a',64),3,4)<>0
 or public.reserve_bible_provider_budget('esv',repeat('b',64),2,4)<=0 then
  raise exception 'Shared budget did not cap two different clients';
 end if;
end;
$$;
rollback;
