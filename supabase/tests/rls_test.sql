-- RLS · RPC 검증. 트랜잭션 안에서 가짜 사용자 둘을 만들고 전부 assert 한 뒤 롤백한다.
-- 실행: 대시보드 SQL Editor 에 통째로 붙여 Run. 기대: "Success. No rows returned".
-- 하나라도 틀리면 "ASSERT failed: <메시지>" 로 멈춘다.
begin;

insert into auth.users (id, instance_id, aud, role, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', '{"name":"테스트A"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', '{"name":"테스트B"}', now(), now());

-- 가입 트리거가 프로필을 만들었나
do $$ begin
  assert (select nickname from public.profiles
          where id = '11111111-1111-4111-8111-111111111111') = '테스트A',
    '가입 트리거가 profiles 를 안 만들었다';
end $$;

-- ── A 로 로그인한 척 ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- 한 트랜잭션 안에서는 now() 가 시작 시각으로 고정된다. 생성 시각을 한 시간 전으로 넣어야
-- 뒤의 update 에서 touch 트리거가 updated_at 을 now() 로 올린 것이 보인다.
insert into public.invitations (id, data, created_at, updated_at)
values ('aaaaaaaa', '{"g":{"n":"A"}}', now() - interval '1 hour', now() - interval '1 hour');

do $$ begin
  assert (select owner from public.invitations where id = 'aaaaaaaa')
         = '11111111-1111-4111-8111-111111111111', 'owner 기본값이 auth.uid() 가 아니다';
  assert (select count(*) from public.invitations where id = 'aaaaaaaa') = 1, 'A 가 자기 것을 못 본다';
  assert public.get_invitation('aaaaaaaa')->'g'->>'n' = 'A', '소유자는 미발행도 RPC 로 읽어야 한다';
end $$;

-- ── B 로 전환 ──
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

do $$ begin
  assert (select count(*) from public.invitations where id = 'aaaaaaaa') = 0, 'B 가 A 것을 본다';
  assert public.get_invitation('aaaaaaaa') is null, 'B 가 A 의 미발행을 RPC 로 읽는다';
end $$;

update public.invitations set data = '{"g":{"n":"B가 고침"}}' where id = 'aaaaaaaa';   -- 0건이어야 한다

-- 남의 owner 로는 못 넣는다
do $$ begin
  begin
    insert into public.invitations (id, owner, data)
    values ('bbbbbbbb', '11111111-1111-4111-8111-111111111111', '{}');
    raise exception 'B 가 A 명의로 넣었다';
  exception when insufficient_privilege then null;   -- RLS with check 위반 = 42501
  end;
end $$;

-- ── anon ──
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$ begin
  assert public.get_invitation('aaaaaaaa') is null, '미발행이 anon 에게 보인다';
  begin
    perform * from public.invitations;
    raise exception 'anon 이 테이블을 직접 읽었다';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── A 가 발행 ──
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$ begin
  assert (select data->'g'->>'n' from public.invitations where id = 'aaaaaaaa') = 'A',
    'B 의 update 가 먹었다';
end $$;

update public.invitations set published_at = now() where id = 'aaaaaaaa';

do $$ begin
  assert (select updated_at = now() and updated_at > created_at from public.invitations where id = 'aaaaaaaa'),
    'touch 트리거가 updated_at 을 안 올렸다';
end $$;

-- 20개 상한. A 는 이미 1개 → 19개 더 넣고 21번째가 막혀야 한다
insert into public.invitations (id, data)
select 'aaaaaa' || lpad(g::text, 2, '0'), '{}'::jsonb from generate_series(1, 19) g;

do $$ begin
  begin
    insert into public.invitations (id, data) values ('aaaaaa99', '{}');
    raise exception '21번째가 들어갔다';
  exception when raise_exception then
    if sqlerrm not like 'INVITATION_LIMIT%' then raise; end if;
  end;
end $$;

-- ── anon 이 발행본을 읽는다 ──
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$ begin
  assert public.get_invitation('aaaaaaaa')->'g'->>'n' = 'A', '발행했는데 anon 이 못 읽는다';
  assert public.get_invitation('zzzzzzzz') is null, '없는 id 가 null 이 아니다';
end $$;

rollback;
