# 계정 · 서버저장 · 짧은주소 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카카오 로그인으로 청첩장을 Supabase 에 저장하고 `invite.html?id=k3n9x2ab` 8자 주소를 내준다. 호스팅을 Cloudflare Pages 로 옮기고, 무료 플랜 운영(핑 · 백업)을 깐다.

**Architecture:** 정적 3장은 그대로다. `invite.html` 은 라이브러리 없이 RPC 한 번을 `fetch` 한다. `make.html` 만 supabase-js(UMD) 를 얹어 로그인 · 저장 · 발행을 한다. 접근 규칙은 전부 RLS 와 RPC 에 있고 서버 코드는 없다. 스펙: [`docs/superpowers/specs/2026-09-08-auth-server-storage-design.md`](../specs/2026-09-08-auth-server-storage-design.md).

**Tech Stack:** Supabase Free (Postgres · Auth Kakao · PostgREST), `@supabase/supabase-js@2` UMD (jsDelivr), Supabase CLI 2.109 (`/opt/homebrew/bin/supabase`), Cloudflare Pages Free, GitHub Actions (비공개 저장소), UptimeRobot.

**테스트 방식:** 이 프로젝트는 빌드와 테스트 러너가 없다 (README). DB 규칙은 `supabase/tests/rls_test.sql` 이 트랜잭션 안에서 `assert` 하고 롤백한다. 페이지는 `python3 -m http.server 8080` 으로 띄워 브라우저에서 정해진 결과를 확인한다. 각 Task 의 검증 단계에 기대 결과를 적었다.

**누가 하나:** 🧑 표시는 계정 소유자만 할 수 있는 대시보드 작업이다. 나머지는 코드다. 🧑 작업은 심사 · 전파 대기가 있으므로 코드와 병렬로 먼저 시작한다.

---

## 진행 상황 — 2026-10-04 저녁

| Task | 상태 | 메모 |
|---|---|---|
| 0 Supabase 프로젝트 | ✅ | **새 계정**(GitHub `onnitadmin-beep`, org `ONNIT`)에 `onnit` · Seoul · Free. ref `ehzcybacnnhtyikrpsiy`. DB 비밀번호는 대시보드가 생성했고 기록 안 함 — CLI link 전에 Settings → Database 에서 재설정 |
| 1 스키마 | ✅ | SQL Editor 로 적용. CLI 를 link 하면 `migration repair --status applied 20261004000000` 한 번 |
| 2 RLS 테스트 | ✅ | SQL Editor 에서 11개 단언 통과. 실패 단언으로 결과창이 현재 실행을 반영함도 확인 |
| 3 `js/config.js` | ✅ | publishable 키 `sb_publishable_kEc9…` |
| 4 `invite.html` | ✅ | `?id=` · `#d=` · `?to=` 로컬 검증. 발행본 열람은 Task 6 로그인 뒤 |
| 5 카카오 · Auth | ✅ | 카카오 앱 `ONNIT 청첩장`(ID 1597191). **개인 개발자 비즈 앱**으로 전환(아이콘 등록 → 전환 버튼, 본인인증·약관은 계정에 이미 돼 있어 즉시 완료). 동의항목 닉네임 필수 · 프로필 사진 선택 · **카카오계정(이메일) 선택** — 이게 없으면 KOE205. 새 콘솔 경로: Redirect URI 와 Client Secret 은 **[앱] > [플랫폼 키] > REST API 키 > 더보기 > 수정**. Supabase 는 Site URL · Redirect URLs · provider(사용자가 키 입력) · email optional ON |
| 6 `make.html` | ✅ | 로그인 왕복 검증 완료: 저장 → 카카오 동의 → `?code=` 복귀(주소 정리됨) → 보류 저장 이어짐 → 짧은 주소 `?id=` → 미발행 시 하객에게 "아직 발행되지 않았거나 없는 청첩장" → 발행 → 하객 화면에 서버 데이터 렌더 → `&to=` 맞춤 링크 → 캐시 → 새로고침 후 상태 유지. 디자인은 리뷰 반영. **빠진 것: 목록에서 삭제 UI 없음** (RLS 정책은 있다) |
| 7 운영 | ⬜ | **백업은 사용자 결정으로 뺐다 (2026-10-04).** 남는 것은 일시정지 방지 핑 하나 — UptimeRobot 무료 모니터가 `get_invitation` RPC 를 5분마다 부른다. 비공개 저장소 · pg_dump 는 하지 않는다 |
| 8 호스팅 | ◐ | 아직 GitHub Pages. `main` 을 push 해 **운영(wedding.onnit.co.kr)에서 같은 왕복을 검증했다** — 로그인 · 저장 `?id=1f65LV1C` · 미발행 차단 · 발행 · 하객 렌더. Cloudflare Pages 이전은 결제 전까지 하면 된다 |
| 9 문서 | ⬜ | |

**운영 검증 (2026-10-04 밤).** 하위 프로젝트 1 을 `main` 에 머지하고 push 했다. 운영에서 카카오 로그인 왕복과 저장 · 발행 · 열람이 로컬과 같이 동작한다. 테스트로 발행한 청첩장 두 건(`GenFS8zH` 로컬, `1f65LV1C` 운영)이 DB 에 남아 있다 — 삭제 UI 가 없어 Table Editor 에서 지운다.

**옆길로 샌 것.** 처음에 CLI 가 기존 계정에 로그인돼 있어 그 계정 org 에 `onnit`(ref `llacbdnibhewmpsiaglk`)을 만들었다가 새 계정으로 다시 했다. 그 프로젝트는 스키마만 있고 비어 있다. 지울지는 사용자 결정. 리포의 `.env` 와 `supabase/.temp` 는 아직 그 옛 프로젝트를 가리킨다.

