# 결제 — 발행을 유료로 — 설계

작성 2026-10-04. 이 문서는 **하위 프로젝트 4**의 스펙이다.
[계정 · 서버저장 · 짧은주소](2026-09-08-auth-server-storage-design.md)(하위 프로젝트 1) 위에 올라탄다.
인프라는 그 문서 §9 대로 **무료 플랜 고정**이고, 이 문서도 그 전제를 벗어나지 않는다.

---

## 1. 무엇을 만드나

청첩장을 **발행**하는 순간에 돈을 받는다. 발행이란 `invitations.published_at` 이 채워져
`invite.html?id=k3n9x2` 짧은 주소가 하객에게 열리는 것이다.

| | 무료 | 유료 (발행) |
|---|---|---|
| 주소 | `invite.html#d=…` 2,600자 | `invite.html?id=` 8자 |
| 저장 | 이 기기 초안 · 편집용 링크 · 로그인하면 내 목록 | 같다 |
| 사진 | 기본 3장 | 내 사진 3장 (하위 프로젝트 2) |
| 참석 여부 · 방명록 | 하객 기기에만 남는다 | 서버에 모인다 (하위 프로젝트 3) |
| 하객별 인사 · 큰 글씨 · 당일 화면 · QR | 전부 | 전부 |

**`#d=` 긴 주소는 계속 무료다.** 로그인도 결제도 없이 지금처럼 만든다.
이 프로젝트의 출발점이었고 랜딩이 그걸 정직성으로 내세우고 있어서 없애지 않는다.
돈을 받는 것은 **서버가 해 주는 일** 전부다. 짧은 주소, 사진 저장, 응답 수집.
README 가 "결국 저장소 하나의 문제"라고 적은 그 셋이고, 저장소가 생기는 지점이 곧 과금 지점이다.

## 2. 왜 발행에서 받나

세 지점을 놓고 봤다.

| 받는 지점 | 문제 |
|---|---|
| 만들기 시작할 때 | 하위 프로젝트 1 §7-1 의 즉시성을 죽인다. 뭘 사는지 모르는 채 결제한다 |
| 저장할 때 | 로그인과 결제를 한 번에 요구한다. 고치러 돌아올 때마다 걸린다 |
| **발행할 때** | **완성된 것을 보고 산다.** 가족에게 `#d=` 로 먼저 보여 줄 수도 있다 |

살롱드레터도 같은 지점이다. 만들기와 미리보기는 무료, 발급이 유료.

저장과 발행이 처음부터 갈라져 있어야 이게 성립한다. 그래서 하위 프로젝트 1이
`published_at` 컬럼과 「발행」 버튼을 미리 깐다. 결제가 붙기 전까지 그 버튼은 그냥 눌리고,
결제가 붙으면 버튼 앞에 결제가 끼어든다. **1의 코드는 바뀌지 않는다.**

## 3. 흐름

```
make.html 「발행」
  │  (미로그인이면 카카오 로그인 → 초안 들고 복귀. 1의 §7-1 그대로)
  ▼
토스 결제위젯  (클라이언트 키, customerKey = auth.uid)
  │  successUrl = make.html?paymentKey=…&orderId=…&amount=…
  ▼
confirm-payment  (Edge Function, verify_jwt = true)
  ├ amount == PRICE ?                        ← 아니면 거절. 금액은 서버 상수
  ├ orderId 의 청첩장이 auth.uid() 소유 ?      ← 아니면 거절
  ├ payments 에 이미 DONE 이면 → 성공으로 응답   ← 새로고침 멱등
  ├ 토스 POST /v1/payments/confirm (시크릿 키)
  ├ payments insert — 응답 원문을 raw 에
  └ invitations.published_at = now()
  ▼
make.html 이 짧은 주소를 보여 준다

toss-webhook  (Edge Function, verify_jwt = false)
  ├ 본문을 믿지 않는다. paymentKey 로 GET /v1/payments/{key} 되물음
  ├ payments.status 갱신
  ├ DONE 인데 published_at 이 비어 있으면 채운다    ← 승인은 됐는데 우리 쪽 갱신이 실패한 경우
  └ CANCELED 면 published_at 을 비운다             ← 환불 = 발행 취소
```

**금액을 서버에서 검사하는 이유.** 결제위젯의 금액은 클라이언트가 정한다.
100원으로 결제창을 띄우고 `amount=100` 으로 승인을 부르면 토스는 100원을 승인한다.
그래서 승인 전에 `amount` 가 서버 상수와 같은지 본다. 토스 가이드의 표준 절차다.

**웹훅 본문을 믿지 않는 이유.** 토스 웹훅에는 서명이 없다. 아무나 `DONE` 을 보낼 수 있다.
받은 `paymentKey` 로 토스에 되물어 그 응답만 쓴다. 되물을 때 시크릿 키가 들어가므로
이것도 Edge Function 이어야 한다.

**`orderId`** 는 `{청첩장 id}_{base36 시각}` 이다. 함수가 앞 8자로 청첩장을 찾는다.
토스 규격(6~64자, 영숫자 `-` `_`)에 맞는다.

## 4. 데이터 모델

