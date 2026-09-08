# 계정 · 서버 저장 · 짧은 주소 — 설계

작성 2026-09-08. 이 문서는 **하위 프로젝트 1**의 스펙이다.
갤러리와 방명록은 이 위에 올라타므로 여기서 다루지 않는다.

---

## 1. 무엇을 만드나

카카오 로그인을 붙이고, 청첩장 데이터를 주소가 아니라 **서버에 저장**하고,
`invite.html?id=k3n9x2` 같은 **짧은 주소**를 내준다.

| 지금 | 바뀐 뒤 |
|---|---|
| `invite.html#d=` + base64 2,632자 | `invite.html?id=` + 8자 |
| 다시 고치려면 편집용 링크·이 기기 초안 | 로그인하면 **내 청첩장 목록** |
| 사진을 넣을 자리가 없다 | `auth.uid()` 소유가 생겨 갤러리의 토대가 된다 |

**하객은 계속 로그인하지 않는다.** 바뀌는 것은 제작 쪽뿐이다.

## 2. 왜 이 순서인가

원래는 갤러리를 먼저 하기로 했다. 갤러리의 소유 모델을 짜다가
"로그인 없이 남의 사진을 어떻게 막나"에서 22자 난수 키 방식이 나왔고,
그 자리에서 로그인을 넣기로 결정했다.

**로그인이 오면 그 키 모델은 통째로 버려진다.** 키 기반 RLS를 짜고 나서
auth 기반으로 갈아엎는 것은 순수한 낭비다. 그래서 로그인이 갤러리보다 먼저다.

그리고 계정이 생기면 서버 저장과 짧은 주소가 자연히 딸려 온다.
계정에 묶인 청첩장이 있는데 데이터는 주소에만 있는 것은 앞뒤가 안 맞고,
서버에 있으면 짧은 키로 부르는 것이 당연하다.
README 「남은 것」 넷 중 **둘이 여기서 한 번에 풀린다.**

### 하위 프로젝트 분해

| 순서 | 하위 프로젝트 | 상태 |
|---|---|---|
| **1** | **계정 + 서버저장 + 짧은 주소** | **이 문서** |
| 2 | 갤러리 — 밴드 3장 교체 | 설계 일부 완료 (§10) |
| 3 | 방명록 · 참석 여부 서버 저장 | 미착수 |
| 4 | 격자 갤러리 + 라이트박스 | 보류 — §10 |

---

## 3. 아키텍처

```
[제작]
  카카오 로그인 ──▶ make.html ──▶ invitations (Postgres, jsonb)
                      │
                      └──▶ 내 청첩장 목록

[열람]
  하객 (로그인 없음) ──▶ invite.html?id=k3n9x2
                              │
                              ├─ ?id=  → RPC 로 한 건 조회
                              ├─ #d=   → 지금처럼 주소에서 디코드   (유지)
                              └─ 없음  → 기본 데모                (Supabase 안 탐)
```

빌드는 계속 없다. Supabase 클라이언트는 CDN ESM으로 붙인다.
`README`가 "빌드가 없는 단일 HTML 파일"을 내세우고 있어 여기서 깨지 않는다.

## 4. 데이터 모델

```sql
-- 유니버스의 중심. 서비스가 늘어도 이 한 벌을 공유한다.
create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  nickname   text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table invitations (
  id         text primary key,                 -- 8자 base62
  owner      uuid not null references auth.users on delete cascade,
  data       jsonb not null,                   -- 지금 #d= 에 담기던 객체 그대로
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on invitations (owner, updated_at desc);

-- 목록이 updated_at 으로 정렬되는데 갱신할 주체가 없으면 생성 시각에 머문다.
create function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger invitations_touch before update on invitations
for each row execute function touch_updated_at();
```

**`data`를 jsonb 통짜로 두는 것이 핵심이다.** 컬럼으로 펼치면 `make.html`의
`collectIn` · `collectTl` · `collectAcc` 를 전부 다시 써야 한다.
통짜로 두면 **저장 경로만 갈아끼우면 되고 수집 코드는 그대로다.**

`id`는 8자 base62다. 62⁸ = 2.2×10¹⁴ 이라 추측으로 못 맞힌다.
클라이언트가 `crypto.getRandomValues`로 만들고, 충돌하면 다시 만든다.

### 지금 넣지 않는 것

`app` 컬럼은 넣지 않는다. 서비스가 하나뿐인데 미리 나누는 것은 과잉설계다.
두 번째 서비스가 생기면 `alter table add column app text default 'wedding'`
한 줄이고, 기본값 있는 컬럼 추가는 Postgres에서 즉시 끝난다.

## 5. RLS — 여기가 이 설계의 급소다

청첩장 `data`에는 **전화번호와 계좌번호**가 들어 있다.

`select` 정책을 `using (true)`로 열면 anon 키로 `GET /invitations` 를 때려
**전체 테이블을 그대로 덤프할 수 있다.** anon 키는 정적 파일에 박히므로 누구나 가진다.
하객이 봐야 하니 공개 읽기는 필요한데, 공개 읽기를 테이블에 직접 주면 안 된다.

