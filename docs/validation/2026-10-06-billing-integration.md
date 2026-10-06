# 결제 연동 검증 — 2026-10-06

범위: 사용자 요청에 따라 wedding 서버용 공통 결제 어댑터와 로컬 테스트 진입점만 추가한다. 운영 배포·과금 위치·상품·실판매가·발행/이용권 지급은 제외한다. 다른 작업의 변경은 포함하지 않는다.

기준 커밋: 5122ca9, 작업 브랜치 `codex/billing-integration`. 공통 Billing 기준 `dceccfe`.

| 대상 | 역할·확인 범위 | 코드/실행 근거 | 한계 |
|---|---|---|---|
| README.md | 제품 실행 구조, 관련 절 본문 확인 | 서버 어댑터와 별도 로컬 진입점 | 기존 제품 전체 재검토 제외 |
| docs/superpowers/specs/2026-10-04-payment-design.md | 기존 토스/발행 과금 설계 확인; 최신 사용자 요청에 따라 적용 보류 | 제품 인증/발행 경로 변경 없음 | 운영 배포 제외 |
| server/billing/client.mjs | 주문 생성·서버 상태 확인 | 멱등·오류·타서비스/구매 불일치·주소 검증 테스트 | test/KRW만 지원 |
| server/billing/test-server.mjs | 로컬 검증 진입점 | Host/Origin·본문 거부, 임의 파일 접근 차단 | 운영 API 아님 |

검증: 모듈/HTTP 테스트 5개 통과. 실제 로컬 어댑터 → 공통 Billing → PortOne T0000에서 테스트 주문 생성·금액 3000 KRW·checkout URL 생성 성공. 양방향 타서비스 주문 조회는 404. 브라우저 테스트 페이지에서 주문 대기 표시 확인.

미검증: 새 서비스별 주문의 카드/간편결제 승인 완료. 본인인증은 사용자 수행 필요. 이전 공통 모듈의 결제 성공을 이번 서비스별 종단 성공으로 대체하지 않는다. 운영 제품 인증 라우터·Pages 서버 배포와 자동 웹훅 전체 경로는 이번 범위 밖.

## 실패 응답 보완 — 2026-10-06

기준: `cadda64` 이후 미커밋 변경. 공통 결제 API의 확인된 실패(`200`, `status=failed`)를 통신 장애와 구별한다. 과금 정책·운영 제품 경로는 변경하지 않았다.

| 대상 | 본문·코드 확인 | 실행 검증 | 미검증·제외 |
|---|---|---|---|
| server/billing/client.mjs · client.test.mjs | 서비스·주문 검증 유지, 실패 코드·시도·시각·PG 코드 검증, 고정 문구 정규화 | 실패 계약·잘못된 응답·원시 문구 제거 테스트 | 실제 PG 조회 제외 |
| server/billing/test-server.mjs · test-server.test.mjs | 검증된 실패 응답을 HTTP 200으로 전달 | 임시 loopback 서버 통합 테스트 | 기존 실행 서버 재시작 없음 |
| server/billing/test-page.html | 실패 안내·PG 코드 textContent 표시, 승인 후 오래된 안내 제거 | DOM 대역에서 실제 페이지 스크립트 실행 | 실제 브라우저·카드 인증 미실행 |
| server/billing/README.md | 실패 상태와 검증 경계 계약 갱신 | 문서/코드 대조 | 제품 전체 문서 재검토 제외 |

`node --test server/billing/*.test.mjs`: 8개 통과, 실패 0. client·HTTP·화면 실패 재현 테스트를 먼저 추가하고 실패를 확인한 뒤 구현했다. 실제 카드 승인·원격 배포·공통 서버 재시작은 수행하지 않았다.

### 동일 주문 재시도·URL 갱신 보완

실패 주문의 선택적 checkout URL도 공통 서버 origin·정해진 경로로 제한한다. 결제창 준비·갱신 POST만 같은 구매·멱등 키로 요청하며, GET 화면 방문과 상태 확인은 새 URL을 발급하지 않는다. 실패 안내를 유지한 재시도 링크는 pending/failed에만 표시하고 승인·환불 상태에서는 제거한다. 원격 동작·실제 URL 갱신·카드 승인은 미실행이며 공통 API의 응답 fixture로 제품 계약을 검증했다.

각 제품 `node --test server/billing/*.test.mjs`: 10개 통과, 실패 0. client URL 검증, HTTP 실패 재시도 링크, DOM 링크 유지의 RED를 확인한 뒤 수정했다. 기존 서버 재시작·원격 배포·커밋 없음.