**KOE205 함정.** Supabase 의 카카오 provider 는 기본 scope 에 `account_email` 을 넣는다. 비즈 앱이 아니면 그 동의항목이
「권한 없음」이라 카카오가 `잘못된 요청 (KOE205)` 로 막는다. `options.scopes` 는 기본값에 **덧붙기만 하고 빼지 못한다**
(실측: `scope=account_email profile_image profile_nickname profile_nickname profile_image`). 해법은 카카오 쪽이다 —
**개인 개발자 비즈 앱 전환**(앱 아이콘 등록 → 본인인증 → 카카오비즈니스 통합 약관 동의) 뒤 동의항목에서 카카오계정(이메일)을
**선택 동의**로 켠다. Supabase 의 「Allow users without an email」이 켜져 있어 사용자가 이메일을 거부해도 로그인은 된다.
근거: [supabase/supabase#36878](https://github.com/supabase/supabase/issues/36878). 아이콘은 `img/app-icon-512.png`.

**브라우저 캐시 함정.** `css/base.css` 가 9월 8일 이후 안 바뀌어 Chrome 휴리스틱 캐시가 며칠간 옛 파일을 썼다. 로컬에서 CSS 가 안 바뀌어 보이면 `fetch('css/base.css',{cache:'reload'})` 뒤 새로고침.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/config.toml` | `supabase init` 이 만든다. CLI 가 프로젝트를 찾는 표식 |
| `supabase/migrations/20261004000000_init.sql` | 스키마 전부. profiles · invitations · 트리거 · RLS · RPC |
| `supabase/tests/rls_test.sql` | RLS 와 RPC 의 자동 검증. 트랜잭션 안에서 assert 후 롤백 |
| `js/config.js` | Supabase URL 과 anon 키. 두 페이지가 같은 값을 쓴다 (`css/tokens.css` 와 같은 이유) |
| `invite.html` | `?id=` 로딩 · 대기 화면 · 캐시 · 실패 안내 · `baseUrl` 이 `?id=` 를 데리고 가게 |
| `make.html` | 로그인 · 저장 · 발행 · 내 청첩장 목록 · `?id=` 로 열기 |
| `ops/keepalive.yml` `ops/backup.yml` `ops/README.md` | 비공개 백업 저장소로 복사할 워크플로 템플릿 |
| `README.md` `index.html` | 배포 설명과 랜딩 카피를 사실에 맞게 |
| `CNAME` `.nojekyll` | 삭제. GitHub Pages 전용 |

---

## Task 0: 🧑 Supabase 프로젝트 만들기

**산출물:** Project URL · anon(publishable) 키 · project ref · DB 비밀번호. 이 넷을 받아야 Task 1 · 3 · 7 이 진행된다.

- [ ] **Step 1: 프로젝트 생성**

<https://supabase.com/dashboard> → New project. Organization 은 기존 것(없으면 Free 로 하나). 값:

| 항목 | 값 |
|---|---|
| Name | `onnit` (서비스가 늘어도 이 프로젝트 하나를 공유한다 — 스펙 §6) |
| Database Password | 생성 버튼으로 만들고 **비밀번호 관리자에 저장**. Task 7 백업이 쓴다 |
| Region | Northeast Asia (Seoul) |
| Plan | Free |

- [ ] **Step 2: 값 적어 두기**

Project Settings → API 에서 셋을 복사한다.

| 항목 | 어디 | 형태 |
|---|---|---|
| Project URL | API → Project URL | `https://abcdefghijklmnop.supabase.co` |
| anon 키 | API → Project API keys → `anon` `public` (새 대시보드는 `sb_publishable_…`) | 공개용. HTML 에 박힌다 |
| project ref | URL 의 `abcdefghijklmnop` 부분 | Task 1 `supabase link`, Task 5 카카오 Redirect URI |

**service_role 키는 복사하지 않는다.** 이 플랜은 그 키를 쓰는 곳이 없다.

- [ ] **Step 3: 전달**

Project URL · anon 키 · project ref 를 채팅으로 준다. DB 비밀번호는 주지 않는다 (Task 7 에서 GitHub Secret 에 직접 넣는다).

---

## Task 1: 스키마 — 마이그레이션 작성과 적용

**Files:**
- Create: `supabase/config.toml` (CLI 생성)
- Create: `supabase/migrations/20261004000000_init.sql`

- [ ] **Step 1: CLI 초기화**

Run:
```bash
cd /Users/imdoyeong/workSpaces/onnit-wedding-invitation && supabase init
```
Expected: `Generate VS Code settings for Deno? [y/N]` 에 `N`. 그 뒤 `Finished supabase init.` 와 `supabase/config.toml` 생성. (`.gitignore` 에 `supabase/.temp` 가 추가될 수 있다. 그대로 둔다.)

- [ ] **Step 2: 마이그레이션 파일 작성**

`supabase/migrations/20261004000000_init.sql`:

```sql
-- 계정 · 서버저장 · 짧은주소 (하위 프로젝트 1) — 스펙 §4 · §5
-- 서비스가 늘어도 이 프로젝트 하나를 공유한다. profiles 가 그 중심이다.

-- ─────────────────────────── profiles ───────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  nickname   text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;

create policy "own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

-- 카카오로 처음 들어오면 프로필 한 줄을 만든다. 메타데이터 키는 provider 마다 달라
-- 넷을 순서대로 본다. 없으면 null — 닉네임이 비어도 계정은 성립한다 (스펙 §6).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',
             new.raw_user_meta_data->>'preferred_username',
             new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'nickname'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── invitations ───────────────────────────
create table public.invitations (
  id           text primary key check (id ~ '^[A-Za-z0-9]{8}$'),  -- 8자 base62
  owner        uuid not null default auth.uid() references auth.users on delete cascade,
  data         jsonb not null,                 -- 지금 #d= 에 담기던 객체 그대로
  published_at timestamptz,                    -- null 이면 미발행. 결제(하위 프로젝트 4)가 이 값을 채운다
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index invitations_owner_idx on public.invitations (owner, updated_at desc);

-- 목록이 updated_at 으로 정렬되는데 갱신할 주체가 없으면 생성 시각에 머문다.
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger invitations_touch
  before update on public.invitations
  for each row execute function public.touch_updated_at();

-- 계정당 20개. 로그인이 있어도 오용은 가능하다 (스펙 §5).
-- 트리거는 호출자 권한으로 돌아 RLS 아래에서 자기 것만 센다. 그게 정확히 원하는 수다.
create function public.limit_invitations() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.invitations where owner = new.owner) >= 20 then
    raise exception 'INVITATION_LIMIT: 계정당 청첩장은 20개까지입니다';
  end if;
  return new;
end $$;

create trigger invitations_limit
  before insert on public.invitations
  for each row execute function public.limit_invitations();

-- ─────────────────────────── RLS — 여기가 급소 ───────────────────────────
-- data 에 전화번호와 계좌번호가 있다. anon 에게 테이블을 열면 전체 덤프가 된다.
-- 테이블 읽기는 소유자만. 공개 열람은 아래 RPC 로 한 건씩만.
alter table public.invitations enable row level security;
revoke all on public.invitations from anon;

create policy "owner select" on public.invitations
  for select to authenticated using (owner = auth.uid());
create policy "owner insert" on public.invitations
  for insert to authenticated with check (owner = auth.uid());
create policy "owner update" on public.invitations
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner delete" on public.invitations
  for delete to authenticated using (owner = auth.uid());

-- id 를 정확히 아는 사람만 그 한 건을 가져간다. 열거는 불가능하다.
-- 미발행은 소유자에게만 돌아간다 — 하객이 미발행 주소를 열면 null.
create function public.get_invitation(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select data from public.invitations
  where id = p_id
    and (published_at is not null or owner = auth.uid());
$$;

revoke all on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;
```

- [ ] **Step 3: 원격 프로젝트에 연결**

Run (브라우저가 열리고 로그인 한 번):
```bash
supabase login
```
Expected: `You are now logged in. Happy coding!`

Run (Task 0 의 project ref. DB 비밀번호를 물으면 입력):
```bash
cd /Users/imdoyeong/workSpaces/onnit-wedding-invitation && supabase link --project-ref <project-ref>
```
Expected: `Finished supabase link.`

- [ ] **Step 4: 적용**

Run:
```bash
cd /Users/imdoyeong/workSpaces/onnit-wedding-invitation && supabase db push
```
Expected:
```
Applying migration 20261004000000_init.sql...
Finished supabase db push.
```

CLI 가 막히면 대안: 대시보드 → SQL Editor 에 위 파일을 통째로 붙여 Run. `Success. No rows returned`.

**실제로는 이 대안으로 적용했다 (2026-10-04).** 새 계정의 프로젝트 `ehzcybacnnhtyikrpsiy` 에 SQL Editor 로 넣었다.
그래서 `supabase_migrations.schema_migrations` 에 기록이 없다. 나중에 CLI 를 이 프로젝트에 link 하면
`supabase db push` 가 같은 파일을 또 적용하려다 실패한다. link 직후 한 번만:

```bash
supabase migration repair --status applied 20261004000000
```

- [ ] **Step 5: RPC 가 anon 으로 열리는지 확인**

Run (Task 0 의 값으로):
```bash
curl -s -X POST "https://<project-ref>.supabase.co/rest/v1/rpc/get_invitation" \
  -H "apikey: <anon key>" -H "Content-Type: application/json" \
  -d '{"p_id":"nothing1"}'
```
Expected: `null` (없는 id. 200 이고 본문이 `null`)

Run (테이블 직접 읽기는 막혀야 한다):
```bash
curl -s "https://<project-ref>.supabase.co/rest/v1/invitations?select=id" -H "apikey: <anon key>"
```
Expected: `{"code":"42501","details":null,"hint":null,"message":"permission denied for table invitations"}`

- [ ] **Step 6: 커밋**

```bash
git add supabase/config.toml supabase/migrations/20261004000000_init.sql .gitignore
git commit -m "feat(db): 청첩장 스키마 — profiles · invitations · RLS · get_invitation RPC"
```

---

## Task 2: RLS 자동 검증

**Files:**
- Create: `supabase/tests/rls_test.sql`

- [ ] **Step 1: 테스트 작성**

`supabase/tests/rls_test.sql`:

```sql
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
```

- [ ] **Step 2: 실행**

🧑 대시보드 → SQL Editor → 새 쿼리에 파일 내용을 붙여 Run.
Expected: `Success. No rows returned`.
실패하면 메시지가 `ASSERT failed: …` 로 어느 규칙이 깨졌는지 말해 준다. 그 규칙을 Task 1 의 마이그레이션에서 고치고 `supabase db push` 가 아니라 **새 마이그레이션 파일**로 고친다 (이미 적용된 파일은 수정하지 않는다).

- [ ] **Step 3: 커밋**

```bash
git add supabase/tests/rls_test.sql
git commit -m "test(db): RLS · RPC · 20개 상한 검증 SQL"
```

---

## Task 3: 공용 설정 파일

**Files:**
- Create: `js/config.js`

- [ ] **Step 1: 작성** (Task 0 의 값으로 채운다)

`js/config.js`:

```js
/* Supabase 접속 정보.
   anon 키는 공개용이다 — 정적 파일에 박히고 누구나 가진다. 지키는 것은 RLS 다.
   두 페이지가 같은 값을 쓰므로 한 곳에 둔다. css/tokens.css 를 뺀 이유와 같다. */
window.ONNIT = {
  SUPABASE_URL: 'https://<project-ref>.supabase.co',
  SUPABASE_ANON_KEY: '<anon key>'
};
```

- [ ] **Step 2: 확인**

Run:
```bash
cd /Users/imdoyeong/workSpaces/onnit-wedding-invitation && node -e "global.window={};require('./js/config.js');const o=window.ONNIT;if(!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(o.SUPABASE_URL)||o.SUPABASE_ANON_KEY.length<40)throw new Error('config 값이 비었다');console.log('ok',o.SUPABASE_URL)"
```
Expected: `ok https://<project-ref>.supabase.co`

- [ ] **Step 3: 커밋**

```bash
git add js/config.js
git commit -m "feat: Supabase 접속 정보를 js/config.js 한 곳에"
```

---

## Task 4: `invite.html` — `?id=` 로 열기

**Files:**
- Modify: `invite.html` (`<head>` 12행 뒤, `<style>` 19행 뒤, `#toast` 792행 앞, 스크립트 859~876행, `baseUrl` 1514~1517행)

**동작 (스펙 §7 · §8-①):**

| 입력 | 동작 |
|---|---|
| `?id=xxxxxxxx` | 본문을 가린 채 RPC 로 받아 그린다. 캐시가 있으면 캐시로 즉시 그리고 뒤에서 갱신 |
| `#d=…` | 지금처럼. **그대로** |
| 둘 다 없음 | 기본 데모. Supabase 를 안 탄다 |
| RPC 가 `null` | "아직 발행되지 않았거나 없는 청첩장입니다". 기본값을 그리지 않는다 |
| 네트워크 실패 | "청첩장을 불러오지 못했습니다" + 다시 시도 |

- [ ] **Step 1: `<head>` 에 대기 스크립트**

12행 `<meta name="twitter:card" content="summary">` 바로 뒤에 추가:

```html
<script>
/* ?id= 로 들어오면 서버에서 받을 때까지 본문을 가린다.
   기본값(강태윤 · 윤채원)이 먼저 보이면 남의 이름이 뜨는 셈이라, 그리기 전에 막는다 (스펙 §8-①). */
if (/[?&]id=/.test(location.search)) document.documentElement.className += ' wait';
</script>
<script src="js/config.js"></script>
```

- [ ] **Step 2: 대기 화면 CSS**

19행 `<style>` 바로 뒤에 추가:

```css
/* ?id= 로딩 중. <head> 의 인라인 스크립트가 html.wait 를 붙이고, 데이터가 오면 start() 가 뗀다 */
html.wait body > *:not(#load):not(#toast){visibility:hidden}
#load{display:none;position:fixed;inset:0;z-index:50;flex-direction:column;align-items:center;
  justify-content:center;gap:16px;padding:24px;text-align:center;background:#FFFFFF;color:var(--ink)}
html.wait #load{display:flex}
#load p{font-size:.95rem;line-height:1.7;color:var(--ink-2)}
#load button{display:none;height:var(--tap);padding:0 20px;border:1px solid var(--line-2);
  border-radius:3px;background:#FFFFFF;font:inherit;font-size:.9rem;color:var(--ink)}
#load.err p{color:var(--ink)}
#load.err button{display:inline-block}
```

- [ ] **Step 3: 대기 화면 마크업**

792행 `<div class="toast" id="toast" …>` 바로 앞에 추가:

```html
<div id="load" aria-live="polite">
  <p id="loadMsg">청첩장을 불러오는 중입니다</p>
  <button type="button" id="loadRetry">다시 시도</button>
</div>
```

- [ ] **Step 4: 저장소 함수를 위로, 본문을 `start()` 로 감싸기**

894~903행의 `read` · `write` 두 함수를 잘라서 858행 주석 `/* 주소의 #d= 를 읽는다 … */` **앞**에 붙인다 (내용 그대로):

```js
  /* ─────────── 저장소 (막혀 있어도 죽지 않게) ─────────── */
  function read(key, fallback){
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, val){
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
```

그 다음 872행 `var D = deepMerge(DEFAULTS, fromHash());` 한 줄을 아래로 **교체**한다:

```js
  /* ─────────── 어디서 데이터를 받나 ───────────
     ?id=   → 서버 RPC 한 건. 라이브러리 없이 fetch 다. 하객 경로에 의존성을 더하지 않는다.
     #d=    → 주소에서 디코드. 유지.
     없음   → 기본 데모. Supabase 를 아예 타지 않는다.
     아래 본문 전체는 start(D) 안에 들어간다. 들여쓰기는 일부러 안 바꿨다 — diff 를 읽을 수 있게. */
  var ID = (location.search.match(/[?&]id=([A-Za-z0-9]{8})(?:&|$)/) || [])[1] || '';
  var CACHE = 'onnit-inv-' + ID;

  function fetchInvitation(id){
    return fetch(window.ONNIT.SUPABASE_URL + '/rest/v1/rpc/get_invitation', {
      method: 'POST',
      headers: { 'apikey': window.ONNIT.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: id })
    }).then(function(r){
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();                       // 발행본이면 data 객체, 아니면 null
    });
  }

  function loadFail(msg){
    var box = document.getElementById('load');
    document.getElementById('loadMsg').textContent = msg;
    box.classList.add('err');
    document.title = '청첩장';
  }

  if (!ID) {
    start(deepMerge(DEFAULTS, fromHash()));
  } else {
    var cached = read(CACHE, null);
    if (cached) start(deepMerge(DEFAULTS, cached));   // 재방문은 캐시로 즉시
    document.getElementById('loadRetry').addEventListener('click', function(){ location.reload(); });
    fetchInvitation(ID).then(function(data){
      if (data === null) {
        if (!cached) loadFail('아직 발행되지 않았거나 없는 청첩장입니다');
        return;
      }
      write(CACHE, data);
      if (!cached) {
        start(deepMerge(DEFAULTS, data));
      } else if (JSON.stringify(cached) !== JSON.stringify(data)) {
        // 내용이 바뀌었다. 한 번만 다시 그린다 — 두 번째 로드는 캐시와 같으므로 여기 안 온다.
        location.reload();
      }
    }, function(){
      if (!cached) loadFail('청첩장을 불러오지 못했습니다');
    });
  }

  function start(D){
  document.documentElement.classList.remove('wait');
```

그리고 파일 끝 1587행의 `})();` (IIFE 닫기) **바로 앞**에 `start` 를 닫는 한 줄을 넣는다:

```js
  }  // start(D)
```

주의: `read` · `write` 를 위로 옮겼으므로 원래 자리(894~903행)에서는 **지운다.** 두 번 선언되면 안 된다.

- [ ] **Step 5: `baseUrl` 이 `?id=` 를 데리고 가게**

1514~1517행의 `baseUrl` 을 교체:

```js
  function baseUrl(query){
    // ?id= 는 데리고 가고, ?to= 는 뗀다. 맞춤 링크를 받은 사람이 다시 공유할 때
    // 자기 이름이 딸려 가면 안 된다. 인자로 온 쿼리가 있으면 그 위에 얹는다.
    var p = new URLSearchParams(location.search);
    p.delete('to');
    if (query) new URLSearchParams(query).forEach(function(v, k){ p.set(k, v); });
    var s = p.toString();
    return location.origin + location.pathname + (s ? '?' + s : '') + location.hash;
  }
```

- [ ] **Step 6: 브라우저 검증**

Run:
```bash
cd /Users/imdoyeong/workSpaces/onnit-wedding-invitation && python3 -m http.server 8080
```

| 열기 | 기대 |
|---|---|
| `http://localhost:8080/invite.html` | 지금과 같은 기본 데모. Network 탭에 `supabase.co` 요청이 **없다** |
| `http://localhost:8080/invite.html?id=zzzzzzzz` | 흰 화면에 "아직 발행되지 않았거나 없는 청첩장입니다". 이름이 **한 번도** 비치지 않는다 |
| `http://localhost:8080/invite.html?id=zzzzzzzz` 에서 DevTools → Network → Offline 켜고 새로고침 | "청첩장을 불러오지 못했습니다" 와 **다시 시도** 버튼 |
| make.html 에서 만든 `invite.html#d=…` 링크 | 지금과 같다 |
| `?id=zzzzzzzz&to=철수` | 위와 같은 안내 (RPC 가 null) — `?to=` 가 로딩을 깨지 않는다 |

발행본으로 열리는 검증은 Task 6 Step 6 에서 한다 (저장 · 발행이 있어야 한다).

- [ ] **Step 7: 커밋**

```bash
git add invite.html
git commit -m "feat(invite): ?id= 로 서버에서 받아 그린다 — 대기 화면 · 캐시 · 실패 안내"
```

---

## Task 5: 🧑 카카오 앱 등록과 Supabase Auth 설정

**산출물:** REST API 키, Client Secret. Supabase 에 입력까지 끝나면 Task 6 을 실제로 돌릴 수 있다.

- [ ] **Step 1: 카카오 앱**

<https://developers.kakao.com> → 내 애플리케이션 → 애플리케이션 추가.

| 항목 | 값 |
|---|---|
| 앱 이름 | `ONNIT 청첩장` |
| 회사명 | `ONNIT` |
| 카테고리 | 라이프스타일 |
| 앱 아이콘 | `img/` 의 아무 사진이나 정사각 크롭 (나중에 바꾼다) |

- [ ] **Step 2: 플랫폼 · 로그인**

| 어디 | 무엇 |
|---|---|
| 앱 설정 → 플랫폼 → Web → 사이트 도메인 | `https://wedding.onnit.co.kr`, `http://localhost:8080` 두 줄 |
| 제품 설정 → 카카오 로그인 → 활성화 설정 | **ON** |
| 제품 설정 → 카카오 로그인 → Redirect URI | `https://<project-ref>.supabase.co/auth/v1/callback` |
| 제품 설정 → 카카오 로그인 → 동의항목 | `profile_nickname` 필수, `profile_image` 선택. **`account_email` 은 건드리지 않는다** (비즈앱 필요 — 스펙 §6) |
| 앱 설정 → 앱 키 | **REST API 키** 복사 |
| 제품 설정 → 카카오 로그인 → 보안 | Client Secret **코드 생성** 후 **활성화 상태 ON**. 코드 복사 |

- [ ] **Step 3: Supabase Auth**

Supabase 대시보드 → Authentication → Providers → Kakao:

| 항목 | 값 |
|---|---|
| Enable Kakao | ON |
| Client ID | REST API 키 |
| Client Secret | 위 코드 |
| Allow users without an email | **ON** (이메일을 안 받으므로 — 스펙 §6) |

Authentication → URL Configuration:

| 항목 | 값 |
|---|---|
| Site URL | `https://wedding.onnit.co.kr` |
| Redirect URLs | `https://wedding.onnit.co.kr/**` 와 `http://localhost:8080/**` 두 줄 |

- [ ] **Step 4: 확인**

브라우저에서 `https://<project-ref>.supabase.co/auth/v1/authorize?provider=kakao` 를 연다.
Expected: 카카오 로그인 화면이 뜬다 (동의하고 나면 Site URL 로 돌아온다 — 아직 페이지가 처리 안 하므로 그냥 닫는다).
`{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}` 가 뜨면 Step 3 의 Enable 이 안 된 것이다.

---

## Task 6: `make.html` — 로그인 · 저장 · 발행 · 내 목록

**Files:**
- Modify: `make.html` (`<head>` 15행 뒤, 링크 탭 341~363행, 스크립트 435~475행, 759~771행, 813~819행, 끝 835~837행)

**동작 (스펙 §7-1):** 열자마자 지금처럼 입력한다. 로그인은 **「저장」을 누를 때** 요구한다. OAuth 왕복 뒤 초안(`localStorage`)을 들고 이어서 저장한다. 발행은 결제가 오기 전까지 버튼 하나다.

**상태:** `D` 는 데이터만 (그대로 `data` jsonb 가 된다). 어느 행을 편집 중인지는 `CUR = { id, published_at }` 가 따로 들고 `localStorage` 에 남긴다.

| 시작 입력 | 동작 |
|---|---|
| `make.html?id=xxxxxxxx` | 로그인돼 있으면 내 행을 받아 `D` 와 `CUR` 로. 아니면 로그인 요구 |
| `make.html#d=…` | 지금처럼 디코드. **`CUR` 은 비운다** — 주소로 들어온 사본은 어느 행도 아니다 |
| 새로고침 | 초안 + `CUR` 복원. 같은 행을 계속 고친다 |
| `?code=` (OAuth 복귀) | supabase-js 가 세션으로 바꾼다. 주소에서 `code` 를 지운다. 보류된 「저장」이 있으면 이어서 한다 |

- [ ] **Step 1: `<head>` 에 스크립트**

15행 `<link rel="stylesheet" href="css/base.css">` 바로 뒤:

```html
<script src="js/config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

7행 `<meta name="description" …>` 의 내용을 바꾼다:

```html
<meta name="description" content="모바일 청첩장 만들기. 일곱 단계를 채우면 주소가 만들어지고, 카카오 로그인으로 저장하면 짧은 주소가 생깁니다.">
```

- [ ] **Step 2: 링크 탭 마크업**

341~343행의 힌트를 교체:

```html
      <div class="hint-top">주소가 둘입니다. <b>긴 주소</b>는 내용이 주소 안에 담겨 서버 없이 열립니다.
        <b>짧은 주소</b>는 카카오로 로그인해 서버에 저장하면 만들어지고, 발행해야 하객에게 열립니다.</div>
```

그 바로 뒤, 344행 `<div class="linkbox">` **앞**에 두 블록을 추가:

```html
      <div class="linkbox" id="srvBox">
        <h3><span class="b"></span>짧은 주소</h3>
        <div class="url latin" id="srvOut">저장하면 짧은 주소가 만들어집니다</div>
        <div class="meta" id="srvMeta">아직 서버에 저장하지 않았습니다.</div>
        <div class="in" style="margin-top:12px;padding:0">
          <button class="btn fill" type="button" id="btnSave" style="width:100%">저장하고 짧은 주소 만들기</button>
          <button class="btn ghost" type="button" id="btnPublish" style="width:100%;flex:none" hidden>발행하기 — 하객에게 열립니다</button>
          <button class="btn ghost" type="button" id="btnCopyShort" style="width:100%;flex:none" hidden>짧은 주소 복사</button>
        </div>
      </div>

      <div class="grp" id="meBox">
        <h2><span class="b"></span>내 계정</h2>
        <div class="in">
          <div class="meta" id="meOut">로그인하지 않았습니다. 저장할 때 카카오 로그인을 묻습니다.</div>
          <button class="btn ghost" type="button" id="btnLogin" style="width:100%;flex:none">카카오로 로그인</button>
          <button class="btn ghost" type="button" id="btnLogout" style="width:100%;flex:none" hidden>로그아웃</button>
          <div id="mineList" style="display:grid;gap:8px"></div>
        </div>
      </div>
```

- [ ] **Step 3: 스크립트 — 클라이언트 · 상태 · boot**

435행 `var DRAFT = 'onnit-make-draft-v1';` 뒤에 추가:

```js
  var CURKEY  = 'onnit-make-cur-v1';       // 지금 고치는 서버 행 { id, published_at }
  var PENDING = 'onnit-make-pending-v1';   // 로그인 왕복 중에 보류한 동작. 'save' 하나뿐이다

  /* supabase-js. UMD 라 window.supabase 로 온다. PKCE 라 복귀 주소가 ?code= 다 —
     #d= 와 해시를 다투지 않는다. 세션은 localStorage 에 남아 새로고침을 넘긴다. */
  var supa = window.supabase.createClient(window.ONNIT.SUPABASE_URL, window.ONNIT.SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true }
  });

  var CUR = null;
  try { CUR = JSON.parse(localStorage.getItem(CURKEY) || 'null'); } catch (e) {}
  function setCur(c){
    CUR = c;
    try { c ? localStorage.setItem(CURKEY, JSON.stringify(c)) : localStorage.removeItem(CURKEY); } catch (e) {}
  }

  /* 8자 base62. 62⁸ 이라 추측으로 못 맞힌다. 256 % 62 의 치우침은 248 이상을 버려서 없앤다. */
  function newId(){
    var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', out = '';
    while (out.length < 8) {
      var buf = new Uint8Array(16); crypto.getRandomValues(buf);
      for (var i = 0; i < buf.length && out.length < 8; i++) if (buf[i] < 248) out += A[buf[i] % 62];
    }
    return out;
  }

  var QID = (location.search.match(/[?&]id=([A-Za-z0-9]{8})(?:&|$)/) || [])[1] || '';