**해결 — 테이블 읽기를 anon 에게 주지 않고, 한 건 조회 함수만 연다.**

```sql
alter table invitations enable row level security;
revoke all on invitations from anon;

create function get_invitation(p_id text)
returns jsonb language sql stable security definer
set search_path = public as $$
  select data from invitations where id = p_id;
$$;
grant execute on function get_invitation(text) to anon, authenticated;
```

`id`를 정확히 아는 사람만 그 한 건을 가져간다. 열거가 불가능하다.

나머지 정책:

| 동작 | 정책 |
|---|---|
| `select` | **테이블 직접 접근은 owner 만.** 공개 열람은 위 RPC 로만 |
| `insert` | `authenticated`, `owner = auth.uid()` 강제 |
| `update` · `delete` | `owner = auth.uid()` |

계정당 청첩장 20개 상한을 `insert` 트리거로 건다. 로그인이 있어도 오용은 가능하다.

## 6. 인증 — 카카오 OAuth

Supabase Auth의 Kakao provider를 쓴다. 매직링크는 쓰지 않는다 —
Supabase 기본 메일 발송은 프로덕션용이 아니라 외부 SMTP가 따로 필요하다.

**카카오 개발자 콘솔에서 할 일:**

| 항목 | 값 |
|---|---|
| 앱 등록 | 아이콘 · 이름 · 회사정보 · 카테고리 · 대표 도메인 |
| `client_id` | REST API 키 |
| `client_secret` | 「카카오 로그인 Client Secret」 — **활성화 필요** |
| Redirect URI | `https://<project-ref>.supabase.co/auth/v1/callback` |
| 동의항목 | `profile_nickname`, `profile_image` |
| 카카오 로그인 State | ON |

`account_email`은 **비즈앱 전환이 필요하므로 받지 않는다.**
Supabase Kakao provider 설정에서 **「Allow users without an email」을 켠다.**
이메일이 없어도 `auth.users.id`(uuid)가 있으므로 이 설계에 부족함이 없다.

### CI(연계정보)를 쓰지 않는 이유

여러 서비스에서 같은 사람으로 인식하는 「유니버스」를 위해 CI를 검토했고, **버렸다.**

- **못 받는다.** 콘솔에서 CI 동의항목은 기본이 「권한없음」이라 검수 신청조차 안 열린다.
  비즈앱 전환 + 업종·자격 요건 + 별도 제휴 심사를 통과해야 한다.
- **받아도 안 된다.** CI는 주민번호에서 파생된 고유식별정보에 준한다.
  저장하는 순간 암호화 · 접근통제 · 파기 의무가 붙는다. 데모가 질 부담이 아니다.
- **필요가 없다.** CI가 필요한 것은 auth 를 공유하지 않는 서로 다른 회사끼리
  동일인을 맞출 때다. 내 서비스끼리는 auth 를 하나 쓰면 그만이다.

카카오 **회원번호는 앱별로 다르다.** 앱을 새로 파면 같은 사람도 다른 ID가 나오므로
"카카오 회원번호로 통합"도 애초에 성립하지 않는다.

**대신 지켜야 할 규칙 하나 —**

> **서비스가 늘어도 Supabase 프로젝트를 새로 만들지 않는다.**

프로젝트를 공유하면 `auth.users.id` 가 그대로 모든 서비스의 공통 식별자다.
프로젝트를 가르면 uuid 가 갈리고 그때부터 정말 CI 같은 것이 필요해진다.
**되돌리기가 가장 비싼 종류의 결정이라 지금 못박는다.**
한 사람이 카카오로도 구글로도 들어오는 경우는 Supabase identity linking 이
한 `auth.users` 행에 여러 identity 를 묶어 해결한다.

## 7. 주소 스킴과 하위 호환

`invite.html` 은 **세 가지 입력을 받는다.**

| 입력 | 동작 |
|---|---|
| `?id=k3n9x2` | RPC 로 조회해 그린다 |
| `#d=…` | 지금처럼 주소에서 디코드한다 — **유지** |
| 둘 다 없음 | 기본 데모. Supabase 를 아예 타지 않는다 |

`?to=` 는 그대로 살아 있고 `?id=k3n9x2&to=이름` 으로 함께 쓴다.
`baseUrl(query)` 가 이미 물음표 자리를 인자로 받게 고쳐져 있어 그대로 쓸 수 있다.

**`#d=` 를 죽이지 않는 이유가 셋이다.** 이미 뿌려진 링크가 안 깨지고,
로그인 없이 만들어 보는 경로가 남고, **Supabase 가 멈춰도 기본 데모와
`#d=` 청첩장은 계속 열린다.**

## 7-1. 로그인 전에 만들던 것을 잃지 않는다

지금은 로그인 없이 바로 만들기 시작한다. 계정이 생겨도 **그 즉시성을 첫 화면에서
빼앗지 않는다.** 로그인은 *저장하려는 순간*에 요구한다.

