begin;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000151','beta-fixture@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000151',true);
do $$begin
 if beta_private.enabled() then raise exception 'Ordinary user has beta access';end if;
 if exists(select 1 from public.reading_plan_versions) then raise exception 'Ordinary user reads beta plans';end if;
 begin perform public.beta_state(auth.uid(),'{}',true);raise exception 'User enabled own beta role';exception when insufficient_privilege then null;end;
end;$$;
reset role;
insert into beta_private.testers values('00000000-0000-4000-8000-000000000151');
set local role authenticated;
do $$begin
 if not beta_private.enabled() then raise exception 'Tester denied';end if;
 if (select count(*) from public.reading_plan_versions)<>3 then raise exception 'Tester cannot read plans';end if;
end;$$;
reset role;
select public.beta_state('00000000-0000-4000-8000-000000000151','{}',false);
set local role authenticated;
do $$begin
 if beta_private.enabled() or exists(select 1 from public.reading_plan_versions) then raise exception 'Preview off failed';end if;
end;$$;
reset role;
delete from beta_private.preferences where user_id='00000000-0000-4000-8000-000000000151';
delete from beta_private.testers where user_id='00000000-0000-4000-8000-000000000151';
set local role authenticated;
do $$begin if beta_private.enabled() then raise exception 'Role revocation failed';end if;end;$$;
rollback;