```sql
create table payments (
  id            text primary key,                 -- 토스 paymentKey
  order_id      text not null unique,
  invitation_id text references invitations on delete set null,
  owner         uuid references auth.users  on delete set null,
  amount        integer not null,
  status        text not null,                    -- 토스 status 그대로. DONE · CANCELED … 거절은 REJECTED
  method        text,
  raw           jsonb not null,                   -- 토스 응답 원문. Free 는 로그가 하루라 이게 기록이다
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on payments (owner, created_at desc);
create trigger payments_touch before update on payments
for each row execute function touch_updated_at();   -- 하위 프로젝트 1의 함수 재사용

alter table payments enable row level security;
revoke all on payments from anon;
create policy "owner reads own payments" on payments
  for select to authenticated using (owner = auth.uid());
-- insert · update 정책 없음. 쓰기는 함수가 service role 로만 한다.
```

**`on delete set null` 이다.** 청첩장을 지우거나 탈퇴해도 결제 기록은 남는다.
전자상거래법이 대금 결제 기록 보존을 요구하고, 그게 아니라도 환불 분쟁에 필요하다.
연결만 끊기고 `order_id` 에 청첩장 id 가 박혀 있어 추적은 된다.
하위 프로젝트 1의 `cascade` 와 충돌하지 않는다.

## 5. Edge Functions — 이 프로젝트의 유일한 서버 코드

| 함수 | `verify_jwt` | 누가 부르나 |
|---|---|---|
| `confirm-payment` | **true** | `make.html`, 사용자 JWT 로 |
| `toss-webhook` | **false** | 토스. Supabase 자격이 없으므로 플랫폼 검증을 끈다 |

- 리포의 `supabase/functions/` 아래에 두고 **CLI 로 배포**한다. 대시보드 에디터는
  버전 관리가 없어 쓰지 않는다. 페이지 세 장은 여전히 빌드가 없다. 이건 함수 쪽 배포 도구일 뿐이다.
- 시크릿은 `TOSS_SECRET_KEY` 하나. service role 키는 함수 환경에 기본으로 들어 있다.
- 무료 한도는 월 50만 회, 메모리 256MB, CPU 2초, 벽시계 150초.
  승인 한 번은 토스 왕복 한 번이라 한도는 의미가 없다.
- 콜드 스타트는 결제 버튼 뒤라서 상관없다. **하객 열람 경로에는 함수가 없다.**
- **로그가 하루다.** 실패 추적은 로그가 아니라 `payments.raw` 로 한다.
  금액 불일치나 소유자 불일치로 거절한 요청도 `status = 'REJECTED'` 로 남긴다.

## 6. 테스트와 라이브

사업자등록 전에 **토스 테스트 키**로 전부 만든다. 테스트 키는 가입 즉시 나온다.
라이브 전환은 `TOSS_SECRET_KEY` 시크릿과 `make.html` 의 클라이언트 키를 바꾸는 것뿐이다.
코드는 같다.

## 7. 가격 · 환불 · 법

- **가격은 미정이다.** 비용 문서가 비교 기준으로 쓴 숫자는 살롱드레터 ₩14,900 이다. 서버 상수 하나다.
- **환불은 수동이다.** 토스 콘솔에서 취소하면 웹훅이 `published_at` 을 비운다. 환불 UI 는 만들지 않는다.
- **발행 즉시 청약철회가 제한된다.** 디지털콘텐츠는 제공이 개시되면 철회가 제한되는데,
  그러려면 결제 전에 고지하고 동의를 받아야 한다. 결제위젯 위에 한 줄과 체크박스 하나다.
- **사이트에 적어야 하는 것.** 사업자 정보(상호 · 대표 · 사업자등록번호 · 연락처), 이용약관,
  개인정보처리방침, 환불 규정. PG 심사가 이 넷을 본다. 랜딩 푸터와 정적 페이지 두 장이다.
- **통신판매업 신고**는 간이과세자면 면제다. 아니면 신고하고 번호도 푸터에 적는다.

"아예 무료"에서 돈이 나가는 유일한 지점이 여기다. 플랫폼 고정비는 0이고
건당 PG 수수료와, 면제가 아니면 신고 면허세뿐이다.

## 8. 랜딩이 바뀐다

`index.html` 은 지금 "로그인도 결제도 서버도 없는"과 "무료로 만들기"를 내세운다.
둘 다 거짓이 된다. 그리고 "못 하는 것 세 가지"(주소가 길다 · 응답이 안 모인다 · 갤러리가 없다)는
정확히 **유료가 풀어 주는 세 가지**가 된다. 그 자리를 **무료와 유료의 경계**로 다시 쓴다.
무료 경로가 그대로 있다는 것을 숨기지 않는다. 그게 이 프로젝트가 정직성이라고 불러 온 것이다.

## 9. 잃는 것

- **발행이 토스와 함수에 묶인다.** 둘 중 하나가 죽으면 발행이 안 된다. 저장과 `#d=` 는 계속 된다.
  하위 프로젝트 1의 §7 과 같은 구조다. 유료 경로만 죽고 무료 경로는 산다.
- **서버 코드가 생긴다.** 지금까지 이 프로젝트에 없던 것이다. 함수 둘, 시크릿 하나, CLI 하나.

## 10. 확인이 필요한 것

- **가격.**
- **사업자등록 여부와 과세 유형.** 토스페이먼츠는 개인사업자도 가입된다. 심사 대기가 있으니 지금 시작한다.
- **결제 수단.** 카드만인지 간편결제(카카오페이 · 토스페이 · 네이버페이)까지인지. 위젯 설정이다.
- **현금영수증.** 카드만 받으면 필요 없다.
- **이용약관 · 개인정보처리방침 · 환불 규정 문안.** 코드가 아니라 글이다.
- **카카오 앱 등록에도 개인정보처리방침 URL 이 필요할 수 있다.** 하위 프로젝트 1 과 겹치므로 먼저 쓴다.