| 시점 | 무엇이 일어나나 |
|---|---|
| 열자마자 | 지금처럼 바로 입력한다. 로그인 묻지 않는다 |
| 입력 중 | 이 기기 `localStorage` 초안에 계속 담는다 — **기존 동작 그대로** |
| 「저장」을 누를 때 | 여기서 카카오 로그인을 요구한다 |
| 로그인 복귀 후 | **초안을 그대로 들고 이어서 저장한다.** 입력이 날아가지 않는다 |

OAuth 는 페이지를 떠났다 돌아오므로 초안이 `localStorage` 에 있어야 복귀 후 살아난다.
초안은 계정이 생겨도 **없애지 않는다** — 로그인 왕복을 건너는 다리이자
저장 실패 시의 안전망이다.

이미 있는 초안 로직을 그대로 쓰므로 새로 만들 것이 없다.

## 8. 잃는 것과 그 대비

이 설계의 실제 비용이다. 셋 다 지금은 없던 실패 방식이다.

### ① 첫 렌더 0ms 를 잃는다

지금은 주소에 데이터가 다 있어 즉시 그린다. `?id=` 는 fetch 가 끝나야 이름이 나온다.

**fetch 중에 기본값(강태윤 · 윤채원)이 잠깐 보이면 최악이다.** 남의 이름이 뜬다.

- `?id=` 가 있으면 이름 자리를 **비운 채로** 기다린다. 기본값을 먼저 그리지 않는다.
- 한 번 연 청첩장은 `localStorage` 에 캐시한다. 재방문은 **캐시로 즉시 그리고**
  뒤에서 갱신한다.
- 조회 실패는 조용히 넘기지 않고 "청첩장을 불러오지 못했습니다"를 보여 준다.
  기존 `read()`/`write()` 가 이미 전부 `try/catch` 라 그 규약을 따른다.

### ② 장애 내성을 잃는다

지금은 정적이라 죽지 않는다. §7 의 `#d=` 유지가 이것의 절반을 되돌린다.

### ③ Free 티어 일시정지가 치명적이 된다

> Free projects are paused after **1 week of inactivity.**

전에는 사진만 깨졌겠지만 이제 **청첩장 자체가 안 열린다.**
포트폴리오 데모는 몇 주씩 아무도 안 들어오는 것이 정상이라 현실적인 위험이다.

**GitHub Actions 크론으로 주 1회 핑을 때린다.** 워크플로 파일 하나다.
선택이 아니라 이 설계의 필수 구성요소다.

## 9. 운영

| 항목 | 값 | 근거 |
|---|---|---|
| 티어 | **Free 로 시작** | `claudedocs/storage-cost.md` 4차 |
| DB | 500MB | 청첩장 1건 jsonb 3KB → 사실상 안 닿는다 |
| 활성 프로젝트 | 2개 | 프로젝트를 가르지 않는 또 하나의 이유 |
| 계정당 청첩장 | 20개 | 트리거 |
| 가용성 | 주간 핑 워크플로 | §8-③ |

한도에 닿으면 Pro($25/월)로 올린다. **코드는 바뀌지 않는다.**

## 10. 범위 밖

**갤러리(밴드 3장).** 하위 프로젝트 2다. 이 문서에서 결정된 것까지만 적어 둔다 —
밴드 3장 교체이고 격자는 아니며, 크기는 **920px WebP q75(≈30KB)** 다.
실측 근거는 `storage-cost.md` 6장에 있다.

**앞서 정했던 「공개 허용 + 30일 자동 삭제」는 로그인이 대체한다.** 그 결정은
로그인이 없다는 전제에서 익명 업로드 오용을 막으려던 것이었다. 이제 업로드는
로그인 사용자로 제한되고, 소유는 `auth.uid()` 로 풀리므로 22자 키 모델과 함께
그 전제도 폐기한다. 30일 TTL 은 오용 방어가 아니라 **비용 관리** 항목으로만
다시 검토한다 — 하위 프로젝트 2에서 정한다.

**방명록 · 참석 여부.** 하위 프로젝트 3. `invite.html` 의 `read()`/`write()`
두 함수와 폼 `submit` 핸들러가 저장 경계 전부라는 사실은 그대로다.

**격자 갤러리 + 라이트박스.** 보류. 밴드가 저장소 · 업로드 · 리사이즈를 다 깔면
그 위에 얹는 화면 작업만 남는다. `storage-cost.py` 에 60장 모델을 남겨 둔 이유다.

## 11. 확인이 필요한 것

- **카카오 앱 등록은 계정 소유자만 할 수 있다.** REST API 키 · Client Secret ·
  Redirect URI 등록이 선행되어야 구현을 시작할 수 있다.
- **대표 도메인에 `wedding.onnit.co.kr` 등록**이 필요하다.
- 8자 base62 충돌 시 재시도는 **3회까지**, 그 뒤에는 저장 실패로 알린다.
  62⁸ 공간에서 3회 연속 충돌은 사실상 일어나지 않으므로 이때는 다른 고장을 의심한다.