```

457~467행의 `boot()` 를 교체 (`?id=` 는 비동기라 여기서 못 받는다. `#d=` 가 오면 `CUR` 을 비우는 줄만 는다):

```js
  function boot(){
    var m = (location.hash || '').match(/[#&]d=([^&]+)/);
    if (m) {
      try { var d = decode(m[1]); setCur(null); return d; } catch (e) {}
    }
    try {
      var raw = localStorage.getItem(DRAFT);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
```

- [ ] **Step 4: 스크립트 — 서버 저장 · 발행 · 목록 · 계정**

759~771행의 `apply()` 를 교체 (마지막 줄 `paintSrv()` 하나가 는다):

```js
  function apply(){
    saveDraft();
    var u = url();
    $('#linkOut').textContent = u;
    var e = $('#editOut');
    if (e) e.textContent = editUrl();
    var n = u.length;
    $('#linkLen').textContent = n.toLocaleString('ko-KR');
    $('#linkWarn').innerHTML = n > 2000
      ? ' <span class="warn">· 일부 메신저에서 잘릴 수 있습니다</span>' : '';
    if ($('#pv').classList.contains('on')) $('#pvFrame').src = u + '&nogate=1';
    paintSrv();
  }
```

그 `apply()` 바로 뒤에 추가:

