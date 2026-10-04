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
