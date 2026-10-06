# 공통 결제 테스트 연동

서버 모듈 `client.mjs`가 lian-infra의 Billing HTTP API를 호출한다. 브라우저 → 로컬 테스트 서버 → 결제 어댑터 → 공통 Billing → PortOne V2/KCP 테스트 채널 순서다. 제품의 인증 라우터·발행·이용권 지급에는 연결하지 않았다. 과금 위치·상품·판매가는 사용자 결정 이후 별도 구현한다.

## 실행

Node 22 이상에서 저장소 루트의 비공개 `.env.billing-test`를 사용한다.

```sh
node --env-file=.env.billing-test server/billing/test-server.mjs
node --test server/billing/*.test.mjs
```

환경 변수: `BILLING_BASE_URL`, `BILLING_API_KEY`, `BILLING_SERVICE_ID`, `BILLING_PRICE_ID`, `BILLING_TEST_PORT`, `BILLING_TEST_STATE_FILE`. 키는 서버 전용이며 공개 환경변수·정적 파일에 넣지 않는다. `.env.billing-test`와 `.billing-test-state.json`은 Git에서 제외하고 권한 0600으로 보관한다.

상태 파일은 `{customerRef, externalOrderId, idempotencyKey, orderId?}`이며 개인정보 대신 불투명 테스트 식별자만 둔다. 구매번호와 멱등 키를 네트워크 호출 전에 저장한다. 실행 중 파일을 바꾸지 않는다. 같은 구매 재시도는 같은 키·본문으로 한다. 오래된 결제창은 1시간 만료하며 자동으로 새 구매를 만들지 않는다.

## 계약

- `checkout(purchase)`: 서버에 등록된 price_id만 사용한다. 브라우저에서 금액·가격·사용자 식별자를 받지 않는다.
- `reconcile(orderId, purchase)`: 공통 서버가 PortOne 상태를 재조회한다. 서비스·구매자·구매번호·가격·주문 ID·test 환경을 대조한다.
- 반환은 `{ok: true, order}` 또는 `{ok: false, error}`다. 202·전송 오류·잘못된 응답은 성공으로 처리하지 않는다. 원시 응답·키·결제 URL은 로그에 남기지 않는다.
- 현재 어댑터는 TEST/KRW 단건 검증 전용이다. live·구독·상품 지급은 제공하지 않는다. 승인 판정은 `paid`이며 결제창 도착·복귀 URL로 판정하지 않는다.
- 로컬 테스트 서버는 127.0.0.1만 바인딩한다. Host/Origin 검사를 통과한 빈 POST만 허용하며 등록된 구매 한 건만 처리한다. 공개 배포용 서버가 아니다.

## 실제 서비스에 붙일 때

인증한 사용자와 구매의 소유권을 제품 서버에서 검사한 뒤 이 모듈을 호출한다. 구매 식별자는 제품 DB에 영속화하고 결제 상태 조회 시 소유권을 다시 검사한다. 청첩장의 Cloudflare Pages 정적 브라우저 코드에서는 직접 import하지 않는다. 별도 서버 실행 환경과 안전한 Billing 접속 경로가 필요하다. 이번 로컬 검증은 그 공개 배포를 포함하지 않는다.