```js
  /* ── 서버 저장 · 발행 ──
     저장은 로그인만 있으면 된다. 발행은 published_at 을 채우는 것이고,
     결제(하위 프로젝트 4)가 오면 이 버튼 앞에 끼어든다. 여기 코드는 안 바뀐다. */
  var ME = null;    // supabase user 또는 null

  function shortUrl(){ return CUR ? dir() + 'invite.html?id=' + CUR.id : ''; }

  function paintSrv(){
    var out = $('#srvOut'), meta = $('#srvMeta');
    if (!CUR) {
      out.textContent = '저장하면 짧은 주소가 만들어집니다';
      meta.textContent = ME ? '아직 서버에 저장하지 않았습니다.' : '아직 서버에 저장하지 않았습니다. 저장할 때 카카오 로그인을 묻습니다.';
      $('#btnSave').textContent = '저장하고 짧은 주소 만들기';
      $('#btnPublish').hidden = true; $('#btnCopyShort').hidden = true;
      return;
    }
    out.textContent = shortUrl();
    $('#btnSave').textContent = '지금 내용으로 다시 저장';
    $('#btnCopyShort').hidden = false;
    if (CUR.published_at) {
      meta.textContent = '발행됨. 이 주소를 받은 하객에게 바로 열립니다.';
      $('#btnPublish').hidden = true;
    } else {
      meta.textContent = '저장됨. 아직 발행 전이라 본인에게만 열립니다.';
      $('#btnPublish').hidden = false;
    }
  }

  function fail(e, fallback){
    var m = (e && e.message) || '';
    if (/INVITATION_LIMIT/.test(m)) return toast('청첩장은 계정당 20개까지입니다');
    if (/JWT|session|Auth/i.test(m)) return toast('로그인이 풀렸습니다. 다시 로그인해 주세요');
    toast(fallback);
  }

  function login(){
    // 복귀 주소는 지금 페이지(쿼리 · 해시 없이). 초안은 localStorage 에 있어 왕복을 넘긴다.
    return supa.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: location.href.replace(/[?#].*$/, '') }
    });
  }

  function save(){
    if (!ME) {
      try { localStorage.setItem(PENDING, 'save'); } catch (e) {}
      toast('카카오 로그인 뒤 이어서 저장합니다');
      return login();
    }
    var btn = $('#btnSave'); btn.disabled = true;
    var p;
    if (CUR) {
      p = supa.from('invitations').update({ data: D }).eq('id', CUR.id).select('id, published_at').single();
    } else {
      p = insertNew(0);
    }
    return p.then(function(r){
      if (r.error) throw r.error;
      setCur({ id: r.data.id, published_at: r.data.published_at });
      paintSrv(); listMine();
      toast('저장했습니다');
    }).catch(function(e){ fail(e, '저장하지 못했습니다'); })
      .then(function(){ btn.disabled = false; });
  }

  // 8자 id 가 겹치면 3번까지 다시 뽑는다. 62⁸ 에서 3번 연속 충돌은 다른 고장이다 (스펙 §11).
  function insertNew(attempt){
    var id = newId();
    return supa.from('invitations').insert({ id: id, data: D }).select('id, published_at').single()
      .then(function(r){
        if (r.error && r.error.code === '23505' && attempt < 2) return insertNew(attempt + 1);
        return r;
      });
  }

  function publish(){
    if (!CUR || !ME) return;
    var btn = $('#btnPublish'); btn.disabled = true;
    supa.from('invitations').update({ published_at: new Date().toISOString() })
      .eq('id', CUR.id).select('id, published_at').single()
      .then(function(r){
        if (r.error) throw r.error;
        setCur({ id: r.data.id, published_at: r.data.published_at });
        paintSrv(); listMine();
        toast('발행했습니다. 하객에게 열립니다');
      }).catch(function(e){ fail(e, '발행하지 못했습니다'); })
        .then(function(){ btn.disabled = false; });
  }

  function listMine(){
    var box = $('#mineList');
    if (!ME) { box.innerHTML = ''; return; }
    supa.from('invitations')
      .select('id, published_at, updated_at, gn:data->g->>n, bn:data->b->>n')
      .order('updated_at', { ascending: false })
      .then(function(r){
        if (r.error) { box.innerHTML = ''; return; }
        box.innerHTML = r.data.map(function(x){
          var cur = CUR && CUR.id === x.id;
          return '<a class="add" style="display:flex;align-items:center;justify-content:space-between;text-decoration:none"' +
                 ' href="make.html?id=' + x.id + '">' +
                 '<span>' + escapeHtml((x.gn || '') + ' · ' + (x.bn || '')) + (cur ? ' <small>(지금)</small>' : '') + '</span>' +
                 '<small>' + (x.published_at ? '발행' : '저장') + ' · ' + x.updated_at.slice(0, 10) + '</small></a>';
        }).join('') || '<div class="meta">저장한 청첩장이 없습니다</div>';
      });
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }

  function paintMe(){
    var out = $('#meOut');
    if (ME) {
      var nick = (ME.user_metadata && (ME.user_metadata.name || ME.user_metadata.preferred_username)) || '카카오 사용자';
      out.textContent = nick + ' 님으로 로그인했습니다.';
      $('#btnLogin').hidden = true; $('#btnLogout').hidden = false;
    } else {
      out.textContent = '로그인하지 않았습니다. 저장할 때 카카오 로그인을 묻습니다.';
      $('#btnLogin').hidden = false; $('#btnLogout').hidden = true;
    }
    paintSrv(); listMine();
  }

  /* ?id= 로 들어왔다. 내 행을 받아 D 와 CUR 로. 세션이 있어야 한다 — RLS 가 소유자만 돌려준다. */
  function openMine(id){
    return supa.from('invitations').select('id, data, published_at').eq('id', id).single()
      .then(function(r){
        if (r.error || !r.data) { toast('그 청첩장을 열 수 없습니다'); return; }
        D = r.data.data;
        setCur({ id: r.data.id, published_at: r.data.published_at });
        fillForm(); growAll(); apply();
      });
  }

  $('#btnSave').addEventListener('click', save);
  $('#btnPublish').addEventListener('click', publish);
  $('#btnCopyShort').addEventListener('click', function(){
    if (!navigator.clipboard || !navigator.clipboard.writeText) { toast('복사가 막혔습니다. 위 주소를 직접 선택해 주세요'); return; }
    navigator.clipboard.writeText(shortUrl()).then(
      function(){ toast('짧은 주소를 복사했습니다'); },
      function(){ toast('복사가 막혔습니다. 위 주소를 직접 선택해 주세요'); });
  });
  $('#btnLogin').addEventListener('click', function(){ login(); });
  $('#btnLogout').addEventListener('click', function(){
    supa.auth.signOut().then(function(){ setCur(null); ME = null; paintMe(); toast('로그아웃했습니다'); });
  });

  // 세션이 바뀔 때마다 — 첫 로드 · OAuth 복귀 · 로그아웃 — 화면을 맞춘다
  supa.auth.onAuthStateChange(function(event, session){
    ME = session ? session.user : null;
    paintMe();
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (/[?&]code=/.test(location.search)) {
        // PKCE 복귀. 주소에서 code 를 지운다 — 새로고침하면 쓰고 난 code 로 또 교환하려 한다
        history.replaceState(null, '', location.pathname + (QID ? '?id=' + QID : '') + location.hash);
      }
      var pending = '';
      try { pending = localStorage.getItem(PENDING) || ''; localStorage.removeItem(PENDING); } catch (e) {}
      if (ME && QID && !CUR) openMine(QID);
      else if (ME && pending === 'save') save();
    }
  });
```

