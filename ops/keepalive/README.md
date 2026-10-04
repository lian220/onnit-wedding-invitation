# onnit-keepalive — Supabase 일시정지 방지 핑

Supabase Free 는 7일 동안 활동이 없으면 프로젝트를 멈춘다. 멈추면 발행된 청첩장이 안 열린다.
이 워커가 매시 17분에 `get_invitation` RPC 를 한 번 불러 그걸 막는다.
RPC 는 Postgres 를 실제로 태우므로 활동으로 잡힌다. 없는 id 라 결과는 `null` 이다.

왜 Worker 인가: 이미 쓰는 Cloudflare 계정에서 무료로 돌고, 저장소 활동과 무관하다.
공개 저장소의 GitHub Actions 는 60일 커밋이 없으면 예약 실행이 꺼진다.
UptimeRobot 은 계정이 하나 더 필요하다. 설계는 `docs/superpowers/specs/2026-09-08-auth-server-storage-design.md` §8-③.

## 어디서 도나

Cloudflare 대시보드 → Workers & Pages → `onnit-keepalive`.
**Workers Builds** 가 이 저장소의 `main` 에 push 가 오면 이 디렉터리(Root directory `ops/keepalive`)에서
`npx wrangler deploy` 를 돌린다. 크론 주기도 `wrangler.jsonc` 가 정하므로 대시보드에서 손으로 고칠 것이 없다.
Build watch paths 는 `ops/keepalive/*` — 사이트 파일만 바뀐 push 에는 안 돈다.

HTTP 로는 안 받는다 (`workers_dev: false`). 크론만 돈다.

## 손으로 돌려 보기

```bash
npm install
npm run check                                  # 타입 생성 + tsc
npx wrangler deploy --dry-run --outdir dist    # 배포 없이 번들·설정 확인
npx wrangler dev --test-scheduled              # 그 다음 다른 터미널에서 ↓
curl "http://localhost:8787/__scheduled?cron=17+*+*+*+*"
```

dev 로그에 `{"cron":"17 * * * *","ok":true,"status":200}` 가 찍히면 된다. 운영 Supabase 를 실제로 때린다.
`wrangler login` 이 돼 있으면 `npm run deploy` 로 직접 올릴 수도 있지만, 보통은 push 로 충분하다.

## 잘 도는지

| 어디 | 무엇 |
|---|---|
| Worker → Settings → Triggers | `17 * * * *` |
| Worker → Logs | 매시 17분에 `ok: true` 한 줄 |
| Supabase → Logs → API | 같은 시각에 `POST /rest/v1/rpc/get_invitation` 200 |

실패하면 워커가 예외를 던져 크론 기록에 에러로 남는다. **메일은 안 온다.**
Supabase 가 멈출 때 보내는 메일이 마지막 그물이다.

## 알림이 필요해지면

둘 중 하나. 둘 다 계정 소유자 몫이다.

**UptimeRobot** (<https://uptimerobot.com>, 무료) — New Monitor:

| 항목 | 값 |
|---|---|
| Type | HTTP(s) |
| URL | `https://ehzcybacnnhtyikrpsiy.supabase.co/rest/v1/rpc/get_invitation` |
| Method | POST, Content-Type `application/json`, Body `{"p_id":"keepalive"}` |
| Headers | `apikey: <js/config.js 의 SUPABASE_ANON_KEY>` |
| Interval | 5분 |
| Alert | 이메일 |

이러면 핑도 이중이 되고 죽으면 메일이 온다.

**Cloudflare Email Routing** — `onnit.co.kr` 존에서 Email Routing 을 켜고 수신 주소 하나를 인증한 뒤,
`wrangler.jsonc` 에 `send_email` 바인딩을 더하고 `scheduled` 의 실패 분기에서 보낸다.