813~819행의 `#btnReset` 핸들러에서 `setCur(null)` 한 줄을 더한다:

```js
  $('#btnReset').addEventListener('click', function(){
    D = JSON.parse(JSON.stringify(DEFAULTS));
    try { localStorage.removeItem(DRAFT); } catch (e) {}
    setCur(null);
    // 주소에 #d= 가 남아 있으면 새로고침할 때 되살아난다
    if (location.hash) history.replaceState(null, '', location.pathname);
    fillForm(); apply(); toast('처음값으로 되돌렸습니다');
  });
```

- [ ] **Step 5: `?id=` 와 `CUR` 이 어긋나면 `?id=` 가 이긴다**

파일 끝 835~837행의 `fillForm(); growAll(); apply();` 바로 **앞**에 추가:

```js
  // make.html?id= 로 왔는데 기기에 남은 CUR 이 다른 행이면 CUR 을 버린다. 세션이 오면 openMine 이 받는다.
  if (QID && (!CUR || CUR.id !== QID)) setCur(null);
```

- [ ] **Step 6: 브라우저 검증** (서버 `python3 -m http.server 8080`. Task 5 가 끝나 있어야 한다)

| 순서 | 하기 | 기대 |
|---|---|---|
| 1 | `http://localhost:8080/make.html` 열고 신랑 이름을 `테스트`로 고친다 | 링크 탭 「짧은 주소」 칸에 "저장하면 짧은 주소가 만들어집니다" |
| 2 | 「저장하고 짧은 주소 만들기」 | 토스트 "카카오 로그인 뒤 이어서 저장합니다" → 카카오 화면 → 돌아옴 |
| 3 | 돌아온 뒤 | 주소에 `?code=` 가 **없다**. 신랑 이름이 `테스트` 그대로. 토스트 "저장했습니다". 짧은 주소 `…/invite.html?id=XXXXXXXX`. 「내 계정」에 닉네임, 목록에 1건 "저장" |
| 4 | 짧은 주소를 **시크릿 창**에서 연다 | "아직 발행되지 않았거나 없는 청첩장입니다" (미발행은 남에게 안 열린다) |
| 5 | 「발행하기」 | 토스트 "발행했습니다". 메타 "발행됨". 목록이 "발행" |
| 6 | 시크릿 창에서 다시 연다 | 청첩장이 **`테스트`** 이름으로 뜬다. 기본값 이름이 비친 적 없다. 공유 버튼의 주소에 `?id=` 가 있다 |
| 7 | 그 창에서 공유 섹션에 `철수` 넣고 맞춤 링크 | `…/invite.html?id=XXXXXXXX&to=철수` |
| 8 | 신부 이름을 `둘째`로 고치고 「지금 내용으로 다시 저장」, 시크릿 창 새로고침 | 첫 그림은 캐시(`테스트 · 윤채원`)였다가 **곧바로** 한 번 다시 그려져 `둘째`. 또 새로고침하면 다시 그리지 않는다 |
| 9 | `make.html` 을 새로고침 | 같은 짧은 주소가 유지된다 (CUR 복원) |
| 10 | 「내 계정」 목록의 그 행을 누른다 | `make.html?id=XXXXXXXX` 로 열리고 폼이 그 내용 |
| 11 | 「처음값」 | 짧은 주소 칸이 "저장하면…"으로 돌아간다 (CUR 비움) |
| 12 | 「로그아웃」 뒤 「저장하고 짧은 주소 만들기」 | 다시 카카오로 간다 |
| 13 | 저장 21번 (이름만 바꿔 「처음값」 → 「저장」 반복) | 21번째에 토스트 "청첩장은 계정당 20개까지입니다". 대시보드 Table Editor 에서 21건째 테스트 행들을 지운다 |

- [ ] **Step 7: 커밋**

```bash
git add make.html
git commit -m "feat(make): 카카오 로그인 · 서버 저장 · 발행 · 내 청첩장 목록 — 짧은 주소가 생긴다"
```

---

## Task 7: 운영 — 일시정지 방지 핑

> **2026-10-04 사용자 결정: 백업은 하지 않는다.** 아래에서 `backup.yml` 과 비공개 저장소 부분은 건너뛴다. 핑은 UptimeRobot 하나로 충분하고, `keepalive.yml` 은 두고 싶으면 두는 선택지다.

**Files:**
- Create: `ops/README.md`, `ops/keepalive.yml`, `ops/backup.yml`

이 리포는 공개다. 워크플로는 **비공개 백업 저장소**에서 돈다 (스펙 §8-③ · ④). 여기엔 복사할 템플릿만 둔다.

- [ ] **Step 1: 템플릿 작성**

`ops/README.md`:

```markdown
# 운영 템플릿 — 비공개 백업 저장소로 복사한다

이 리포는 공개라 여기서 돌리지 않는다. 이유 둘:

- `pg_dump` 에 전화번호 · 계좌번호가 통째로 들어 있다. 공개 저장소의 아티팩트는 GitHub 계정만 있으면 누구나 받는다
- 공개 저장소의 예약 워크플로는 60일 활동이 없으면 꺼진다. 비공개는 안 꺼진다

## 만들기

1. GitHub 에 **비공개** 저장소 `onnit-backup` 을 만든다
2. `keepalive.yml` · `backup.yml` 을 그 저장소의 `.github/workflows/` 에 넣는다
3. Settings → Secrets and variables → Actions 에 셋을 넣는다

| Secret | 값 |
|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | anon 키 |
| `SUPABASE_DB_URL` | 대시보드 → Connect → Session pooler 의 URI. `postgresql://postgres.<ref>:<DB 비밀번호>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres` 꼴. **Direct 가 아니라 Session pooler** 다 — Actions 러너는 IPv6 가 안 된다 |

4. Actions 탭에서 둘 다 **Run workflow** 로 한 번 돌려 초록인지 본다

## 외부 크론 (이중화 + 알림)

<https://uptimerobot.com> 무료 → New Monitor:

| 항목 | 값 |
|---|---|
| Type | HTTP(s) — Keyword 말고 그냥 HTTP |
| URL | `https://<project-ref>.supabase.co/rest/v1/rpc/get_invitation?p_id=keepalive` |
| Method | POST, Content-Type `application/json`, Body `{"p_id":"keepalive"}` |
| Headers | `apikey: <anon 키>` |
| Interval | 5분 (무료 최소). 하루 288번 — Supabase 가 "매일 몇 번의 DB 요청"을 활동으로 본다 |
| Alert | 이메일 |

RPC 는 Postgres 를 실제로 태우므로 활동으로 잡힌다. `/auth/v1/health` 는 DB 를 안 탈 수 있어 쓰지 않는다.
```

`ops/keepalive.yml`:

```yaml
name: supabase-keepalive
on:
  schedule:
    - cron: '23 1,13 * * *'    # 매일 10:23 · 22:23 KST. 정각은 GitHub 이 밀린다
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: RPC 한 번 — Postgres 를 실제로 태워야 활동으로 잡힌다
        env:
          URL: ${{ secrets.SUPABASE_URL }}
          KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: |
          out=$(curl -fsS -X POST "$URL/rest/v1/rpc/get_invitation" \
            -H "apikey: $KEY" -H "Content-Type: application/json" \
            -d '{"p_id":"keepalive"}')
          echo "rpc -> $out"
          test "$out" = "null"
```

`ops/backup.yml`:

```yaml
name: supabase-backup
on:
  schedule:
    - cron: '41 18 * * 0'      # 매주 월 03:41 KST
  workflow_dispatch:
permissions:
  contents: write
jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: 스키마 + 데이터 덤프 (Supabase 가 관리하는 스키마는 CLI 가 알아서 뺀다)
        env:
          DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          mkdir -p dumps
          d=$(date -u +%F)
          supabase db dump --db-url "$DB_URL" -f "dumps/$d-schema.sql"
          supabase db dump --db-url "$DB_URL" --data-only -f "dumps/$d-data.sql"
          ls -la dumps | tail -n 4
      - name: 커밋 — 이 커밋이 저장소 활동이기도 하다
        run: |
          git config user.name  "backup-bot"
          git config user.email "backup-bot@users.noreply.github.com"
          git add dumps
          git commit -m "backup $(date -u +%F)" || echo "변화 없음"
          git push
```

- [ ] **Step 2: 🧑 비공개 저장소 · Secrets · UptimeRobot**

`ops/README.md` 의 「만들기」와 「외부 크론」을 그대로 한다.

- [ ] **Step 3: 확인**

| 어디 | 기대 |
|---|---|
| 비공개 저장소 Actions → supabase-keepalive → Run workflow | 초록. 로그에 `rpc -> null` |
| 비공개 저장소 Actions → supabase-backup → Run workflow | 초록. `dumps/<날짜>-schema.sql` 에 `create table public.invitations` 가 있고 `<날짜>-data.sql` 에 `auth.users` 와 `public.invitations` 의 `INSERT` 또는 `COPY` 가 있다 |
| UptimeRobot | 상태 **Up**, 응답 200 |

- [ ] **Step 4: 커밋**

```bash
git add ops/
git commit -m "ops: 무료 플랜 운영 템플릿 — 비공개 저장소용 핑 · 주간 백업, UptimeRobot 설정"
```

---

## Task 8: 호스팅 — Cloudflare Pages 로

**Files:**
- Delete: `CNAME`, `.nojekyll`
- Modify: `README.md` 20~26행 (실행 안내)

순서가 중요하다. **대시보드가 먼저, 저장소 정리는 그 뒤.** 거꾸로 하면 사이트가 잠깐 죽는다 (스펙 §9-1).

- [ ] **Step 1: 🧑 Pages 프로젝트**

<https://dash.cloudflare.com> → Workers & Pages → Create → Pages → Connect to Git → `lian220/onnit-wedding-invitation`.

| 항목 | 값 |
|---|---|
| Project name | `onnit-wedding` |
| Production branch | `main` |
| Framework preset | None |
| Build command | (비움) |
| Build output directory | `/` |

Save and Deploy. `https://onnit-wedding.pages.dev` 가 열리면 된다.

- [ ] **Step 2: 🧑 커스텀 도메인**

그 프로젝트 → Custom domains → Set up a custom domain → `wedding.onnit.co.kr` → Activate domain.
네임서버가 이미 Cloudflare 라 CNAME 레코드를 Cloudflare 가 직접 바꾼다 (GitHub Pages 를 가리키던 것이 `onnit-wedding.pages.dev` 로).

- [ ] **Step 3: 전파 확인**

Run:
```bash
curl -sI https://wedding.onnit.co.kr/invite.html | grep -i -E "^(HTTP|location|server)"
```
Expected:
```
HTTP/2 308
location: /invite
server: cloudflare
```

Run:
```bash
curl -sI "https://wedding.onnit.co.kr/invite?id=zzzzzzzz" | grep -i -E "^(HTTP|server)"
```
Expected: `HTTP/2 200` 와 `server: cloudflare`. `github.com` 이 보이면 아직 전파 전이다. 몇 분 뒤 다시.

- [ ] **Step 4: GitHub Pages 전용 파일 제거**

```bash
cd /Users/imdoyeong/workSpaces/onnit-wedding-invitation && git rm CNAME .nojekyll
```

🧑 GitHub 저장소 → Settings → Pages → Source 를 **None** 으로. (안 끄면 `lian220.github.io/onnit-wedding-invitation` 로 복제본이 계속 열린다.)

- [ ] **Step 5: README 실행 안내**

README 20~26행의 코드 블록 뒤에 한 문단 추가:

```markdown
배포는 Cloudflare Pages 다. `main` 에 push 하면 그대로 올라간다. 빌드 명령은 없다.
Pages 는 `/invite.html` 을 `/invite` 로 308 리다이렉트한다. 이미 뿌려진 `invite.html#d=…` 링크는
fragment 와 query 가 리다이렉트를 넘어 살아남으므로 깨지지 않고 한 번 더 튈 뿐이다.
로컬 `http.server` 는 그 리다이렉트가 없어서 페이지가 만드는 주소는 `.html` 을 유지한다.
```

- [ ] **Step 6: 커밋**

```bash
git add README.md
git commit -m "chore: 호스팅을 Cloudflare Pages 로 — GitHub Pages 전용 파일 제거"
```

---

## Task 9: README · 랜딩 · 스펙을 사실에 맞게

**Files:**
- Modify: `README.md` 90~104행 「서버 없이 어떻게 저장하나」, 287~296행 「남은 것」
- Modify: `index.html` 7 · 10행 메타, 228~232행 리드, 436~440행 「주소가 깁니다」
- Modify: `docs/superpowers/specs/2026-09-08-auth-server-storage-design.md` §3 · §8-③ · §9-1

- [ ] **Step 1: README 저장 절**

90행 제목과 그 절을 교체:

```markdown
## 어떻게 저장하나 — 주소 안에, 또는 서버에

제작 페이지는 입력값을 JSON으로 묶어 base64url로 인코딩한 뒤 **주소의 `#d=` 뒤에 붙인다.**

```
invite.html#d=eyJnIjp7Im4iOiLsnbTrj4TtmIQi...
```

청첩장은 열릴 때 그 값을 읽어 기본값 위에 덮는다. 이 경로에는 데이터베이스도 API도 없다.
링크 자체가 청첩장이고, 로그인도 없다. 이건 그대로 남아 있다.

대가가 있다. **주소에 내용이 그대로 담기므로 길어지고, 내용이 노출된다.**
제작 페이지가 주소 길이를 실시간으로 세어 보여주고, 2,000자를 넘으면 경고한다.

그래서 두 번째 경로를 더했다. 링크 탭에서 **저장**을 누르면 카카오 로그인을 묻고,
같은 JSON 을 Supabase 의 `invitations` 테이블에 `jsonb` 통짜로 넣는다. 돌아오는 것은
`invite.html?id=k3n9x2ab` — 8자다. **발행**을 눌러야 하객에게 열리고, 그 전에는 본인에게만 열린다.

청첩장 쪽은 라이브러리를 싣지 않는다. `?id=` 가 있으면 RPC 하나를 `fetch` 하고,
없으면 Supabase 를 아예 타지 않는다. 하객 경로에 의존성을 더하지 않으려는 것이다.
받는 동안 본문을 가린다 — 기본값 이름이 먼저 비치면 남의 이름이 뜨는 셈이다.
한 번 연 청첩장은 이 기기에 캐시해 재방문은 즉시 그린다.

테이블 읽기는 소유자에게만 열려 있다. 공개 열람은 `get_invitation(id)` 한 건 조회뿐이라
anon 키로 전체를 덤프할 수 없다. 설계는 `docs/superpowers/specs/2026-09-08-auth-server-storage-design.md` 에 있다.

`#` 뒤만 바뀌면 브라우저가 새로고침을 하지 않아 미리보기가 멈춘다.
청첩장 쪽에 `hashchange`를 걸어 직접 다시 읽게 했다.
```

- [ ] **Step 2: README 남은 것**

287~296행 목록을 교체:

```markdown
## 남은 것

- 방명록·참석 여부를 실제 백엔드로 (Supabase). `read()` / `write()` 와 폼 `submit` 둘이 경계다
- 갤러리. 사진 밴드 세 개가 고정이라 제작 페이지에서 바꿀 수 없다.
  이제 저장소와 소유자가 있으니 다음 차례다
- 결제. 발행을 유료로. 설계는 `docs/superpowers/specs/2026-10-04-payment-design.md`
- 카카오톡 공유 SDK. 지금은 링크 복사와 Web Share API로만 처리한다

~~짧은 주소~~ 는 됐다. 계정과 서버 저장이 생기면서 같이 풀렸다.
```

- [ ] **Step 3: 랜딩 카피**

`index.html` 7행과 10행의 `content` 를 바꾼다 (같은 문장):

```
모바일 청첩장. 일곱 단계를 채우면 주소가 만들어지고, 그 주소가 곧 청첩장입니다. 카카오로 저장하면 짧은 주소가 생깁니다.
```

228~232행 리드 문단을 교체:

```html
      <p class="lead">
        가입 없이 바로 만듭니다. 일곱 단계를 채우면 주소가 만들어지고,
        그 주소를 받은 사람에게는 완성된 청첩장이 열립니다.
        내용은 주소 안에 담깁니다. 짧은 주소가 필요하면 그때 카카오로 저장하면 됩니다.
      </p>
```

431행 `<p class="slead">` 를 교체:

```html
    <p class="slead">작게 두기로 한 대가입니다. 감추는 것보다 먼저 적어 두는 편이 낫다고 봅니다.</p>
```

436~440행 「주소가 깁니다」 항목을 교체:

```html
        <div>
          <div class="t">긴 주소는 그대로 깁니다</div>
          <div class="b">저장하지 않으면 내용이 전부 주소에 담겨 2,000자를 넘기기 쉽습니다.
            카카오로 저장하면 8자 주소가 나오지만, 사진과 응답은 아직 그 주소에서도 안 됩니다.</div>
        </div>
```

- [ ] **Step 4: 스펙 세 줄**

| 어디 | 지금 | 바꿀 것 |
|---|---|---|
| §3 | `Supabase 클라이언트는 CDN ESM으로 붙인다.` | `Supabase 클라이언트는 make.html 에만 CDN UMD 로 붙인다. invite.html 은 RPC 를 fetch 로 부르고 라이브러리를 싣지 않는다.` |
| §8-③ 표 | `` `/auth/v1/health` 핑 `` | `` `get_invitation` RPC 핑 — Postgres 를 실제로 태워야 활동으로 잡힌다 `` |
| §9-1 | `` `make.html` 이 만드는 주소와 OG 태그는 `/invite` 로 바꾼다. `` | `` 페이지가 만드는 주소는 `.html` 을 유지한다. 로컬 `http.server` 에 그 리다이렉트가 없어서다. `` |

- [ ] **Step 5: 확인**

Run:
```bash
cd /Users/imdoyeong/workSpaces/onnit-wedding-invitation && grep -c "ESM\|auth/v1/health" docs/superpowers/specs/2026-09-08-auth-server-storage-design.md; grep -c "가입도 결제도 없습니다\|서버에는 아무것도 남지 않습니다" index.html
```
Expected: `0` 과 `0`

브라우저로 `http://localhost:8080/` 을 열어 리드 문단과 「아직 못 하는 것」 첫 항목이 새 문장인지 본다.

- [ ] **Step 6: 커밋**

```bash
git add README.md index.html docs/superpowers/specs/2026-09-08-auth-server-storage-design.md
git commit -m "docs: 저장 경로 둘을 README 와 랜딩에 — 짧은 주소는 됐다"
```

---

## 스펙 대조 (self-review)

| 스펙 | Task |
|---|---|
| §1 로그인 · 서버 저장 · 짧은 주소, 하객은 로그인 없음 | 6, 4 |
| §3 호스팅 Cloudflare Pages, 서버 코드 없음 | 8, (1 — 전부 SQL) |
| §4 profiles · invitations · `published_at` · touch 트리거 | 1 |
| §5 RLS · RPC · 미발행은 소유자만 · 20개 상한 | 1, 2 |
| §6 카카오 provider · 이메일 없이 · 프로젝트 하나 | 5, 0 |
| §7 `?id=` · `#d=` · 없음 세 입력 | 4 |
| §7-1 저장할 때 로그인 · 초안 유지 · 왕복 뒤 이어서 저장 | 6 |
| §8-① 기본값 안 비침 · 캐시 · 실패 안내 | 4 |
| §8-③ 외부 크론 + 비공개 저장소 워크플로 | 7 |
| §8-④ 주간 `pg_dump` · 비공개 | 7 |
| §9-1 이전 순서 · 308 | 8 |
| §11 확인 항목 | 0, 5, 7, 8 |

**빠진 것 없음.** 결제(§2 표의 4번)는 별도 스펙 · 별도 플랜이다.
